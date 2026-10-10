import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  initializeOfflinePaperJournal, haltOfflinePaperJournal, reserveOfflinePaperIntent
} from '../lib/execution-gateway-journal.mjs';

function fixtures() {
  const generatedAt='2026-10-10T01:51:14.625Z';
  const input={
    observedAt:'2026-10-10T09:00:00.000Z',
    signal:{generatedAt,dataDate:'2026-10-09',platformMode:'RESEARCH',state:'latest',
      assetTicker:'TQQQ',strategyVersion:'VS13-v1.0',
      signal:{date:'2026-10-09',target:0.25,executionDate:'2026-10-12'}},
    status:{generatedAt,marketDataDate:'2026-10-09',signalDate:'2026-10-09',
      actionStatus:'success',state:'latest',errors:[]},
    production:{mode:'RESEARCH',approvedByHuman:false,selectedTicker:null},
    session:{completedDataDate:'2026-10-09',nextLegalOpenDate:'2026-10-12'},
    snapshot:{source:'OFFLINE_PAPER_FIXTURE',accountType:'PAPER',currency:'USD',
      asOf:'2026-10-10T08:00:00.000Z',accountId:'offline-fixture-account',
      netLiquidationUSD:10000,settledCashUSD:10000,currentTqqqShares:0,pendingOrders:0},
    quote:{ticker:'TQQQ',priceUSD:81.28,asOf:generatedAt},
    policy:{mode:'PAPER_ONLY',killSwitch:false,allowlist:['TQQQ'],
      maxOrderNotionalUSD:3000,maxPositionNotionalUSD:3000,maxPositionFraction:0.3},
    priorIntentIds:[],
  };
  return {input,offlineBrokerSnapshot:{...input.snapshot,source:'OFFLINE_BROKER_FIXTURE'}};
}
async function harness(t) {
  const parent=await mkdtemp(join(tmpdir(),'paper-gateway-v1-'));
  t.after(()=>rm(parent,{recursive:true,force:true}));
  const directory=join(parent,'ledger');
  await initializeOfflinePaperJournal(directory);
  return {directory,...fixtures()};
}
const reserve=c=>reserveOfflinePaperIntent(c);

test('new journal is explicitly PAPER_ONLY with no execution authority',async t=>{
  const x=await harness(t);
  assert.equal((await readFile(join(x.directory,'PAPER_ONLY_MANIFEST.json'),'utf8')).includes('"PAPER_ONLY"'),true);
  const a=await reserve(x);
  assert.equal(a.status,'PAPER_RESERVED');
  assert.equal(a.reason,'OFFLINE_JOURNAL_ONLY');
  assert.equal(a.executionAuthority,'NONE');
  assert.equal(a.brokerOrderAllowed,false);
  assert.equal(a.intent.mode,'PAPER_ONLY');
  assert.equal(a.intent.quantity,30);
  assert.equal(a.intent.brokerOrderAllowed,false);
});

test('replay across repeated calls is permanently rejected',async t=>{
  const x=await harness(t);assert.equal((await reserve(x)).status,'PAPER_RESERVED');
  const b=await reserve(x);assert.equal(b.status,'REJECTED');assert.equal(b.reason,'DUPLICATE_PAPER_SESSION');
  assert.equal(b.intent,null);assert.equal(b.brokerOrderAllowed,false);
});

test('reopening same local journal does not reset dedupe',async t=>{
  const x=await harness(t);await reserve(x);
  await assert.rejects(()=>initializeOfflinePaperJournal(x.directory),{code:'EEXIST'});
  assert.equal((await reserve(x)).reason,'DUPLICATE_PAPER_SESSION');
});

test('conflicting target on same account and execution session is rejected',async t=>{
  const x=await harness(t);assert.equal((await reserve(x)).status,'PAPER_RESERVED');
  x.input.signal.signal.target=0.5;
  x.input.policy.maxOrderNotionalUSD=10000;x.input.policy.maxPositionNotionalUSD=10000;x.input.policy.maxPositionFraction=1;
  assert.equal((await reserve(x)).reason,'CONFLICTING_PAPER_SESSION');
});

test('32 simultaneous in-process claims reserve only one session',async t=>{
  const x=await harness(t);
  const outcomes=await Promise.all(Array.from({length:32},()=>reserve(x)));
  assert.equal(outcomes.filter(z=>z.status==='PAPER_RESERVED').length,1);
  assert.equal(outcomes.filter(z=>z.status==='REJECTED' &&
    ['DUPLICATE_PAPER_SESSION','UNRESOLVED_JOURNAL_SLOT'].includes(z.reason)).length,31);
  // Another process can observe an exclusive but not-yet-fsynced slot.
  // Such a race must fail closed, then a subsequent attempt sees a duplicate.
  assert.equal((await reserve(x)).reason,'DUPLICATE_PAPER_SESSION');
});

function childClaim(x) {
  const program=String.raw`import {reserveOfflinePaperIntent} from './lib/execution-gateway-journal.mjs';
const x=JSON.parse(process.argv[1]);
const r=await reserveOfflinePaperIntent(x);
process.stdout.write(JSON.stringify(r));`;
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--input-type=module','-e',program,JSON.stringify(x)],
      {cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
    let out='',err='';
    child.stdout.on('data',b=>out+=b);
    child.stderr.on('data',b=>err+=b);
    child.on('error',reject);
    child.on('close',code=>{
      if(code!==0) return reject(new Error('child exited '+code+': '+err));
      try {resolve(JSON.parse(out));} catch(e) {reject(e);}
    });
  });
}
test('independent node processes cannot claim same local paper session twice',async t=>{
  const x=await harness(t);
  const outcomes=await Promise.all(Array.from({length:6},()=>childClaim(x)));
  assert.equal(outcomes.filter(z=>z.status==='PAPER_RESERVED').length,1);
  assert.equal(outcomes.filter(z=>z.status==='REJECTED' &&
    ['DUPLICATE_PAPER_SESSION','UNRESOLVED_JOURNAL_SLOT'].includes(z.reason)).length,5);
  assert.equal((await reserve(x)).reason,'DUPLICATE_PAPER_SESSION');
});
test('corrupt persisted claim becomes permanent unresolved barrier',async t=>{
  const x=await harness(t);await reserve(x);
  const claim=(await readdir(x.directory)).find(f=>/^[a-f0-9]{64}\.json$/.test(f));
  assert.ok(claim);
  await writeFile(join(x.directory,claim),'');
  assert.equal((await reserve(x)).reason,'UNRESOLVED_JOURNAL_SLOT');
});
test('tampered recorded intent digest fails closed',async t=>{
  const x=await harness(t);await reserve(x);
  const claim=(await readdir(x.directory)).find(f=>/^[a-f0-9]{64}\.json$/.test(f));
  const p=join(x.directory,claim),obj=JSON.parse(await readFile(p,'utf8'));
  obj.record.intent.quantity=999999;await writeFile(p,JSON.stringify(obj));
  assert.equal((await reserve(x)).reason,'UNRESOLVED_JOURNAL_SLOT');
});
test('sticky HALT blocks existing valid session and future reservations',async t=>{
  const x=await harness(t);
  const h=await haltOfflinePaperJournal(x.directory,'OFFLINE_TEST');
  assert.equal(h.status,'HALTED');assert.equal(h.brokerOrderAllowed,false);
  assert.equal((await reserve(x)).reason,'KILL_SWITCH_LATCHED');
  assert.equal((await haltOfflinePaperJournal(x.directory)).reason,'KILL_SWITCH_LATCHED');
});
test('HALT is sticky across replay and no unlock API is exposed',async t=>{
  const x=await harness(t);await haltOfflinePaperJournal(x.directory);
  const again=await reserve(x);
  assert.equal(again.status,'HALTED');assert.equal(again.intent,null);
});
test('missing or corrupted manifest fails closed',async t=>{
  const x=await harness(t);await unlink(join(x.directory,'PAPER_ONLY_MANIFEST.json'));
  assert.equal((await reserve(x)).reason,'STORE_UNAVAILABLE');
  assert.equal((await haltOfflinePaperJournal(x.directory)).reason,'STORE_UNAVAILABLE');
});
test('invalid relative storage path is rejected',async()=>{
  const x=fixtures();assert.equal((await reserve({...x,directory:'./relative'})).reason,'STORE_UNAVAILABLE');
});
test('broker reconciliation detects wrong share count',async t=>{
  const x=await harness(t);x.offlineBrokerSnapshot.currentTqqqShares=1;
  assert.equal((await reserve(x)).reason,'MOCK_BROKER_RECONCILIATION_FAILED');
});
test('broker reconciliation detects pending orders',async t=>{
  const x=await harness(t);x.offlineBrokerSnapshot.pendingOrders=1;
  assert.equal((await reserve(x)).reason,'MOCK_BROKER_RECONCILIATION_FAILED');
});
test('broker reconciliation detects cash mismatch',async t=>{
  const x=await harness(t);x.offlineBrokerSnapshot.settledCashUSD=9900;
  assert.equal((await reserve(x)).reason,'MOCK_BROKER_RECONCILIATION_FAILED');
});
test('broker reconciliation detects identity substitution',async t=>{
  const x=await harness(t);x.offlineBrokerSnapshot.accountId='another';
  assert.equal((await reserve(x)).reason,'MOCK_BROKER_RECONCILIATION_FAILED');
});
test('broker reconciliation detects stale or unmatched snapshot time',async t=>{
  const x=await harness(t);x.offlineBrokerSnapshot.asOf='2026-10-09T02:00:00.000Z';
  assert.equal((await reserve(x)).reason,'MOCK_BROKER_RECONCILIATION_FAILED');
});
test('untrusted broker source cannot pass offline reconciliation',async t=>{
  const x=await harness(t);x.offlineBrokerSnapshot.source='REAL_BROKER';
  assert.equal((await reserve(x)).reason,'MOCK_BROKER_RECONCILIATION_FAILED');
});
test('upstream killSwitch cannot be bypassed by mock broker',async t=>{
  const x=await harness(t);x.input.policy.killSwitch=true;
  assert.equal((await reserve(x)).reason,'KILL_SWITCH_ACTIVE');
});
test('expired signal remains rejected before any disk claim',async t=>{
  const x=await harness(t);x.input.observedAt='2026-10-12T00:00:00.000Z';
  assert.equal((await reserve(x)).reason,'EXECUTION_DATE_REACHED_OR_EXPIRED');
  assert.equal((await readdir(x.directory)).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)).length,0);
});
test('no-action does not reserve an intent',async t=>{
  const x=await harness(t);
  x.input.snapshot.currentTqqqShares=30;x.input.snapshot.settledCashUSD=7561.6;
  x.offlineBrokerSnapshot.currentTqqqShares=30;x.offlineBrokerSnapshot.settledCashUSD=7561.6;
  assert.equal((await reserve(x)).status,'NO_ACTION');
  assert.equal((await readdir(x.directory)).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)).length,0);
});
test('bad Production promotion is rejected even in offline journal',async t=>{
  const x=await harness(t);x.input.production.mode='PRODUCTION';
  assert.equal((await reserve(x)).reason,'PRODUCTION_AUTHORITY_NOT_ALLOWED');
});
test('unapproved ticker and illiquid target cannot reserve',async t=>{
  const x=await harness(t);
  x.input.signal.assetTicker='UPRO';
  assert.equal((await reserve(x)).reason,'UNAPPROVED_ASSET_OR_STRATEGY');
});
