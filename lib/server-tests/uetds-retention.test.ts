import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { filterUetdsList, parseUetdsListFilters, uetdsTripTimestamp, isUetdsRetentionExpired } from '../uetds/list-policy';
import { deleteExpiredUetdsNotifications } from '../uetds/retention';
import type { UetdsNotificationListItem } from '../uetds/notification-view';
const end = uetdsTripTimestamp('2026-09-21', '18:00')!;
const item = { id:'fixture', status:'submitted', endTimestamp:end, startTimestamp:end-3600000, createdAt:new Date(end).toISOString() } as UetdsNotificationListItem;

test('Istanbul +6h boundary moves from current/completed to archive without state changes', () => {
  const before = end+6*3600000-1;
  assert.equal(filterUetdsList([item],parseUetdsListFilters(),before).length,1);
  assert.equal(filterUetdsList([item],parseUetdsListFilters({status:'completed'}),before).length,1);
  assert.equal(filterUetdsList([item],parseUetdsListFilters({status:'archive'}),before).length,0);
  const midnight = uetdsTripTimestamp('2026-09-22','00:00')!;
  for(const status of ['active','completed','cancelled','all']) assert.equal(filterUetdsList([item],parseUetdsListFilters({status}),midnight).length,0);
  assert.equal(filterUetdsList([item],parseUetdsListFilters({status:'archive'}),midnight).length,1);
  assert.equal(item.status,'submitted');
});
test('30-day strict cutoff and malformed dates fail closed', () => {
  const cutoff = uetdsTripTimestamp('2026-10-21','18:00')!;
  assert.equal(isUetdsRetentionExpired(end,cutoff),false);
  assert.equal(isUetdsRetentionExpired(end,cutoff+1),true);
  assert.equal(isUetdsRetentionExpired(null,cutoff),false);
  assert.equal(uetdsTripTimestamp('2026-02-30','18:00'),null);
});

test('retention deletes only eligible notification IDs, commits, and never calls network', async () => {
  const globalDb = globalThis as typeof globalThis & { tripeticaPgPool?: unknown };
  const original = globalDb.tripeticaPgPool;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw Error('NETWORK_FORBIDDEN'); };
  const calls: string[] = []; let batch=0; let released=false;
  globalDb.tripeticaPgPool = { connect: async () => ({
    query: async (sql:string, values?:unknown[]) => {
      calls.push(sql);
      if(sql.startsWith('SELECT')) return { rows: batch++ ? [] : [
        {id:'expired',end_date:'2026-09-21',end_time:'17:59'},
        {id:'boundary',end_date:'2026-09-21',end_time:'18:00'},
        {id:'future',end_date:'2026-09-22',end_time:'18:00'},
        {id:'invalid',end_date:'2026-02-30',end_time:'18:00'},
      ] };
      if(sql.startsWith('DELETE')) {assert.equal(sql,'DELETE FROM uetds_notifications WHERE id = ANY($1::uuid[]) RETURNING id');assert.deepEqual(values,[['expired']]);return {rowCount:1};}
      assert.ok(['BEGIN','COMMIT','ROLLBACK'].includes(sql));return {rows:[]};
    }, release(){released=true;},
  }) };
  try {
    assert.deepEqual(await deleteExpiredUetdsNotifications(uetdsTripTimestamp('2026-10-21','18:00')!),{deleted:1});
    assert.equal(calls.filter(x=>x.startsWith('DELETE')).length,1);
    assert.ok(calls.includes('COMMIT'));assert.equal(released,true);
    const ddl=readFileSync('db/migrations/058_uetds_notification_manage.sql','utf8');
    assert.match(ddl,/notification_id UUID NOT NULL REFERENCES uetds_notifications \(id\) ON DELETE CASCADE/);
  } finally {globalDb.tripeticaPgPool=original;globalThis.fetch=originalFetch;}
});

test('retention dependency graph cannot reach Ministry/manual cancellation/network modules', () => {
  const seen=new Set<string>();
  function visit(file:string){
    if(seen.has(file))return;seen.add(file);
    const source=readFileSync(file,'utf8');
    assert.doesNotMatch(source,/\bfetch\s*\(|\bimport\s*\(|\brequire\s*\(/);
    const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
    for(const statement of ast.statements){
      if(!ts.isImportDeclaration(statement)||statement.importClause?.isTypeOnly)continue;
      const name=(statement.moduleSpecifier as ts.StringLiteral).text;
      assert.doesNotMatch(name,/ministry|delete-notifications|\/manage|notification-actions|openai|https?:/);
      if(name.startsWith('@/'))visit(path.resolve(name.slice(2)+'.ts'));
      else if(name.startsWith('.'))visit(path.resolve(path.dirname(file),name+'.ts'));
      else assert.ok(['server-only','pg'].includes(name),name);
    }
  }
  visit(path.resolve('lib/uetds/retention.ts'));
});

test('retention rolls back and releases its connection on deletion failure', async () => {
  const globalDb = globalThis as typeof globalThis & { tripeticaPgPool?: unknown };
  const original=globalDb.tripeticaPgPool;
  const calls:string[]=[];let released=false;
  globalDb.tripeticaPgPool={connect:async()=>({query:async(sql:string)=>{
    calls.push(sql);
    if(sql.startsWith('SELECT'))return {rows:[{id:'fixture',end_date:'2026-09-21',end_time:'18:00'}]};
    if(sql.startsWith('DELETE'))throw Error('fixture-delete-failure');
    return {rows:[]};
  },release(){released=true;}})};
  try {
    await assert.rejects(deleteExpiredUetdsNotifications(end+31*86400000),/fixture-delete-failure/);
    assert.ok(calls.includes('ROLLBACK'));assert.ok(!calls.includes('COMMIT'));assert.equal(released,true);
  }finally{globalDb.tripeticaPgPool=original;}
});
