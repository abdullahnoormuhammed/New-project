import test from 'node:test';
import assert from 'node:assert/strict';

import { checkPasscode, hashPasscode, isValidPasscode } from '../src/lib/passcode.ts';
import { normalizeConfig } from '../src/lib/storage.ts';
import { DEFAULT_CONFIG } from '../src/lib/config.ts';

test('a passcode hashes to a stable digest, and never to the passcode itself', async () => {
  const digest = await hashPasscode('taqwa2026');
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(digest, await hashPasscode('taqwa2026'));
  assert.ok(!digest.includes('taqwa'));
});

test('surrounding whitespace does not change the passcode', async () => {
  assert.equal(await hashPasscode('  taqwa2026 '), await hashPasscode('taqwa2026'));
});

test('different passcodes give different digests', async () => {
  assert.notEqual(await hashPasscode('taqwa2026'), await hashPasscode('taqwa2027'));
});

test('checking a passcode accepts only the right one', async () => {
  const stored = await hashPasscode('sea-cow-lake');
  assert.equal(await checkPasscode('sea-cow-lake', stored), true);
  assert.equal(await checkPasscode('sea-cow-lak', stored), false);
  assert.equal(await checkPasscode('', stored), false);
  assert.equal(await checkPasscode('SEA-COW-LAKE', stored), false);
});

test('a passcode must be at least four characters', () => {
  assert.equal(isValidPasscode('abc'), false);
  assert.equal(isValidPasscode('   a   '), false);
  assert.equal(isValidPasscode('abcd'), true);
  assert.equal(isValidPasscode('a long spoken phrase'), true);
});

test('settings arriving from the database gain any fields they are missing', () => {
  // A board row created by the SQL in supabase/schema.sql starts as '{}'.
  const merged = normalizeConfig({});
  assert.equal(merged.admin.passcodeHash, null, 'a new board has no passcode yet');
  assert.equal(merged.masjid.name, DEFAULT_CONFIG.masjid.name);
  assert.ok(Array.isArray(merged.slides) && merged.slides.length > 0);
});

test('a stored passcode survives a round trip through the shared settings', () => {
  const incoming = { admin: { passcodeHash: 'a'.repeat(64), hint: 'the year' } };
  const merged = normalizeConfig(incoming);
  assert.equal(merged.admin.passcodeHash, 'a'.repeat(64));
  assert.equal(merged.admin.hint, 'the year');
});

test('rubbish from the network cannot produce an unrenderable board', () => {
  const merged = normalizeConfig({
    admin: 'not an object',
    slides: null,
    announcements: 'nope',
    location: { latitude: 'south' },
  });
  assert.ok(Array.isArray(merged.slides) && merged.slides.length > 0);
  assert.ok(Array.isArray(merged.announcements));
  assert.equal(merged.location.latitude, 0, 'an unparseable coordinate falls back');
});
