import test from "node:test";
import assert from "node:assert/strict";
import {emptyForwardLedger,updateForwardLedger,type ForwardRecord} from "../lib/forward.ts";
import {emptyPhase5Ledger,updatePhase5LedgerSubset,type Phase5Record} from "../lib/phase5-forward.ts";
import {isNyseSession} from "../lib/market-calendar.ts";
import type {Dataset} from "../lib/engine.ts";

const bar=(date:string,open:number,close=open)=>({date,open,high:Math.max(open,close),low:Math.min(open,close),close,adjClose:close,volume:1_000_000});

const priorForward=(assetClose=100):ForwardRecord=>({
  key:"VS13-v1.0|2027-01-04",marketDataDate:"2027-01-04",recordedAt:"2027-01-04T21:30:00Z",recordMode:"LIVE",strategyId:"VS13",strategyName:"Volatility Shield 13%",strategyVersion:"VS13-v1.0",score:80,components:{trend:80,momentum:80,volatility:80,market:80},regime:"強い上昇",targetExposure:1,previousExposure:.5,signal:"INCREASE",tradeReason:"pending execution across split",intendedExecutionDate:"2027-01-05",execution:null,assetClose,position:.5,quantity:5_000,cash:500_000,equity:1_000_000,dailyReturn:0,currentDrawdown:0,cumulativeCosts:0,dataSource:"audit7",dataStatus:"VALID",buildVersion:"audit7"
});
const forwardDs:Dataset={days:[
  {date:"2027-01-04",tqqq:bar("2027-01-04",50),qqq:bar("2027-01-04",100),spy:bar("2027-01-04",100),vix:bar("2027-01-04",20)},
  {date:"2027-01-05",tqqq:bar("2027-01-05",52),qqq:bar("2027-01-05",101),spy:bar("2027-01-05",101),vix:bar("2027-01-05",20)},
],issues:[],source:"audit7",precision:"next-open",tickers:{} as Dataset["tickers"]};
const sessions=(start:string,end:string)=>{const out:string[]=[];for(const d=new Date(`${start}T12:00:00Z`);d<=new Date(`${end}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+1)){const date=d.toISOString().slice(0,10);if(isNyseSession(date))out.push(date)}return out};
const genericForward=(freeze:ReturnType<typeof emptyForwardLedger>["freezes"][number],date:string):ForwardRecord=>({key:`${freeze.version}|${date}`,marketDataDate:date,recordedAt:"2027-01-04T21:30:00Z",recordMode:date==="2027-01-04"?"LIVE":"BACKFILLED_OBSERVATION",strategyId:freeze.id,strategyName:freeze.name,strategyVersion:freeze.version,score:80,components:{trend:80,momentum:80,volatility:80,market:80},regime:"強い上昇",targetExposure:1,previousExposure:1,signal:"HOLD",tradeReason:"complete Audit 7 corporate-action fixture",intendedExecutionDate:"2027-01-05",execution:null,assetClose:freeze.asset==="QQQ"?100:50,position:1,quantity:1,cash:0,equity:1_000_000,dailyReturn:0,currentDrawdown:0,cumulativeCosts:0,dataSource:"audit7",dataStatus:date==="2027-01-04"?"VALID":"BACKFILLED_NO_SIGNAL",buildVersion:"audit7"});
const completeForwardPrior=()=>{
  const ledger=emptyForwardLedger("2027-01-04T21:30:00Z"),start=ledger.freezes.map(f=>f.startDate).sort()[0];
  for(const date of sessions(start,"2027-01-04"))for(const freeze of ledger.freezes)ledger.records.push(freeze.version==="VS13-v1.0"&&date==="2027-01-04"?priorForward():genericForward(freeze,date));
  ledger.records.sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)||a.strategyVersion.localeCompare(b.strategyVersion));
  return ledger;
};

test("A7 D10 FC-14/10: split continuity and pending Forward execution share one economic price scale",()=>{
  const ledger=completeForwardPrior();
  const out=updateForwardLedger(forwardDs,ledger,"audit7","2027-01-05T21:30:00Z"),row=out.records.find(r=>r.strategyVersion==="VS13-v1.0"&&r.marketDataDate==="2027-01-05")!;
  assert.equal(row.corporateActionKind,"SPLIT");assert.equal(row.corporateActionFactor,2);
  assert.ok(row.execution);assert.equal(row.execution!.before,.5);assert.equal(row.execution!.after,1);assert.equal(row.execution!.turnover,.5);assert.equal(row.execution!.recordedDate,"2027-01-05");
  const expectedBeforeCost=1_000_000*(1+.5*(52/50-1)),expectedCost=expectedBeforeCost*.5*.0008,expectedEquity=expectedBeforeCost-expectedCost;
  assert.ok(Math.abs(row.execution!.totalCost-expectedCost)<1e-8,`${row.execution!.totalCost} != ${expectedCost}`);
  assert.ok(Math.abs(row.equity-expectedEquity)<1e-8,`${row.equity} != ${expectedEquity}`);
  assert.ok(row.equity>1_000_000,"2:1 split must not masquerade as a 50% crash while an execution is pending");
});

const sessionsEnding=(end:string,count:number)=>{const out:string[]=[];const d=new Date(`${end}T12:00:00Z`);while(out.length<count){const s=d.toISOString().slice(0,10);if(isNyseSession(s))out.push(s);d.setUTCDate(d.getUTCDate()-1)}return out.reverse()};
const dates=sessionsEnding("2027-01-05",260);
const generic=(base:number)=>dates.map((date,i)=>bar(date,base*(1+i*.0002)));
const phasePayload:any={source:"audit7",retrievedAt:"2027-01-05T21:30:00Z",series:{UPRO:generic(45),SPY:generic(100),VIX:dates.map(d=>bar(d,20)),SSO:generic(50),QLD:generic(60),QQQ:generic(120)}};
for(const b of phasePayload.series.UPRO){if(b.date==="2027-01-04")Object.assign(b,bar(b.date,50));if(b.date==="2027-01-05")Object.assign(b,bar(b.date,52));}
const priorPhase5=(freeze:ReturnType<typeof emptyPhase5Ledger>["freezes"][number]):Phase5Record=>({
  key:`${freeze.version}|2027-01-04`,marketDataDate:"2027-01-04",recordedAt:"2027-01-04T21:30:00Z",recordMode:"LIVE",strategyId:freeze.id,ticker:freeze.ticker,strategyName:freeze.name,strategyVersion:freeze.version,score:80,components:{trend:80,momentum:80,volatility:80,market:80},regime:"強い上昇",targetExposure:1,previousExposure:.5,signal:"INCREASE",tradeReason:"pending execution across split",intendedExecutionDate:"2027-01-05",execution:null,assetClose:100,position:.5,quantity:5_000,cash:500_000,equity:1_000_000,dailyReturn:0,currentDrawdown:0,cumulativeCosts:0,dataSource:"audit7",dataStatus:"VALID",buildVersion:"audit7"
});

test("A7 D10 FC-14/06: Phase5 subset keeps split-day pending execution continuous without contaminating peers",()=>{
  const ledger=emptyPhase5Ledger("2027-01-04T21:30:00Z"),freeze=ledger.freezes.find(f=>f.version==="UPRO-SPBT-v1.0")!;ledger.records=[priorPhase5(freeze)];
  // This synthetic corporate-action fixture intentionally omits the older
  // Phase5 price path. Make that omission explicit evidence rather than an
  // impossible silently truncated prior.
  ledger.coverageGaps=sessions(freeze.startDate,"2027-01-03").map(date=>({key:`${freeze.version}|${date}|GAP`,strategyVersion:freeze.version,marketDataDate:date,recordedAt:"2027-01-04T21:30:00Z",reason:"SOURCE_DATA_MISSING" as const}));
  const beforePeerFreezes=structuredClone(ledger.freezes.filter(f=>f.version!==freeze.version));
  const out=updatePhase5LedgerSubset(phasePayload,ledger,[freeze.version],"2027-01-05T21:30:00Z"),row=out.records.find(r=>r.strategyVersion===freeze.version&&r.marketDataDate==="2027-01-05")!;
  assert.equal(row.corporateActionKind,"SPLIT");assert.equal(row.corporateActionFactor,2);assert.ok(row.execution);assert.equal(row.execution!.before,.5);assert.equal(row.execution!.after,1);
  const expectedBeforeCost=1_000_000*(1+.5*(52/50-1)),expectedCost=expectedBeforeCost*.5*.0008,expectedEquity=expectedBeforeCost-expectedCost;
  assert.ok(Math.abs(row.equity-expectedEquity)<1e-8);assert.deepEqual(out.freezes.filter(f=>f.version!==freeze.version),beforePeerFreezes);
  assert.equal(out.records.filter(r=>r.strategyVersion!==freeze.version).length,0,"single-system corporate action update must not synthesize peer records");
});
