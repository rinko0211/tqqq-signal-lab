import test from "node:test";
import assert from "node:assert/strict";
import {emptyForwardLedger,updateForwardLedger,type ForwardRecord} from "../lib/forward.ts";
import {isNyseSession} from "../lib/market-calendar.ts";
import type {Dataset} from "../lib/engine.ts";

const bar=(date:string,open:number,close=open)=>({date,open,high:Math.max(open,close),low:Math.min(open,close),close,adjClose:close,volume:1_000_000});
const ds=(priorClose:number,currentOpen:number):Dataset=>({days:[
  {date:"2027-01-04",tqqq:bar("2027-01-04",priorClose,priorClose),qqq:bar("2027-01-04",100),spy:bar("2027-01-04",100),vix:bar("2027-01-04",20)},
  {date:"2027-01-05",tqqq:bar("2027-01-05",currentOpen,currentOpen),qqq:bar("2027-01-05",101),spy:bar("2027-01-05",101),vix:bar("2027-01-05",20)},
],issues:[],source:"test",precision:"next-open",tickers:{} as Dataset["tickers"]});
const priorRecord=(assetClose:number):ForwardRecord=>({key:"VS13-v1.0|2027-01-04",marketDataDate:"2027-01-04",recordedAt:"2027-01-04T22:00:00Z",recordMode:"LIVE",strategyId:"VS13",strategyName:"Volatility Shield 13%",strategyVersion:"VS13-v1.0",score:80,components:{trend:80,momentum:80,volatility:80,market:80},regime:"強い上昇",targetExposure:1,previousExposure:1,signal:"HOLD",tradeReason:"test",intendedExecutionDate:"2027-01-05",execution:null,assetClose,position:1,quantity:1,cash:0,equity:1_000_000,dailyReturn:0,currentDrawdown:0,cumulativeCosts:0,dataSource:"test",dataStatus:"VALID",buildVersion:"test"});
const sessions=(start:string,end:string)=>{const out:string[]=[];for(const d=new Date(`${start}T12:00:00Z`);d<=new Date(`${end}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+1)){const date=d.toISOString().slice(0,10);if(isNyseSession(date))out.push(date)}return out};
const genericRecord=(freeze:ReturnType<typeof emptyForwardLedger>["freezes"][number],date:string,assetClose:number):ForwardRecord=>({key:`${freeze.version}|${date}`,marketDataDate:date,recordedAt:"2027-01-04T22:00:00Z",recordMode:date==="2027-01-04"?"LIVE":"BACKFILLED_OBSERVATION",strategyId:freeze.id,strategyName:freeze.name,strategyVersion:freeze.version,score:80,components:{trend:80,momentum:80,volatility:80,market:80},regime:"強い上昇",targetExposure:1,previousExposure:1,signal:"HOLD",tradeReason:"complete corporate-action fixture",intendedExecutionDate:"2027-01-05",execution:null,assetClose,position:1,quantity:1,cash:0,equity:1_000_000,dailyReturn:0,currentDrawdown:0,cumulativeCosts:0,dataSource:"test",dataStatus:date==="2027-01-04"?"VALID":"BACKFILLED_NO_SIGNAL",buildVersion:"test"});
const completePrior=(persistedVs13Close:number,providerPriorClose:number)=>{
  const ledger=emptyForwardLedger("2027-01-04T22:00:00Z"),start=ledger.freezes.map(f=>f.startDate).sort()[0];
  for(const date of sessions(start,"2027-01-04"))for(const freeze of ledger.freezes){
    const close=freeze.asset==="QQQ"?100:providerPriorClose;
    ledger.records.push(freeze.version==="VS13-v1.0"&&date==="2027-01-04"?priorRecord(persistedVs13Close):genericRecord(freeze,date,close));
  }
  ledger.records.sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)||a.strategyVersion.localeCompare(b.strategyVersion));
  return ledger;
};

test("append-only Forward continuity neutralizes provider back-adjustment after a 2:1 split",()=>{
  const ledger=completePrior(100,50);
  // Provider now rewrites the same prior date to 50 after a 2:1 split. Current open 52 => true overnight +4%, not -48%.
  const out=updateForwardLedger(ds(50,52),ledger,"test","2027-01-05T22:00:00Z"),row=out.records.find(r=>r.strategyVersion==="VS13-v1.0"&&r.marketDataDate==="2027-01-05")!;
  assert.equal(row.corporateActionKind,"SPLIT");assert.equal(row.corporateActionFactor,2);assert.ok(Math.abs(row.equity/1_000_000-1.04)<1e-9,row.equity.toString());
});

test("unexplained split-like gap fails closed instead of recording a fake crash",()=>{
  const ledger=completePrior(100,100);
  assert.throws(()=>updateForwardLedger(ds(100,50),ledger,"test","2027-01-05T22:00:00Z"),/CORP-004/);
});
