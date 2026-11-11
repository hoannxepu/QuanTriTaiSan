import test from 'node:test';
import assert from 'node:assert/strict';
import { getAccountStorageKey } from '../src/utils/syncEngine';
import { parseSafeDate, hasTimeComponent, compareEntityTimestamps } from '../src/utils/dataMergeEngine';
import { bytesToBase64Url, base64UrlEncode, base64UrlDecode } from '../functions/api/_auth';

test('Sync & Auth Utils: bytesToBase64Url preserves all binary bytes >= 128', () => {
  // Test byte array with full 0..255 range
  const allBytes = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    allBytes[i] = i;
  }

  const b64Url = bytesToBase64Url(allBytes);
  assert.ok(b64Url && b64Url.length > 0);
  assert.ok(!b64Url.includes('+') && !b64Url.includes('/') && !b64Url.includes('='));

  // Decode binary
  let b64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  assert.equal(binary.length, 256);
  for (let i = 0; i < 256; i++) {
    assert.equal(binary.charCodeAt(i), i, `Byte ${i} must match exactly`);
  }
});

test('Sync & Auth Utils: getAccountStorageKey returns normalized account identifiers', () => {
  assert.equal(getAccountStorageKey('0966203310'), '0966203310');
  assert.equal(getAccountStorageKey('User@Domain.Com'), 'user@domain.com');
  assert.equal(getAccountStorageKey(''), 'guest');
});

test('DataMergeEngine: parseSafeDate handles ISO, Vietnamese date and time, and numbers', () => {
  const tIso = parseSafeDate('2026-11-09T14:30:15.000Z');
  assert.ok(tIso > 1700000000000);

  const tVnDate = parseSafeDate('09/11/2026');
  assert.ok(tVnDate > 1700000000000);

  const tVnDateTime = parseSafeDate('14:30:15 - 09/11/2026');
  assert.ok(tVnDateTime > 1700000000000);

  const tEpoch = parseSafeDate(1794218700000);
  assert.equal(tEpoch, 1794218700000);
});

test('DataMergeEngine: compareEntityTimestamps prioritizes timestamp with hours over date-only', () => {
  // Same calendar date: 09/11/2026
  const dateOnly = '09/11/2026';
  const withTime = '2026-11-09T14:30:00.000Z';

  assert.equal(hasTimeComponent(dateOnly), false);
  assert.equal(hasTimeComponent(withTime), true);

  const cmp = compareEntityTimestamps(withTime, dateOnly);
  assert.ok(cmp > 0, 'Timestamp with explicit time must win over date-only');

  const cmpReverse = compareEntityTimestamps(dateOnly, withTime);
  assert.ok(cmpReverse < 0, 'Date-only must lose to timestamp with explicit time');
});
