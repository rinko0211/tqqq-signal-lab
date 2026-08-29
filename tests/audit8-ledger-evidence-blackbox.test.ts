import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {updateProductionHealthLedger,type ProductionHealthLedger} from "../lib/production-health-review.ts";
import {updatePhase5LedgerSubset,type Phase5Ledger} from "../lib/phase5-forward.ts";

/* Audit 8 independent ledger/evidence black-box discovery.
 * Expected outputs are literal fixture contracts. This file does not import
 * market-calendar helpers, Production transition/validation helpers, Lifecycle
 * selection helpers, or ledger-integrity validators to compute expectations.
 * Product functions under test may use those internals.
 */

const UPRO={ticker:"UPRO",strategy:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0"};
const SSO={ticker:"SSO",strategy:"SSO + S&P Broad Trend + scaled stop",version:"SSO-SPBT-Scaled-v1.0"};

const production=(x:{ticker:string;strategy:string;version:string;approvalDate:string;effectiveDate:string;nextHealthReview:string})=>({
  schemaVersion:1 as const,mode:"PRODUCTION" as const,selectedTicker:x.ticker,selectedStrategy:x.strategy,strategyVersion:x.version,
  approvedByHuman:true,approvalDate:x.approvalDate,effectiveDate:x.effectiveDate,lastHealthReview:null,nextHealthReview:x.nextHealthReview,
  updatedAt:`${x.approvalDate}T21:00:00.000Z`,
});
const lifecycleFor=(version:string,state:"Healthy"|"Watch"|"Revalidation Required"|"Critical"="Healthy")=>({
  current:{productionHealth:{state,version,reasons:[state==="Healthy"?"fixture healthy":"fixture degraded"],nextHealthReview:null}}
}) as any;

const healthLedger=(events:ProductionHealthLedger["events"]):ProductionHealthLedger=>({
  schemaVersion:1,createdAt:"2027-08-25T21:00:00.000Z",updatedAt:"2028-04-10T21:00:00.000Z",appendOnly:true,events:structuredClone(events),
  current:{active:false,version:null,lastReview:null,nextReview:null,state:"NOT_ACTIVE",userAction:"NONE",message:"fixture"},
});

test("A8 ledger black-box: stale multi-quarter Health cursor skips retrospective fabrication",()=>{
  const p=production({...UPRO,approvalDate:"2027-08-25",effectiveDate:"2027-08-25",nextHealthReview:"2027-11-25"});
  const prior=healthLedger([{key:`${UPRO.version}|2027-11-25`,dueDate:"2027-11-25",recordedAt:"2027-12-10T21:01:00.000Z",version:UPRO.version,state:"Healthy",timing:"LATE_CURRENT_STATE_ONLY",reasons:["prior late current-state review"]}]);
  const before=structuredClone(prior.events);
  const out=updateProductionHealthLedger({production:p,lifecycle:lifecycleFor(UPRO.version),prior,now:"2028-08-25T21:01:00.000Z"});
  assert.deepEqual(out.events,before,"stale cursor must not fabricate quarterly historical states");
  assert.equal(out.current.lastReview,"2027-11-25");
  assert.equal(out.current.nextReview,"2028-11-25");
  assert.equal(out.current.state,"Healthy");
  assert.equal(out.current.userAction,"NONE");
});

test("A8 ledger black-box: A→B→A keeps old evidence append-only but starts a fresh A episode cursor",()=>{
  const oldA={key:`${UPRO.version}|2027-11-25`,dueDate:"2027-11-25",recordedAt:"2027-11-26T21:01:00.000Z",version:UPRO.version,state:"Healthy" as const,timing:"ON_TIME" as const,reasons:["old A episode"]};
  const oldB={key:`${SSO.version}|2028-04-10`,dueDate:"2028-04-10",recordedAt:"2028-04-10T21:01:00.000Z",version:SSO.version,state:"Healthy" as const,timing:"ON_TIME" as const,reasons:["B episode"]};
  const prior=healthLedger([oldA,oldB]);
  const p=production({...UPRO,approvalDate:"2028-04-10",effectiveDate:"2028-04-10",nextHealthReview:"2028-07-10"});
  const out=updateProductionHealthLedger({production:p,lifecycle:lifecycleFor(UPRO.version),prior,now:"2028-07-10T21:01:00.000Z"});
  assert.equal(out.events.length,3);
  assert.deepEqual(out.events.slice(0,2),[oldA,oldB],"A→B history must remain byte-for-value append-only evidence");
  assert.equal(out.events[2].key,`${UPRO.version}|2028-07-10`);
  assert.equal(out.events[2].dueDate,"2028-07-10");
  assert.equal(out.events[2].timing,"ON_TIME");
  assert.equal(out.current.version,UPRO.version);
  assert.equal(out.current.lastReview,"2028-07-10");
  assert.equal(out.current.nextReview,"2028-10-10");
});

const market=JSON.parse(fs.readFileSync("github-pages/public/data/market-data.json","utf8"));
const authoritative=JSON.parse(fs.readFileSync("github-pages/public/data/phase-5-forward-ledger.json","utf8")) as Phase5Ledger;
const scaleBars=(rows:any[],scale:number)=>rows.map(x=>({...x,open:x.open*scale,high:x.high*scale,low:x.low*scale,close:x.close*scale,adjClose:(x.adjClose??x.close)*scale}));
const priorClose=(version:string)=>authoritative.records.find(r=>r.strategyVersion===version&&r.marketDataDate==="2026-08-26")!.assetClose;
const sourceClose=(ticker:"SPY"|"QQQ")=>market.series[ticker].find((r:any)=>r.date==="2026-08-26").close;
const payloadThrough=(date:string)=>{
  const base=Object.fromEntries(Object.entries(market.series).map(([ticker,rows])=>[ticker,(rows as any[]).filter(r=>r.date<=date)])) as Record<string,any[]>;
  base.UPRO=scaleBars(base.SPY,priorClose(UPRO.version)/sourceClose("SPY"));
  base.SSO=scaleBars(base.SPY,priorClose(SSO.version)/sourceClose("SPY"));
  base.QLD=scaleBars(base.QQQ,priorClose("QLD-VS13-Scaled-v1.0")/sourceClose("QQQ"));
  return{source:"Audit 8 external market fixture",retrievedAt:`${date}T22:00:00.000Z`,series:base};
};

test("A8 ledger black-box: one Phase5 system failure is isolated and retry catches up only that system",()=>{
  let ledger=structuredClone(authoritative);
  ledger.records=ledger.records.filter(r=>r.marketDataDate<="2026-08-26");
  ledger.updatedAt="2026-08-27T04:03:42.439Z";

  const degraded=payloadThrough("2026-08-27") as any;
  delete degraded.series.SSO;

  ledger=updatePhase5LedgerSubset(degraded,ledger,[UPRO.version],"2026-08-28T01:00:00.000Z");
  ledger=updatePhase5LedgerSubset(degraded,ledger,["QLD-VS13-Scaled-v1.0"],"2026-08-28T01:00:00.000Z");
  const beforeFailed=structuredClone(ledger);
  assert.throws(()=>updatePhase5LedgerSubset(degraded,ledger,[SSO.version],"2026-08-28T01:00:00.000Z"),/missing series for SSO/);
  assert.deepEqual(ledger,beforeFailed,"failed subsystem attempt must not mutate supplied prior ledger");

  const peerBefore=ledger.records.filter(r=>r.strategyVersion!==SSO.version).map(r=>structuredClone(r));
  const recovered=payloadThrough("2026-08-27");
  ledger=updatePhase5LedgerSubset(recovered,ledger,[SSO.version],"2026-08-28T02:00:00.000Z");
  const peerAfter=ledger.records.filter(r=>r.strategyVersion!==SSO.version);
  assert.deepEqual(peerAfter,peerBefore,"SSO retry may not rewrite already-valid peer history");
  assert.equal(ledger.records.filter(r=>r.strategyVersion===SSO.version).at(-1)?.marketDataDate,"2026-08-27");
  assert.equal(new Set(ledger.records.map(r=>r.key)).size,ledger.records.length,"subset recovery must not duplicate logical records");
});
