import test from "node:test";
import assert from "node:assert/strict";
import {isNyseHoliday,isNyseSession,nextNyseSession,earliestLegalNyseOpen,completedNyseSessionsSince,upstreamWorkflowFresh,marketDataLagSessions,marketDataAvailability} from "../lib/market-calendar.ts";
import {freshness,nextExecutionDate} from "../lib/engine.ts";
import {corporateActionContinuity,applyShareFactor} from "../lib/corporate-actions.ts";
import {summarizeRegimeCoverage} from "../lib/regime-coverage.ts";
import {compareCandidateToIncumbent} from "../lib/forward-pareto.ts";
import {emptyPhase5Ledger,type Phase5Record} from "../lib/phase5-forward.ts";
import {emptyForwardLedger,type ForwardRecord} from "../lib/forward.ts";

const rec=(version:string,date:string,r:number,dd=0,position=.75,execution:Phase5Record["execution"]|ForwardRecord["execution"]=null)=>({key:`${version}|${date}`,marketDataDate:date,recordedAt:`${date}T22:00:00Z`,recordMode:"LIVE",strategyId:"UPRO_SPBT",ticker:"UPRO",strategyName:"x",strategyVersion:version,score:70,components:{trend:70,momentum:70,volatility:70,market:70},regime:"弱い上昇",targetExposure:position,previousExposure:position,signal:"HOLD",tradeReason:"x",intendedExecutionDate:date,execution,assetClose:100,position,quantity:1,cash:0,equity:1,dailyReturn:r,currentDrawdown:dd,cumulativeCosts:0,dataSource:"test",dataStatus:"VALID",buildVersion:"test"});
const sessions=(start:string,count:number)=>{const out:string[]=[],d=new Date(`${start}T12:00:00Z`);while(out.length<count){const date=d.toISOString().slice(0,10);if(isNyseSession(date))out.push(date);d.setUTCDate(d.getUTCDate()+1)}return out};

test("NYSE calendar handles 2026 holidays and historical Juneteenth correctly",()=>{
  assert.equal(isNyseHoliday("2026-07-03"),true);
  assert.equal(isNyseSession("2026-07-03"),false);
  assert.equal(nextNyseSession("2026-07-02"),"2026-07-06");
  assert.equal(isNyseHoliday("2021-06-18"),false);
  assert.equal(nextExecutionDate("2021-06-17"),"2021-06-18");
});

test("earliest legal open never returns an NYSE holiday",()=>{
  assert.equal(earliestLegalNyseOpen("2026-07-01","2026-07-03T12:00:00Z"),"2026-07-06");
});

test("upstream freshness counts completed market sessions, not weekend wall-clock hours",()=>{
  assert.equal(completedNyseSessionsSince("2026-08-28T22:30:00Z","2026-08-31T12:00:00Z"),0);
  assert.equal(upstreamWorkflowFresh("2026-08-28T22:30:00Z","2026-08-31T12:00:00Z"),true);
  assert.equal(upstreamWorkflowFresh("2026-08-28T22:30:00Z","2026-08-31T22:00:00Z"),false);
});

test("market data lag is measured in completed NYSE sessions",()=>{
  assert.equal(marketDataLagSessions("2026-08-28","2026-08-31T12:00:00Z"),0);
  assert.equal(marketDataLagSessions("2026-08-28","2026-08-31T22:00:00Z"),1);
});

test("normal post-close publication window is pending, not a failed Daily update",()=>{
  assert.deepEqual(marketDataAvailability("2026-09-01","2026-09-02T22:00:00Z"),{state:"UPDATE_PENDING",lagSessions:1});
  const pending=freshness("2026-09-01","2026-09-02T22:00:00Z");
  assert.equal(pending.stale,true,"old authority remains unusable while the new Daily is pending");
  assert.equal(pending.pending,true);
  assert.match(pending.message,/PENDING FOR UPDATE/);
  assert.match(pending.message,/遅延ではありません/);
});

test("missing publication becomes a real delay after the Daily deadline",()=>{
  assert.deepEqual(marketDataAvailability("2026-09-01","2026-09-03T00:01:00Z"),{state:"DELAYED",lagSessions:1});
  const delayed=freshness("2026-09-01","2026-09-03T00:01:00Z");
  assert.equal(delayed.pending,false);
  assert.match(delayed.message,/1完了NYSEセッション遅延/);
});

test("a multi-session gap is never hidden by the publication window",()=>{
  assert.deepEqual(marketDataAvailability("2026-08-31","2026-09-02T22:00:00Z"),{state:"DELAYED",lagSessions:2});
});

test("primary freshness fails closed after any completed NYSE session is missing",()=>{
  const weekend=freshness("2026-08-28","2026-08-31T12:00:00Z");
  assert.equal(weekend.stale,false);assert.equal(weekend.lagSessions,0);
  const afterMonday=freshness("2026-08-28","2026-08-31T22:00:00Z");
  assert.equal(afterMonday.stale,true);assert.equal(afterMonday.pending,true);assert.equal(afterMonday.lagSessions,1);
  assert.match(afterMonday.message,/使用しないでください/);
});

test("corporate action continuity recognizes forward and reverse splits from same-date provider restatement",()=>{
  const f=corporateActionContinuity(200,100);assert.equal(f.kind,"SPLIT");assert.equal(f.factor,2);assert.equal(f.adjustedPriorClose,100);
  const r=corporateActionContinuity(50,100);assert.equal(r.kind,"REVERSE_SPLIT");assert.equal(r.factor,.5);
  assert.deepEqual(applyShareFactor(10,200,2),{shares:20,avgPrice:100});
});

test("ordinary small correction stays NONE while unexplained large restatement fails closed",()=>{
  assert.equal(corporateActionContinuity(100,99).kind,"NONE");
  assert.equal(corporateActionContinuity(100,80).kind,"UNEXPLAINED_RESTATEMENT");
});

test("semantic regime gate rejects uninterrupted bull labels despite multiple strings",()=>{
  const bull=summarizeRegimeCoverage(["強い上昇","弱い上昇","強い上昇"]);assert.equal(bull.formalCoverage,false);assert.deepEqual(bull.families,["RISK_ON"]);
  const mixed=summarizeRegimeCoverage(["強い上昇","弱い上昇","レンジ"]);assert.equal(mixed.formalCoverage,true);
  const bear=summarizeRegimeCoverage(["強い上昇","高ボラ","下降トレンド"]);assert.equal(bear.formalCoverage,true);assert.equal(bear.riskOff,true);
});

test("common-period Pareto identifies strict incumbent dominance without scalar scoring",()=>{
  const p=emptyPhase5Ledger("2026-01-01T00:00:00Z"),f=emptyForwardLedger("2026-01-01T00:00:00Z");p.records=[];f.records=[];
  for(const date of sessions("2026-01-05",70)){
    p.records.push(rec("UPRO-SPBT-v1.0",date,.0002) as Phase5Record);
    const x=rec("VS13-v1.0",date,.0004) as ForwardRecord;x.strategyId="VS13";Reflect.deleteProperty(x as object,"ticker");f.records.push(x);
  }
  const c=compareCandidateToIncumbent(p,f,"UPRO-SPBT-v1.0");assert.equal(c.commonDays>=63,true);assert.equal(c.merit,"DOMINATED_BY_INCUMBENT");
});

test("Pareto restarts its common period after the latest missing NYSE session",()=>{
  const p=emptyPhase5Ledger("2026-01-01T00:00:00Z"),f=emptyForwardLedger("2026-01-01T00:00:00Z");p.records=[];f.records=[];
  const dates=sessions("2026-01-05",90),missing=dates[50];
  for(const date of dates){
    if(date!==missing)p.records.push(rec("UPRO-SPBT-v1.0",date,.0003) as Phase5Record);
    const x=rec("VS13-v1.0",date,.0004) as ForwardRecord;x.strategyId="VS13";Reflect.deleteProperty(x as object,"ticker");f.records.push(x);
  }
  const c=compareCandidateToIncumbent(p,f,"UPRO-SPBT-v1.0");
  assert.equal(c.commonDays,39);
  assert.equal(c.merit,"NOT_EVALUATED");
  assert.match(c.reasons[0],/consecutive clean common NYSE sessions/);
});
