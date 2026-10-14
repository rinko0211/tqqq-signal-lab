import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseGoldForwardEvidence} from "../lib/gold-forward-evidence.ts";
import {parseGoldModelEvidence,GOLD_PERFORMANCE_START} from "../lib/gold-performance-evidence.ts";

const H40="a".repeat(40),H64="b".repeat(64);
const W={TQQQ:1,GLD:0,CASH:0};
const phase={counter:"C10/10",phaseCState:"COMPLETE_STOP_GATE",successfulSessions:10,
 successfulDates:["2026-09-08","2026-09-09","2026-09-10","2026-09-11","2026-09-14",
 "2026-09-15","2026-09-16","2026-09-17","2026-09-18","2026-09-21"]};
const goldRow=(day:string,next:string)=>({
 baseline:"gold50-prospective-forward-v1-20261012",strategyId:"TQQQ-Gold50-Research-v0.1",
 strategyVersion:"gold-overlay-shadow-0.1.0",mode:"SHADOW_RESEARCH",marketDataDate:day,
 observedAt:day+"T21:00:00Z",sourceCommit:H40,signalSha256:H64,statusSha256:H64,gldDataSha256:H64,
 sourceTarget:1,target:W,status:"VALID_RESEARCH_SIGNAL",brokerOrderAllowed:false,replayVerified:true,
 execution:{earliestLegalDate:next,estimatedManualOrderLegs:0,actionDay:false,brokerOrderAllowed:false}
});
const goldRows=[goldRow("2026-10-12","2026-10-13"),goldRow("2026-10-13","2026-10-14"),
 goldRow("2026-10-14","2026-10-15")];
const signal=()=>{
 const last=goldRows.at(-1)!;
 return parseGoldForwardEvidence({baseline:"gold50-prospective-forward-v1-20261012",startDate:"2026-10-12",
 state:"ACCUMULATING",validObservations:goldRows.length,lastRecordedSession:last.marketDataDate,
 lastAllocation:W,nextExpectedSession:"2026-10-15",evaluatedAt:"2026-10-15T09:00:00Z",
 mode:"SHADOW_RESEARCH",authority:"NONE_SHADOW_ONLY",brokerOrderAllowed:false,
 manualUserOrdersOnly:true,performanceCertification:"NOT_AVAILABLE_SIGNAL_TRACK_ONLY",
 attempt:"APPEND",reasonCode:null},phase,goldRows.map(JSON.stringify).join("\n"));
};
const perfRow=()=>({
 version:"gold50-valuation-v1",marketDataDate:"2026-10-14",signalDate:"2026-10-13",
 sourceCommit:H40,pricesSha256:H64,continuity:{kind:"INITIAL",expectedDate:"2026-10-14"},
 appliedTarget:W,shares:{TQQQ:1,GLD:0},cash:0,index:99.5,peak:100,
 dd:-.005,maxDd:-.005,costs:0.08,turnover:99.92,orderLegs:1,
 mode:"SHADOW_RESEARCH",brokerOrderAllowed:false,rawTiingoOhlcPersisted:false,
 performanceCertification:"INDICATIVE_NOT_COMPARABLE"
});
const modelStatus=(r:ReturnType<typeof perfRow>)=>({
 version:"gold50-valuation-v1",startDate:"2026-10-14",state:"ACCUMULATING",recordCount:1,
 lastMarketDate:r.marketDataDate,index:r.index,dd:r.dd,maxDd:r.maxDd,segments:1,
 attempt:"APPEND",reasonCode:null,evaluatedAt:"2026-10-15T09:00:00Z",
 mode:"SHADOW_RESEARCH",brokerOrderAllowed:false,rawTiingoOhlcPersisted:false,
 performanceCertification:"INDICATIVE_NOT_COMPARABLE"
});
test("Gold50 no price performance before Oct14 is explicitly absent, NOT zero-DD",()=>{
 assert.equal(GOLD_PERFORMANCE_START,"2026-10-14");
 const s=signal();assert.equal(s.ok,true);
 const st={...modelStatus(perfRow()),state:"WAITING",recordCount:0,lastMarketDate:null,index:null,dd:null,maxDd:null,segments:0};
 const r=parseGoldModelEvidence(st,"\n",s);
 assert.equal(r.ok,true);assert.equal(r.rows.length,0);
 assert.equal(r.status?.dd,null);
});
test("legitimate first observed model DD is accepted only with corroborating preceding Gold signal",()=>{
 const s=signal(),r=perfRow();assert.equal(s.ok,true);
 const parsed=parseGoldModelEvidence(modelStatus(r),JSON.stringify(r)+"\n",s);
 assert.equal(parsed.ok,true);assert.equal(parsed.rows[0].dd,-.005);
 assert.equal(parsed.rows[0].maxDd,-.005);
 assert.equal(parsed.rows[0].brokerOrderAllowed,false);
});
test("future calculated return cannot be forged into Oct12/13 signal-only observations",()=>{
 const r={...perfRow(),marketDataDate:"2026-10-13",signalDate:"2026-10-12"};
 assert.equal(parseGoldModelEvidence(modelStatus(r),JSON.stringify(r),signal()).ok,false);
});
test("risk authority violation or mismatch fails closed, never treats it as zero",()=>{
 const r=perfRow(),st=modelStatus(r);
 assert.equal(parseGoldModelEvidence({...st,brokerOrderAllowed:true},JSON.stringify(r),signal()).ok,false);
 assert.equal(parseGoldModelEvidence({...st,recordCount:2},JSON.stringify(r),signal()).ok,false);
 assert.equal(parseGoldModelEvidence(st,JSON.stringify({...r,brokerOrderAllowed:true}),signal()).ok,false);
 assert.equal(parseGoldModelEvidence(st,JSON.stringify({...r,maxDd:0.01}),signal()).ok,false);
 assert.equal(parseGoldModelEvidence(st,JSON.stringify({...r,appliedTarget:{TQQQ:0,GLD:.5,CASH:.5}}),signal()).ok,false);
});
test("Gold50 signal view remains valid when valuation files cannot load",()=>{
 const page=readFileSync("app/gold-forward-ui.tsx","utf8");
 const board=readFileSync("app/unified-forward-board.tsx","utf8");
 assert.match(page,/Gold50の仮想損益・DD/);
 assert.match(page,/setEv\(parsed\)/);
 assert.match(page,/setRisk\(parseGoldModelEvidence/);
 assert.match(board,/独立/);
 assert.match(board,/setGold\(ev\)/);
 assert.match(board,/setGoldRisk/);
 assert.match(board,/modelReturn:null,maxDd:null,modelOrders:null/);
});
