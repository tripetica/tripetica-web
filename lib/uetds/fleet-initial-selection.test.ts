import test from 'node:test';
import assert from 'node:assert/strict';
import { initialUetdsFleetSelection as select, type UetdsFleetOption } from './fleet-options';
const empty = { driverId: '', vehicleId: '' };
function option(id: string, companyId = 'a'): UetdsFleetOption {
  return { id, label: id, partnerId: 'partner', uetdsCompanyId: companyId, hasNationalId: true,
    company: { id: companyId, shortName: companyId, status: 'active', integrationStatus: 'ready' } };
}
test('empty lists remain empty; either fleet can be selected independently', () => {
  assert.deepEqual(select(empty, [], []), empty);
  assert.deepEqual(select(empty, [option('d')], []), { driverId: 'd', vehicleId: '' });
  assert.deepEqual(select(empty, [], [option('v')]), { driverId: '', vehicleId: 'v' });
});
test('first eligible driver and matching vehicle follow existing list order', () => {
  assert.deepEqual(select(empty, [option('d2'), option('d1')], [option('v-other','b'),option('v2'),option('v1')]), { driverId: 'd2', vehicleId: 'v2' });
});
test('inactive/not-ready/missing company and missing driver identity are skipped', () => {
  const inactive = option('inactive'); inactive.company!.status = 'inactive';
  const unready = option('unready'); unready.company!.integrationStatus = 'incomplete';
  const missing = option('missing'); missing.company = null;
  const identity = option('identity'); identity.hasNationalId = false;
  const invalid = [inactive, unready, missing];
  assert.deepEqual(select(empty, [...invalid,identity,option('d')], [...invalid,option('v')]), { driverId: 'd', vehicleId: 'v' });
  assert.deepEqual(select(empty, [...invalid,identity], invalid), empty);
});
test('explicit and reservation IDs are retained, including IDs absent from lists', () => {
  const chosen = {driverId:'reserved-driver',vehicleId:'reserved-vehicle'};
  assert.deepEqual(select(chosen, [option('d')], [option('v')]), chosen);
  assert.deepEqual(select({driverId:'d-b',vehicleId:''}, [option('d'),option('d-b','b')], [option('v'),option('v-b','b')]), {driverId:'d-b',vehicleId:'v-b'});
  assert.deepEqual(select({driverId:'',vehicleId:'v-b'}, [option('d'),option('d-b','b')], [option('v-b','b')]), {driverId:'d-b',vehicleId:'v-b'});
  assert.deepEqual(select({driverId:'unknown',vehicleId:''}, [option('d')], [option('v')]), {driverId:'unknown',vehicleId:''});
});
test('never automatically select a mismatched or inconsistent company', () => {
  assert.deepEqual(select(empty, [option('d')], [option('v','b')]), {driverId:'d',vehicleId:''});
  const broken = option('broken'); broken.uetdsCompanyId = 'b';
  assert.deepEqual(select(empty, [broken], [broken]), empty);
});
