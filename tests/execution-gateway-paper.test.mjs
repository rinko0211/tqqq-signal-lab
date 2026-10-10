import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePaperOrderIntent} from '../lib/execution-gateway-paper.mjs';

function fixture() {
  const generatedAt='2026-10-10T01:51:14.625Z';
  return {
    observedAt:'2026-10-10T09:00:00.000Z',
    signal:{generatedAt,dataDate:'2026-10-09',platformMode:'RESEARCH',state:'latest',assetTicker:'TQQQ',strategyVersion:'VS13-v1.0',signal:{date:'2026-10-09',target:0.25,executionDate:'2026-10-12'}},
    status:{generatedAt,marketDataDate:'2026-10-09',signalDate:'2026-10-09',actionStatus:'success',state:'latest',errors:[]},
    production:{mode:'RESEARCH',approvedByHuman:false,selectedTicker:null},
    session:{completedDataDate:'2026-10-09',nextLegalOpenDate:'2026-10-12'},
    snapshot:{source:'OFFLINE_PAPER_FIXTURE',accountType:'PAPER',currency:'USD',asOf:'2026-10-10T08:00:00.000Z',accountId:'paper-1',netLiquidationUSD:10000,settledCashUSD:10000,currentTqqqShares:0,pendingOrders:0},
    quote:{ticker:'TQQQ',priceUSD:81.28,asOf:'2026-10-10T01:51:14.625Z'},
    policy:{mode:'PAPER_ONLY',killSwitch:false,allowlist:['TQQQ'],maxOrderNotionalUSD:3000,maxPositionNotionalUSD:3000,maxPositionFraction:0.3},
    priorIntentIds:[],
  };
}
function checkReject(mutate, expected) {
  const x=fixture(); mutate(x); const result=evaluatePaperOrderIntent(x);
  assert.equal(result.status,'REJECTED'); assert.equal(result.reason,expected);
  assert.equal(result.brokerOrderAllowed,false); assert.equal(result.intent,null);
}

test('bounded deterministic offline paper intent, never broker authority', () => {
  const a=evaluatePaperOrderIntent(fixture()), b=evaluatePaperOrderIntent(fixture());
  assert.equal(a.status,'PAPER_INTENT');
  assert.deepEqual(a,b); assert.equal(a.brokerOrderAllowed,false);
  assert.equal(a.executionAuthority,'NONE'); assert.equal(a.intent.mode,'PAPER_ONLY');
  assert.equal(a.intent.side,'BUY'); assert.equal(a.intent.quantity,30);
  assert.equal(a.intent.estimatedNotionalUSD,2438.4);
});
test('default-deny missing policy',()=>checkReject(x=>{delete x.policy},'PAPER_MODE_REQUIRED'));
test('reject live policy',()=>checkReject(x=>{x.policy.mode='LIVE'},'PAPER_MODE_REQUIRED'));
test('kill switch defaults on',()=>checkReject(x=>{delete x.policy.killSwitch},'KILL_SWITCH_ACTIVE'));
test('reject PRODUCTION authority',()=>checkReject(x=>{x.production.mode='PRODUCTION'},'PRODUCTION_AUTHORITY_NOT_ALLOWED'));
test('reject human-approved flag',()=>checkReject(x=>{x.production.approvedByHuman=true},'PRODUCTION_AUTHORITY_NOT_ALLOWED'));
test('reject mixed signal/status generations',()=>checkReject(x=>{x.status.generatedAt='2026-10-10T01:50:00.000Z'},'GENERATION_MISMATCH'));
test('reject unsuccessful upstream',()=>checkReject(x=>{x.status.actionStatus='failure'},'INVALID_UPSTREAM_STATUS'));
test('reject missing status error evidence',()=>checkReject(x=>{delete x.status.errors},'INVALID_UPSTREAM_STATUS'));
test('reject UPRO',()=>checkReject(x=>{x.signal.assetTicker='UPRO'},'UNAPPROVED_ASSET_OR_STRATEGY'));
test('reject arbitrary target',()=>checkReject(x=>{x.signal.signal.target=0.3},'INVALID_SIGNAL_TARGET'));
test('reject mismatched next exchange session',()=>checkReject(x=>{x.session.nextLegalOpenDate='2026-10-13'},'MARKET_CALENDAR_MISMATCH'));
test('reject when execution UTC date reached',()=>checkReject(x=>{x.observedAt='2026-10-12T00:00:00.000Z'},'EXECUTION_DATE_REACHED_OR_EXPIRED'));
test('reject too-old signal',()=>checkReject(x=>{x.signal.generatedAt='2026-10-01T00:00:00.000Z';x.status.generatedAt=x.signal.generatedAt},'STALE_OR_FUTURE_SIGNAL'));
test('reject non-paper account',()=>checkReject(x=>{x.snapshot.accountType='CASH'},'INVALID_PAPER_SNAPSHOT'));
test('reject pending orders',()=>checkReject(x=>{x.snapshot.pendingOrders=1},'INVALID_OR_UNRECONCILED_SNAPSHOT'));
test('reject missing duplicate evidence',()=>checkReject(x=>{delete x.priorIntentIds},'INVALID_DEDUPE_EVIDENCE'));
test('reject repeated logical intent',()=>{
  const x=fixture();x.priorIntentIds=[evaluatePaperOrderIntent(x).intent.intentId];
  assert.equal(evaluatePaperOrderIntent(x).reason,'DUPLICATE_INTENT');
});
test('reject over order cap',()=>checkReject(x=>{x.policy.maxOrderNotionalUSD=2000},'ORDER_NOTIONAL_LIMIT'));
test('reject over position limit',()=>checkReject(x=>{x.policy.maxPositionFraction=.20},'POSITION_LIMIT'));
test('reject insufficient paper settled cash',()=>checkReject(x=>{x.snapshot.settledCashUSD=2400},'INSUFFICIENT_SETTLED_PAPER_CASH'));
test('reject invalid quote',()=>checkReject(x=>{x.quote.priceUSD=NaN},'INVALID_OR_STALE_PAPER_QUOTE'));
test('reject negative cash',()=>checkReject(x=>{x.snapshot.settledCashUSD=-1},'INVALID_OR_UNRECONCILED_SNAPSHOT'));
test('reject incoherent equity/cash/position',()=>checkReject(x=>{x.snapshot.netLiquidationUSD=1000},'INVALID_POSITION_VALUATION'));
test('already at target has no order intent',()=>{
  const x=fixture();x.snapshot.currentTqqqShares=30;x.snapshot.settledCashUSD=7561.6;
  const a=evaluatePaperOrderIntent(x);assert.equal(a.status,'NO_ACTION');assert.equal(a.intent,null);
});
test('sell is still only simulated',()=>{
  const x=fixture();x.signal.signal.target=0;x.snapshot.currentTqqqShares=30;x.snapshot.settledCashUSD=7500;
  const a=evaluatePaperOrderIntent(x);assert.equal(a.status,'PAPER_INTENT');assert.equal(a.intent.side,'SELL');
  assert.equal(a.intent.quantity,30);assert.equal(a.brokerOrderAllowed,false);
});
