import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionToken,
  verifySessionToken,
  normalizeIdentifier,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  base64UrlEncode,
  bytesToBase64Url,
} from '../functions/api/_auth';

const TEST_SECRET = 'test_secret_for_sessions_minimum_32_chars_long!';

test('Auth: 100 tokens created and verified successfully, tampered tokens rejected (Tiêu chí A.3)', async () => {
  for (let i = 0; i < 100; i++) {
    const userId = `user_${i}_${Math.random().toString(36).substring(2, 9)}`;
    const identifier = `0987${String(i).padStart(6, '0')}`;

    // 1. Create token
    const token = await createSessionToken(userId, identifier, TEST_SECRET);
    assert.ok(token, 'Token should be non-empty string');
    assert.strictEqual(token.split('.').length, 2, 'Token must have exactly payload.signature format');

    // 2. Verify token
    const verified = await verifySessionToken(token, TEST_SECRET);
    assert.ok(verified, `Token ${i} must verify successfully`);
    assert.strictEqual(verified.userId, userId);
    assert.strictEqual(verified.identifier, identifier);

    // 3. Verify with wrong secret must fail
    const wrongSecret = await verifySessionToken(token, TEST_SECRET + '_wrong');
    assert.strictEqual(wrongSecret, null, 'Verification with wrong secret must return null');

    // 4. Modify 1 character in signature -> must be rejected
    const parts = token.split('.');
    const sig = parts[1];
    const charToReplace = sig[0] === 'a' ? 'b' : 'a';
    const tamperedSig = charToReplace + sig.slice(1);
    const tamperedToken = `${parts[0]}.${tamperedSig}`;

    const tamperedVerified = await verifySessionToken(tamperedToken, TEST_SECRET);
    assert.strictEqual(tamperedVerified, null, 'Tampered token signature must be rejected');

    // 5. Tamper payload -> must also be rejected
    const payloadPart = parts[0];
    const tamperedPayload = (payloadPart[0] === 'e' ? 'f' : 'e') + payloadPart.slice(1);
    const tamperedPayloadToken = `${tamperedPayload}.${parts[1]}`;
    const tamperedPayloadVerified = await verifySessionToken(tamperedPayloadToken, TEST_SECRET);
    assert.strictEqual(tamperedPayloadVerified, null, 'Token with tampered payload must be rejected');
  }
});

test('Auth: Expired tokens, malformed strings, and invalid secret handling', async () => {
  // 1. Expired token (iat & exp in the past)
  const expiredPayload = JSON.stringify({
    sub: 'user_expired_123',
    identifier: '0901234567',
    iat: Date.now() - 100 * 24 * 3600 * 1000,
    exp: Date.now() - 10 * 24 * 3600 * 1000, // expired 10 days ago
  });
  const expiredPayloadB64 = base64UrlEncode(expiredPayload);

  // Sign it properly with secret
  const subtle = globalThis.crypto.subtle;
  const enc = new TextEncoder();
  const key = await subtle.importKey(
    'raw',
    enc.encode(TEST_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = new Uint8Array(await subtle.sign('HMAC', key, enc.encode(expiredPayloadB64)));
  const expiredToken = `${expiredPayloadB64}.${bytesToBase64Url(signatureBytes)}`;

  const resExpired = await verifySessionToken(expiredToken, TEST_SECRET);
  assert.strictEqual(resExpired, null, 'Expired token must return null');

  // 2. Malformed token strings
  assert.strictEqual(await verifySessionToken('', TEST_SECRET), null, 'Empty string token must return null');
  assert.strictEqual(await verifySessionToken('no-dot-token', TEST_SECRET), null, 'Token without dot must return null');
  assert.strictEqual(await verifySessionToken('a.b.c.d', TEST_SECRET), null, 'Token with >2 parts must return null');
  assert.strictEqual(await verifySessionToken('invalid!!!.???', TEST_SECRET), null, 'Invalid base64 parts must return null');

  // 3. Short or missing secret must throw error
  await assert.rejects(async () => {
    await createSessionToken('usr1', '0901234567', 'short');
  }, /SESSION_SECRET/);

  await assert.rejects(async () => {
    await verifySessionToken('abc.def', '');
  }, /SESSION_SECRET/);
});

test('Auth: normalizeIdentifier handles Vietnamese mobile carriers and emails', () => {
  // Valid VN phone formats
  const p1 = normalizeIdentifier('0966203310');
  assert.deepStrictEqual(p1, { type: 'phone', value: '0966203310' });

  const p2 = normalizeIdentifier(' 0389876543 ');
  assert.deepStrictEqual(p2, { type: 'phone', value: '0389876543' });

  const p3 = normalizeIdentifier('84966203310');
  assert.deepStrictEqual(p3, { type: 'phone', value: '0966203310' });

  // Valid Emails
  const e1 = normalizeIdentifier('User@Domain.COM');
  assert.deepStrictEqual(e1, { type: 'email', value: 'user@domain.com' });

  const e2 = normalizeIdentifier('thap.taisan+invest@gmail.com');
  assert.deepStrictEqual(e2, { type: 'email', value: 'thap.taisan+invest@gmail.com' });

  // Invalid formats
  assert.strictEqual(normalizeIdentifier('12345'), null);
  assert.strictEqual(normalizeIdentifier('0966203310123'), null); // too long
  assert.strictEqual(normalizeIdentifier('not-an-email@'), null);
  assert.strictEqual(normalizeIdentifier(''), null);
});

test('Auth: Cloudflare D1 Rate Limiting (5 failed attempts locks for 15 mins, reset on success)', async () => {
  // Mock D1 database with SQLite-like prepare/bind interface
  const store = new Map<string, { attempts: number; reset_at: number }>();

  const mockDb = {
    prepare: (sql: string) => {
      let boundParams: any[] = [];
      return {
        bind: (...params: any[]) => {
          boundParams = params;
          return {
            first: async () => {
              if (sql.includes('SELECT attempts, reset_at FROM login_attempts WHERE identifier = ?')) {
                const id = boundParams[0];
                return store.get(id) || null;
              }
              return null;
            },
            run: async () => {
              if (sql.includes('DELETE FROM login_attempts WHERE identifier = ?')) {
                const id = boundParams[0];
                store.delete(id);
                return { meta: { changes: 1 } };
              }
              if (sql.includes('INSERT INTO login_attempts')) {
                const id = boundParams[0];
                const resetAt = boundParams[1];
                store.set(id, { attempts: 1, reset_at: resetAt });
                return { meta: { changes: 1 } };
              }
              if (sql.includes('UPDATE login_attempts SET attempts = attempts + 1')) {
                const id = boundParams[0];
                const row = store.get(id);
                if (row) {
                  row.attempts += 1;
                }
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };

  const testId = '0966203310';

  // Initially: allowed
  assert.strictEqual(await checkRateLimit(mockDb, testId), true);

  // Attempt 1 to 4 failed: still allowed
  for (let i = 1; i <= 4; i++) {
    await recordFailedAttempt(mockDb, testId);
    assert.strictEqual(await checkRateLimit(mockDb, testId), true, `Attempt ${i} should still be allowed`);
  }

  // Attempt 5 failed: reaches limit -> locked!
  await recordFailedAttempt(mockDb, testId);
  const locked = await checkRateLimit(mockDb, testId);
  assert.strictEqual(locked, false, '5 failed attempts must lock account');

  // Successful login resets rate limit
  await resetRateLimit(mockDb, testId);
  const unlocked = await checkRateLimit(mockDb, testId);
  assert.strictEqual(unlocked, true, 'Reset must immediately unlock account');
});
