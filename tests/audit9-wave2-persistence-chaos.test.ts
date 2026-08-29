import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {updateForwardLedger,type ForwardLedger} from "../lib/forward.ts";
import {emptyPhase5Ledger,summarizePhase5,updatePhase5LedgerSubset,type Phase5Ledger} from "../lib/phase5-forward.ts";
import {updateProductionHealthLedger,type ProductionHealthLedger} from "../lib/production-health-review.ts";

/* Audit 9 Wave 2 — temporal append-only / persistence / recovery chaos.
 * Expected behavior is expressed as sequence invariants over persisted prefixes.
 * This test does not import ledger validators or market-calendar helpers to form
 * the expected result. Product update entrypoints may use those internals.
 */

const UPRO="UPRO-SPBT-v1.0",SSO="SSO-SPBT-Scaled-v1.0",QLD="QLD-VS13-Scaled-v1.0";
const market=JSON.parse(fs.readFileSync("github-pages/public/data/market-data.json","utf8"));
const phase5Authoritative=JSON.parse(fs.readFileSync("github-pages/public/data/phase-5-forward-ledger.json","utf8")) as Phase5Ledger;
const forwardAuthoritative=JSON.parse(fs.readFileSync("public/data/forward-ledger.json","utf8")) as ForwardLedger;
const clone=<T>(x:T):T=>structuredClone(x);

const scaleBars=(rows:any[],scale:number)=>rows.map(x=>({...x,open:x.open*scale,high:x.high*scale,low:x.low*scale,close:x.close*scale,adjClose:(x.adjClose??x.close)*scale}));
const p5PriorClose=(version:string,date="2026-08-26")=>phase5Authoritative.records.find(r=>r.strategyVersion===version&&r.marketDataDate===date)!.assetClose;
const sourceClose=(ticker:"SPY"|"QQQ",date="2026-08-26")=>market.series[ticker].find((r:any)=>r.date===date).close;
function phase5PayloadThrough(date:string){
  const base=Object.fromEntries(Object.entries(market.series).map(([ticker,rows])=>[ticker,(rows as any[]).filter(r=>r.date<=date)])) as Record<string,any[]>;
  base.UPRO=scaleBars(base.SPY,p5PriorClose(UPRO)/sourceClose("SPY"));
  base.SSO=scaleBars(base.SPY,p5PriorClose(SSO)/sourceClose("SPY"));
  base.QLD=scaleBars(base.QQQ,p5PriorClose(QLD)/sourceClose("QQQ"));
  return{source:"Audit 9 external persistence fixture",retrievedAt:`${date}T22:00:00.000Z`,series:base};
}
function forwardDatasetThrough(date:string){
  const maps=Object.fromEntries(["TQQQ","QQQ","SPY","VIX"].map(t=>[t,new Map((market.series[t] as any[]).filter(r=>r.date<=date).map(r=>[r.date,r]))])) as Record<string,Map<string,any>>;
  const dates=(market.series.TQQQ as any[]).map(r=>r.date).filter((d:string)=>d<=date&&maps.QQQ.has(d)&&maps.SPY.has(d)&&maps.VIX.has(d));
  const meta=(ticker:string)=>{const rows=dates.map(d=>maps[ticker].get(d));return{start:rows[0]?.date||"",end:rows.at(-1)?.date||"",count:rows.length,adjusted:false}};
  return{days:dates.map(date=>({date,tqqq:maps.TQQQ.get(date),qqq:maps.QQQ.get(date),spy:maps.SPY.get(date),vix:maps.VIX.get(date)})),issues:[],source:"auto",precision:"next-open",retrievedAt:`${date}T22:00:00.000Z`,provider:"Audit 9 external persistence fixture",tickers:{TQQQ:meta("TQQQ"),QQQ:meta("QQQ"),SPY:meta("SPY"),VIX:meta("VIX")}} as any;
}
function retryPhase5(input:Phase5Ledger,attempts:number){let ledger=clone(input),rejected=false;for(let n=0;n<attempts;n++){try{ledger=updatePhase5LedgerSubset(phase5PayloadThrough("2026-08-27") as any,ledger,[UPRO],`2026-08-28T0${n}:00:00.000Z`)}catch{rejected=true;break}}return{ledger,rejected}}

test("Audit 9 Wave 2 mechanism remains sequence-level and does not import integrity validators",()=>{
  const imports=fs.readFileSync("tests/audit9-wave2-persistence-chaos.test.ts","utf8").split("\n").filter(x=>x.startsWith("import ")).join("\n");
  for(const forbidden of ["market-calendar","assertPhase5LedgerInternalIntegrity","assertForwardLedgerInternalIntegrity","assertProductionHealthLedgerInternalIntegrity"])assert.doesNotMatch(imports,new RegExp(forbidden));
});

test("Audit 9 Wave 2 T04/T10: Phase5 prefix truncation cannot survive a retry sequence",()=>{
  const bad=clone(phase5Authoritative),first=bad.records.findIndex(r=>r.strategyVersion===UPRO);assert.ok(first>=0);bad.records.splice(first,1);const prefixKeys=bad.records.map(r=>r.key),result=retryPhase5(bad,5);
  assert.equal(result.rejected,true);assert.deepEqual(bad.records.map(r=>r.key),prefixKeys);
});

test("Audit 9 Wave 2 T04/T08/T10: Phase5 future record chronology cannot survive repeated recovery attempts",()=>{
  const bad=clone(phase5Authoritative);bad.records[0].recordedAt="2030-01-02T21:00:00.000Z";bad.updatedAt="2026-08-27T04:03:42.439Z";assert.equal(retryPhase5(bad,5).rejected,true);
});

test("Audit 9 Wave 2 M01 refinement: a legitimate source gap becomes explicit immutable coverage evidence",()=>{
  const payload=phase5PayloadThrough("2026-08-27") as any;
  payload.series.UPRO=payload.series.UPRO.filter((r:any)=>r.date!=="2026-08-26");
  let ledger=updatePhase5LedgerSubset(payload,emptyPhase5Ledger("2026-08-25T15:15:00.000Z"),[UPRO],"2026-08-27T22:00:00.000Z");
  const rows=ledger.records.filter(r=>r.strategyVersion===UPRO&&r.marketDataDate>="2026-08-25");
  const gaps=(ledger.coverageGaps??[]).filter(g=>g.strategyVersion===UPRO);
  assert.deepEqual(rows.map(r=>r.marketDataDate),["2026-08-25","2026-08-27"]);
  assert.deepEqual(gaps.map(g=>g.marketDataDate),["2026-08-26"]);
  assert.equal(gaps[0].reason,"SOURCE_DATA_MISSING");
  const summary=summarizePhase5(ledger).find(x=>x.version===UPRO)!;
  assert.equal(summary.liveObservations,1);assert.equal(summary.missing,2,"one backfilled observation plus one explicit gap remain missing evidence");
  const snapshot=clone(ledger);
  for(let n=0;n<5;n++)ledger=updatePhase5LedgerSubset(payload,ledger,[UPRO],`2026-08-28T0${n}:00:00.000Z`);
  assert.deepEqual(ledger.records,snapshot.records,"retry must not rewrite real observations");
  assert.deepEqual(ledger.coverageGaps,snapshot.coverageGaps,"retry must not erase or rewrite gap evidence");
});

test("Audit 9 Wave 2 M01 refinement: deleting gap evidence or creating record+gap conflict fails before retry can bless it",()=>{
  const payload=phase5PayloadThrough("2026-08-27") as any;payload.series.UPRO=payload.series.UPRO.filter((r:any)=>r.date!=="2026-08-26");
  const valid=updatePhase5LedgerSubset(payload,emptyPhase5Ledger("2026-08-25T15:15:00.000Z"),[UPRO],"2026-08-27T22:00:00.000Z");
  const removed=clone(valid);removed.coverageGaps=removed.coverageGaps!.filter(g=>!(g.strategyVersion===UPRO&&g.marketDataDate==="2026-08-26"));
  assert.throws(()=>updatePhase5LedgerSubset(payload,removed,[UPRO],"2026-08-28T01:00:00.000Z"),/incomplete coverage|missing coverage/i);
  const conflict=clone(valid),r=conflict.records.find(x=>x.strategyVersion===UPRO&&x.marketDataDate==="2026-08-25")!;
  conflict.coverageGaps!.push({key:`${UPRO}|2026-08-25|GAP`,strategyVersion:UPRO,marketDataDate:"2026-08-25",recordedAt:r.recordedAt,reason:"SOURCE_DATA_MISSING"});
  conflict.coverageGaps!.sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)||a.strategyVersion.localeCompare(b.strategyVersion));
  assert.throws(()=>updatePhase5LedgerSubset(payload,conflict,[UPRO],"2026-08-28T01:00:00.000Z"),/conflicting coverage|duplicate/i);
});

test("Audit 9 Wave 2 T04/T10: Forward prefix and chronology corruption reject, then clean recovery preserves the valid prefix",()=>{
  const ds=forwardDatasetThrough("2026-08-27"),prefixBad=clone(forwardAuthoritative);prefixBad.records.splice(0,1);assert.throws(()=>updateForwardLedger(ds,prefixBad,"Audit9","2026-08-28T01:00:00.000Z"),/integrity|incomplete|history|missing/i);
  const timeBad=clone(forwardAuthoritative);timeBad.records[0].recordedAt="2030-01-02T21:00:00Z";assert.throws(()=>updateForwardLedger(ds,timeBad,"Audit9","2026-08-28T01:00:00.000Z"),/chronology|generation|integrity/i);
  const validPrefix=clone(forwardAuthoritative.records);let recovered=updateForwardLedger(ds,clone(forwardAuthoritative),"Audit9","2026-08-28T01:00:00.000Z");for(let n=0;n<5;n++)recovered=updateForwardLedger(ds,recovered,"Audit9",`2026-08-28T0${n+2}:00:00.000Z`);
  assert.deepEqual(recovered.records.slice(0,validPrefix.length),validPrefix);assert.ok(recovered.records.length>=validPrefix.length);assert.equal(new Set(recovered.records.map(r=>r.key)).size,recovered.records.length);
});

test("Audit 9 Wave 2 T05/T06: repeated one-system failures do not mutate peers and recovery is exactly once",()=>{
  let ledger=clone(phase5Authoritative);ledger.records=ledger.records.filter(r=>r.marketDataDate<="2026-08-26");ledger.updatedAt="2026-08-27T04:03:42.439Z";const degraded=phase5PayloadThrough("2026-08-27") as any;delete degraded.series.SSO;
  ledger=updatePhase5LedgerSubset(degraded,ledger,[UPRO],"2026-08-28T01:00:00.000Z");ledger=updatePhase5LedgerSubset(degraded,ledger,[QLD],"2026-08-28T01:00:00.000Z");const beforeFailures=clone(ledger);
  for(let n=0;n<12;n++){assert.throws(()=>updatePhase5LedgerSubset(degraded,ledger,[SSO],`2026-08-28T02:${String(n).padStart(2,"0")}:00.000Z`),/missing series for SSO/);assert.deepEqual(ledger,beforeFailures)}
  const peerBefore=ledger.records.filter(r=>r.strategyVersion!==SSO).map(r=>clone(r)),recoveredPayload=phase5PayloadThrough("2026-08-27");ledger=updatePhase5LedgerSubset(recoveredPayload,ledger,[SSO],"2026-08-28T03:00:00.000Z");for(let n=0;n<8;n++)ledger=updatePhase5LedgerSubset(recoveredPayload,ledger,[SSO],`2026-08-28T04:${String(n).padStart(2,"0")}:00.000Z`);
  assert.deepEqual(ledger.records.filter(r=>r.strategyVersion!==SSO),peerBefore);assert.equal(new Set(ledger.records.map(r=>r.key)).size,ledger.records.length);assert.equal(ledger.records.filter(r=>r.strategyVersion===SSO).at(-1)?.marketDataDate,"2026-08-27");
});

const production={schemaVersion:1 as const,mode:"PRODUCTION" as const,selectedTicker:"UPRO",selectedStrategy:"UPRO + S&P Broad Trend",strategyVersion:UPRO,approvedByHuman:true,approvalDate:"2027-08-25",effectiveDate:"2027-08-25",lastHealthReview:null,nextHealthReview:"2027-11-25",updatedAt:"2027-08-25T21:00:00.000Z"};
const lifecycle={current:{productionHealth:{state:"Healthy",version:UPRO,reasons:["sequence healthy"],nextHealthReview:null}}} as any;

test("Audit 9 Wave 2 T05/T11: Health late recovery collapses only already-missed quarters and normal recurrence resumes",()=>{
  let ledger:ProductionHealthLedger|undefined;
  ledger=updateProductionHealthLedger({production,lifecycle,prior:ledger,now:"2027-11-26T21:01:00.000Z"});assert.equal(ledger.events.length,1);assert.equal(ledger.events[0].dueDate,"2027-11-25");const first=clone(ledger.events[0]);
  for(let n=0;n<8;n++)ledger=updateProductionHealthLedger({production,lifecycle,prior:ledger,now:`2027-11-26T22:${String(n).padStart(2,"0")}:00.000Z`});assert.equal(ledger.events.length,1);assert.deepEqual(ledger.events[0],first);
  ledger=updateProductionHealthLedger({production,lifecycle,prior:ledger,now:"2028-08-25T21:01:00.000Z"});assert.equal(ledger.events.length,2);assert.equal(ledger.events[1].dueDate,"2028-02-25");assert.equal(ledger.events[1].timing,"LATE_CURRENT_STATE_ONLY");
  for(let n=0;n<8;n++)ledger=updateProductionHealthLedger({production,lifecycle,prior:ledger,now:`2028-08-25T22:${String(n).padStart(2,"0")}:00.000Z`});assert.equal(ledger.events.length,2);assert.equal(ledger.current.nextReview,"2028-11-25");
  ledger=updateProductionHealthLedger({production,lifecycle,prior:ledger,now:"2028-11-27T21:01:00.000Z"});assert.equal(ledger.events.length,3);assert.equal(ledger.events[2].dueDate,"2028-11-25");assert.equal(ledger.events[2].timing,"ON_TIME");
  for(let n=0;n<6;n++)ledger=updateProductionHealthLedger({production,lifecycle,prior:ledger,now:`2028-11-27T22:${String(n).padStart(2,"0")}:00.000Z`});assert.equal(ledger.events.length,3,"same future recurrence remains exactly once");
  ledger=updateProductionHealthLedger({production,lifecycle,prior:ledger,now:"2029-02-26T21:01:00.000Z"});assert.equal(ledger.events.length,4);assert.equal(ledger.events[3].dueDate,"2029-02-25");assert.equal(ledger.events[3].timing,"ON_TIME","a second future quarter must also recur normally after late recovery");
  assert.equal(new Set(ledger.events.map(e=>e.key)).size,ledger.events.length);
});
