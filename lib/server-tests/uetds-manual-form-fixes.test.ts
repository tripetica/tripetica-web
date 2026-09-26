import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyDraft } from '../uetds/draft';
import { resolveOfficialUetdsLocation } from '../uetds/official-locations';
import { isOfficialUetdsLocationReady } from '../uetds/location';
import { loadUetdsFormDraft, saveUetdsFormDraft } from '../uetds/form-drafts';

test('manual new forms never read old persisted data or persist new data', async () => {
  const globalDb = globalThis as typeof globalThis & { tripeticaPgPool?: unknown };
  const previous = globalDb.tripeticaPgPool;
  globalDb.tripeticaPgPool = { query() { throw new Error('manual draft must not access DB'); } };
  try {
    const actor = { type: 'ops' as const, userId: '11111111-1111-4111-8111-111111111111', partnerId: null };
    const draft = createEmptyDraft('manual');
    draft.origin = 'Previous manual value';
    assert.deepEqual(await saveUetdsFormDraft({ actor, draft }), { ok: true });
    assert.equal(await loadUetdsFormDraft({ actor, reservationId: null }), null);
    assert.equal(await loadUetdsFormDraft({ actor }), null);
  } finally { globalDb.tripeticaPgPool = previous; }
});

for (const [name, city, code] of [
  ['İstanbul Havalimanı (IST)', 'İstanbul', '99157'],
  ['İstanbul Sabiha Gökçen Uluslararası Havalimanı', 'İstanbul', '99102'],
  ['Istanbul Sabiha Gokcen International Airport (SAW)', 'İstanbul', '99102'],
  ['Antalya Havalimanı (AYT)', 'Antalya', '99135'],
]) {
  test(`official airport mapping: ${name}`, () => {
    const location = resolveOfficialUetdsLocation({ placeName: name, details: { name, city, countryCode: 'TR', types: ['airport'] } });
    assert.equal(isOfficialUetdsLocationReady(location), true);
    assert.equal(location.locationType, 'airport');
    assert.equal(location.districtOrAirportCode, code);
  });
}
