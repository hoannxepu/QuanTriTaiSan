/**
 * Cloudflare Pages Functions & Server Auth Utilities
 * 
 * Standards:
 * - PBKDF2-SHA256 password hashing (100,000 iterations, 16-byte random salt)
 * - Timing-safe password verification
 * - HMAC-SHA256 signed session tokens (90-day expiry)
 * - Strict identifier normalization (phone: 0xxxxxxxxx; email: lowercase)
 * - Cloudflare D1 persistent rate limiting (5 failed attempts per 15 mins per identifier)
 */

export function getSessionSecret(env: any): string {
  const secret = env?.SESSION_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('SESSION_SECRET chưa được cấu hình trên Cloudflare');
  }
  return secret;
}

export function normalizeIdentifier(raw: string): { type: 'phone' | 'email'; value: string } | null {
  if (!raw || typeof raw !== 'string') return null;
  const val = raw.trim();

  // Email check
  if (val.includes('@')) {
    const email = val.toLowerCase();
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    if (emailRegex.test(email)) {
      return { type: 'email', value: email };
    }
    return null;
  }

  // Vietnamese Phone check: starts with 0 and has 10 digits total
  let digits = val.replace(/[^0-9]/g, '');
  if (digits.startsWith('84') && digits.length === 11) {
    digits = '0' + digits.slice(2);
  }
  if (/^0[3|5|7|8|9][0-9]{8}$/.test(digits) || /^0[0-9]{9}$/.test(digits)) {
    return { type: 'phone', value: digits };
  }

  return null;
}

// Convert bytes to hex string
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// Convert hex string to bytes
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Web Crypto Base64URL
export function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) {
    b64 += '=';
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// PBKDF2-SHA256 password hashing (100,000 iterations, 16-byte random salt)
export async function hashPassword(
  password: string,
  existingSaltHex?: string
): Promise<{ hash: string; salt: string }> {
  const subtle = globalThis.crypto.subtle;
  const salt = existingSaltHex ? hexToBytes(existingSaltHex) : globalThis.crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();

  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    true,
    ['sign']
  );

  const rawKey = await subtle.exportKey('raw', derivedKey);
  const hashHex = bytesToHex(new Uint8Array(rawKey));
  const saltHex = bytesToHex(salt);

  return { hash: hashHex, salt: saltHex };
}

// Timing-safe comparison to prevent timing attacks
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Verify password using PBKDF2 with stored salt
export async function verifyPassword(password: string, storedHash: string, storedSalt: string): Promise<boolean> {
  if (!password || !storedHash || !storedSalt) return false;
  const { hash } = await hashPassword(password, storedSalt);
  return timingSafeEqual(hash, storedHash);
}

// Create HMAC-SHA256 Session Token (valid 90 days)
export async function createSessionToken(userId: string, identifier: string, secret: string): Promise<string> {
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('SESSION_SECRET chưa được cấu hình trên Cloudflare');
  }
  const subtle = globalThis.crypto.subtle;
  const enc = new TextEncoder();

  const key = await subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payload = JSON.stringify({
    sub: userId,
    identifier,
    iat: Date.now(),
    exp: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days
  });

  const payloadB64 = base64UrlEncode(payload);
  const signatureBytes = await subtle.sign('HMAC', key, enc.encode(payloadB64));
  const signatureB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signatureBytes)));

  return `${payloadB64}.${signatureB64}`;
}

// Verify HMAC-SHA256 Session Token
export async function verifySessionToken(token: string, secret: string): Promise<{ userId: string; identifier: string } | null> {
  if (!token || typeof token !== 'string') return null;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('SESSION_SECRET chưa được cấu hình trên Cloudflare');
  }
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signatureB64] = parts;
  const subtle = globalThis.crypto.subtle;
  const enc = new TextEncoder();

  try {
    const key = await subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBinary = atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'));
    const sigBytes = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) {
      sigBytes[i] = sigBinary.charCodeAt(i);
    }

    const isValid = await subtle.verify('HMAC', key, sigBytes, enc.encode(payloadB64));
    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (!payload || !payload.sub || !payload.exp) return null;
    if (Date.now() > payload.exp) return null; // Expired

    return { userId: payload.sub, identifier: payload.identifier };
  } catch (err) {
    return null;
  }
}

// D1 Persistent Rate Limiter: max 5 failed attempts per 15 minutes per identifier
export async function checkRateLimit(db: any, identifier: string): Promise<boolean> {
  if (!db) return true;
  try {
    const now = Date.now();
    const row = (await db
      .prepare('SELECT attempts, reset_at FROM login_attempts WHERE identifier = ?')
      .bind(identifier)
      .first()) as { attempts: number; reset_at: number } | null;

    if (!row) return true;
    if (now > row.reset_at) {
      // Window expired, clean up
      await db.prepare('DELETE FROM login_attempts WHERE identifier = ?').bind(identifier).run();
      return true;
    }
    return row.attempts < 5;
  } catch (err) {
    // If table doesn't exist yet or D1 transient issue, do not block login
    return true;
  }
}

export async function recordFailedAttempt(db: any, identifier: string): Promise<void> {
  if (!db) return;
  try {
    const now = Date.now();
    const row = (await db
      .prepare('SELECT attempts, reset_at FROM login_attempts WHERE identifier = ?')
      .bind(identifier)
      .first()) as { attempts: number; reset_at: number } | null;

    if (!row || now > row.reset_at) {
      const resetAt = now + 15 * 60 * 1000; // 15 mins window
      await db
        .prepare(
          'INSERT INTO login_attempts (identifier, attempts, reset_at) VALUES (?, 1, ?) ON CONFLICT(identifier) DO UPDATE SET attempts = 1, reset_at = excluded.reset_at'
        )
        .bind(identifier, resetAt)
        .run();
    } else {
      await db
        .prepare('UPDATE login_attempts SET attempts = attempts + 1 WHERE identifier = ?')
        .bind(identifier)
        .run();
    }
  } catch (err) {
    // Non-blocking error handling
  }
}

export async function resetRateLimit(db: any, identifier: string): Promise<void> {
  if (!db) return;
  try {
    await db.prepare('DELETE FROM login_attempts WHERE identifier = ?').bind(identifier).run();
  } catch (err) {
    // Non-blocking
  }
}
