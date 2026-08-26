import test from "node:test";
import assert from "node:assert/strict";
import {emptyForwardLedger,updateForwardLedger,type ForwardRecord} from "../lib/forward.ts";
import type {Dataset} from "../lib/engine.ts";

const bar=(date:string,open:number,close=open)=>({date,open,high:Math.max(open,close),low:Math.min(open,close),close,adjClose:close,volume:1_000_000});
const ds=(priorClose:number,currentOpen:number):Dataset=>({days:[
  {date:"2027-01-04",tqqq:bar("2027-01-04",priorClose,priorClose),qqq:bar("2027-01-04",100),spy:bar("2027-01-04",100),vix:bar("2027-01-04",20)},
  {date:"2027-01-05",tqqq:bar("2027-01-05",currentOpen,currentOpen),qqq:bar("2027-01-05",101),spy:bar("2027-01-05",101),vix:bar("2027-01-05",20)},
],issues:[],source:"test",precision:"next-open",tickers:{} as any});
const priorRecord=(assetClose:number):ForwardRecord=>({key:"VS13-v1.0|2027-01-04",marketDataDate:"2027-01-04",recordedAt:"2027-01-04T22:00:00Z",recordMode:"LIVE",strategyId:"VS13",strategyName:"Volatility Shield 13%",strategyVersion:"VS13-v1.0",score:80,components:{trend:80,momentum:80,volatility:80,market:80},regime:"強い上昇",targetExposure:1,previousExposure:1,signal:"HOLD",tradeReason:"test",intendedExecutionDate:"2027-01-05",execution:null,assetClose,position:1,quantity:1,cash:0,equity:1_000_000,dailyReturn:0,currentDrawdown:0,cumulativeCosts:0,dataSource:"test",dataStatus:"VALID",buildVersion:"test"});

test("append-only Forward continuity neutralizes provider back-adjustment after a 2:1 split",()=>{
  const ledger=emptyForwardLedger("2027-01-04T22:00:00Z");ledger.freezes=ledger.freezes.filter(x=>x.version==="VS13-v1.0");ledger.records=[priorRecord(100)];
  // Provider now rewrites the same prior date to 50 after a 2:1 split. Current open 52 => true overnight +4%, not -48%.
  const out=updateForwardLedger(ds(50,52),ledger,"test","2027-01-05T22:00:00Z"),row=out.records.at(-1)!;
  assert.equal(row.corporateActionKind,"SPLIT");assert.equal(row.corporateActionFactor,2);assert.ok(Math.abs(row.equity/1_000_000-1.04)<1e-9,row.equity.toString());
});

test("unexplained split-like gap fails closed instead of recording a fake crash",()=>{
  const ledger=emptyForwardLedger("2027-01-04T22:00:00Z");ledger.freezes=ledger.freezes.filter(x=>x.version==="VS13-v1.0");ledger.records=[priorRecord(100)];
  assert.throws(()=>updateForwardLedger(ds(100,50),ledger,"test","2027-01-05T22:00:00Z"),/CORP-004/);
});
