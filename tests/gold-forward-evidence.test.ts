import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {GOLD_FORWARD_FIRST_SESSION,GOLD_FORWARD_BASELINE,parseGoldForwardEvidence,manualGoldResearchProjection} from "../lib/gold-forward-evidence.ts";
const hex=(n:number)=>"a".repeat(n);
const phase={counter:"C10/10",phaseCState:"COMPLETE_STOP_GATE",successfulSessions:10,
 successfulDates:["2026-09-08","2026-09-09","2026-09-10","2026-09-11","2026-09-14",
 "2026-09-15","2026-09-16","2026-09-17","2026-09-18","2026-09-21"],updatedAt:"2026-09-22T01:10:53Z"};
const weights={TQQQ:0.75,GLD:0.125,CASH:0.125};
const empty=()=>({
 baseline:GOLD_FORWARD_BASELINE,startDate:GOLD_FORWARD_FIRST_SESSION,
 state:"WAITING_FIRST_VALID_SESSION",validObservations:0,lastRecordedSession:null,
 lastAllocation:null,nextExpectedSession:"2026-10-12",attempt:"WAIT",
 reasonCode:"BEFORE_PROSPECTIVE_START",evaluatedAt:"2026-10-11T08:30:07Z",
 mode:"SHADOW_RESEARCH",authority:"NONE_SHADOW_ONLY",brokerOrderAllowed:false,
 manualUserOrdersOnly:true,performanceCertification:"NOT_AVAILABLE_SIGNAL_TRACK_ONLY"
});
const row=(d:string)=>({
 baseline:GOLD_FORWARD_BASELINE,marketDataDate:d,observedAt:d+"T22:00:00Z",
 sourceCommit:hex(40),strategyVersion:"gold-overlay-shadow-0.1.0",
 strategyId:"TQQQ-Gold50-Research-v0.1",mode:"SHADOW_RESEARCH",
 sourceTarget:0.75,signalSha256:hex(64),statusSha256:hex(64),gldDataSha256:hex(64),
 target:weights,status:"VALID_RESEARCH_SIGNAL",brokerOrderAllowed:false,
 replayVerified:true,
 execution:{earliestLegalDate:d==="2026-10-12"?"2026-10-13":d==="2026-10-13"?"2026-10-14":"2026-10-16",
 estimatedManualOrderLegs:0,actionDay:false,brokerOrderAllowed:false}
});
const ready=(r:Array<ReturnType<typeof row>>,state="ACCUMULATING")=>({
 ...empty(),state,validObservations:r.length,
 lastRecordedSession:r.at(-1)?.marketDataDate??null,
 nextExpectedSession:r.at(-1) ?
  r.at(-1)!.marketDataDate==="2026-10-12"?"2026-10-13":
  r.at(-1)!.marketDataDate==="2026-10-13"?"2026-10-14":"2026-10-16":"2026-10-12",
 lastAllocation:r.at(-1)?.target??null
});
test("prelaunch 2026-10-11 snapshot is valid and has zero Gold strategies ready to trade",()=>{
 const e=parseGoldForwardEvidence(empty(),phase,"\n");
 assert.equal(e.ok,true);assert.equal(e.rows.length,0);
 assert.equal(e.status?.brokerOrderAllowed,false);
 assert.equal(e.segments.length,0);
});
test("single genuine post-launch observation is research only",()=>{
 const r=row("2026-10-12");
 const e=parseGoldForwardEvidence(ready([r]),phase,JSON.stringify(r)+"\n");
 assert.equal(e.ok,true);assert.equal(e.segments.length,1);
 assert.equal(e.rows[0].target.GLD,0.125);
});
test("Phase C C10/10 never contributes a Gold Forward strategy row",()=>{
 const e=parseGoldForwardEvidence(empty(),phase,"");
 assert.equal(e.status?.validObservations,0);
 assert.equal(e.phaseC?.successfulSessions,10);
});
test("explicit missing Forward sessions create visible split segments, not made-up signals",()=>{
 const r1=row("2026-10-12"),r2=row("2026-10-15");
 const e=parseGoldForwardEvidence(ready([r1,r2]),phase,[r1,r2].map(JSON.stringify).join("\n"));
 assert.equal(e.ok,true);assert.equal(e.segments.length,2);
 assert.deepEqual(e.gaps,[{after:"2026-10-12",before:"2026-10-15"}]);
 assert.equal(e.rows.length,2);
});
test("duplicate and reversed records fail closed",()=>{
 const x=row("2026-10-12");
 assert.equal(parseGoldForwardEvidence(ready([x,x]),phase,[x,x].map(JSON.stringify).join("\n")).ok,false);
});
test("mismatched status record count fails closed",()=>{
 const r=row("2026-10-12");
 assert.equal(parseGoldForwardEvidence(empty(),phase,JSON.stringify(r)).ok,false);
});
test("Gold source without 10 completed Phase C sessions fails closed",()=>{
 const p={...phase,counter:"C9/10"};
 assert.equal(parseGoldForwardEvidence(empty(),p,"").ok,false);
});
test("no broker order authority can be displayed",()=>{
 const r={...row("2026-10-12"),brokerOrderAllowed:true};
 assert.equal(parseGoldForwardEvidence(ready([r]),phase,JSON.stringify(r)).ok,false);
 const status={...empty(),manualUserOrdersOnly:false};
 assert.equal(parseGoldForwardEvidence(status,phase,"").ok,false);
});
test("tampered asset weights and forged digests rejected",()=>{
 const r=row("2026-10-12");
 assert.equal(parseGoldForwardEvidence(ready([{...r,target:{TQQQ:0.75,GLD:0.2,CASH:0.05}}]),phase,JSON.stringify({...r,target:{TQQQ:0.75,GLD:0.2,CASH:0.05}})).ok,false);
 assert.equal(parseGoldForwardEvidence(ready([{...r,signalSha256:"bad"}]),phase,JSON.stringify({...r,signalSha256:"bad"})).ok,false);
});
test("Phase C and new Forward must not have a synthesized contiguous return",()=>{
 const app=readFileSync("app/gold-forward-ui.tsx","utf8");
 assert.match(app,/非観測期間/);
 assert.match(app,/2026-09-22 ～ 2026-10-09/);
 assert.match(app,/区間をまたぐ損益や架空の観測日は作成しません/);
});
test("same existing TQQQ PWA displays Gold50 in the Forward tab and an internal Gold tab",()=>{
 const app=readFileSync("app/page.tsx","utf8");
 assert.match(app,/\["gold", "Gold50 \/ Forward"\]/);
 assert.match(app,/tab==="forward".*GoldIntegratedForward compact/);
 assert.match(app,/tab==="gold".*GoldIntegratedForward/);
 assert.doesNotMatch(app,/autoBrokerOrder\(/);
});
test("manual order projection never invokes brokerage and floors whole shares",()=>{
 const p=manualGoldResearchProjection({weights,cashUsd:2000,tqqqShares:0,gldShares:0,tqqqUsd:100,gldUsd:200});
 assert.equal(p?.targets.TQQQ,15);
 assert.equal(p?.targets.GLD,1);
 assert.equal(p?.estimatedCash,300);
 assert.equal(p?.brokerOrderAllowed,false);
 assert.equal(manualGoldResearchProjection({weights,cashUsd:-1,tqqqShares:1,gldShares:1,tqqqUsd:100,gldUsd:200}),null);
});
test("unreadable or oversized external file must not silently trust cached prices",()=>{
 assert.equal(parseGoldForwardEvidence(empty(),phase,"x".repeat(500001)).ok,false);
 assert.equal(parseGoldForwardEvidence(empty(),phase,"{not-json}").ok,false);
});
