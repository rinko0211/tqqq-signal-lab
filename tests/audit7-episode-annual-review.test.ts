import test from "node:test";
import assert from "node:assert/strict";
import {isNyseSession} from "../lib/market-calendar.ts";
import {emptyForwardLedger,type ForwardLedger} from "../lib/forward.ts";
import {emptyPhase5Ledger,type Phase5Ledger} from "../lib/phase5-forward.ts";
import {emptyLifecycleLedger,updateLifecycleReview} from "../lib/lifecycle-review.ts";
import {emptyProductionHealthLedger,updateProductionHealthLedger} from "../lib/production-health-review.ts";
import {DEFAULT_PRODUCTION_CONFIG,transitionMode,type ProductionConfig} from "../lib/production.ts";

const sessionsBetween=(start:string,end:string)=>{const out:string[]=[];const d=new Date(`${start}T12:00:00Z`),z=new Date(`${end}T12:00:00Z`);while(d<=z){const s=d.toISOString().slice(0,10);if(isNyseSession(s))out.push(s);d.setUTCDate(d.getUTCDate()+1)}return out};
const regimes=["強い上昇","レンジ","高ボラ"];

function seedForward(end:string):ForwardLedger{
  const l=emptyForwardLedger("2026-08-21T20:00:10Z");let equity=1_000_000;
  for(const [i,date] of sessionsBetween("2026-08-21",end).entries()){
    const trade=i<6;equity*=1.0002;l.records.push({key:`VS13-v1.0|${date}`,marketDataDate:date,recordedAt:`${date}T20:00:10Z`,recordMode:"LIVE",strategyId:"VS13",strategyName:"Volatility Shield 13%",strategyVersion:"VS13-v1.0",score:70,components:{trend:70,momentum:70,volatility:70,market:70},regime:regimes[i%regimes.length],targetExposure:.75,previousExposure:trade?0:.75,signal:trade?"INCREASE":"HOLD",tradeReason:"audit7 annual fixture",intendedExecutionDate:date,execution:trade?{signalDate:date,intendedDate:date,recordedDate:date,price:100,before:0,after:.75,turnover:.75,commission:1,slippage:1,totalCost:2,status:"ON_TIME"}:null,assetClose:100,position:.75,quantity:7500,cash:250000,equity,dailyReturn:.0002,currentDrawdown:0,cumulativeCosts:2*Math.min(i+1,6),dataSource:"audit7",dataStatus:"VALID",buildVersion:"audit7"});
  }
  l.records.sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)||a.strategyVersion.localeCompare(b.strategyVersion));l.updatedAt=`${end}T20:00:10Z`;return l;
}

function seedPhase5(end:string):Phase5Ledger{
  const l=emptyPhase5Ledger("2026-08-25T20:00:10Z"),dates=sessionsBetween("2026-08-25",end);
  for(const [fi,f] of l.freezes.entries()){
    let equity=1_000_000;for(const [i,date] of dates.entries()){
      const trade=i<6;equity*=1.0002;l.records.push({key:`${f.version}|${date}`,marketDataDate:date,recordedAt:`${date}T20:00:10Z`,recordMode:"LIVE",strategyId:f.id,ticker:f.ticker,strategyName:f.name,strategyVersion:f.version,score:70,components:{trend:70,momentum:70,volatility:70,market:70},regime:regimes[(i+fi)%regimes.length],targetExposure:.75,previousExposure:trade?0:.75,signal:trade?"INCREASE":"HOLD",tradeReason:"audit7 annual fixture",intendedExecutionDate:date,execution:trade?{signalDate:date,intendedDate:date,recordedDate:date,price:100,before:0,after:.75,turnover:.75,commission:1,slippage:1,totalCost:2,status:"ON_TIME"}:null,assetClose:100,position:.75,quantity:7500,cash:250000,equity,dailyReturn:.0002,currentDrawdown:0,cumulativeCosts:2*Math.min(i+1,6),dataSource:"audit7",dataStatus:"VALID",buildVersion:"audit7"});
    }
  }
  l.records.sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)||a.strategyVersion.localeCompare(b.strategyVersion));l.updatedAt=`${end}T20:00:10Z`;return l;
}

const approve=(current:ProductionConfig,ticker:string,system:string,version:string,date:string)=>transitionMode(transitionMode(current,"DECISION"),"PRODUCTION",{ticker,system,version,date,evidence:"Strong",finalReviewComplete:true});

test("A7 D17 FC-04/05/12: A→B→A re-entry remains a fresh A health episode at the recurring annual selection review",()=>{
  const a1=approve(DEFAULT_PRODUCTION_CONFIG,"UPRO","UPRO + S&P Broad Trend","UPRO-SPBT-v1.0","2027-08-25");
  const b=approve(a1,"SSO","SSO + S&P Broad Trend + scaled stop","SSO-SPBT-Scaled-v1.0","2028-01-10");
  const a2=approve(b,"UPRO","UPRO + S&P Broad Trend","UPRO-SPBT-v1.0","2028-04-10");
  assert.equal(a2.effectiveDate,"2028-04-10");assert.equal(a2.nextHealthReview,"2028-07-10");

  const phase5=seedPhase5("2028-08-25"),forward=seedForward("2028-08-25"),priorLifecycle=emptyLifecycleLedger(phase5.reviewSchedule,"2026-08-25T20:00:10Z");
  const phase5Status={status:"success",errors:[],generatedAt:"2028-08-25T20:00:30Z",latestDates:{UPRO:"2028-08-25",SSO:"2028-08-25",QLD:"2028-08-25",SPY:"2028-08-25",QQQ:"2028-08-25",VIX:"2028-08-25"},systems:{"UPRO-SPBT-v1.0":{status:"success",latestDate:"2028-08-25",errors:[]},"SSO-SPBT-Scaled-v1.0":{status:"success",latestDate:"2028-08-25",errors:[]},"QLD-VS13-Scaled-v1.0":{status:"success",latestDate:"2028-08-25",errors:[]}}};
  const runtimeStatus={generatedAt:"2028-08-25T20:00:30Z",actionStatus:"success",state:"latest",marketDataDate:"2028-08-25",errors:[]};
  const lifecycle=updateLifecycleReview({phase5,forward,production:a2,phase5Status,runtimeStatus,prior:priorLifecycle,now:"2028-08-25T20:01:00Z"});
  assert.equal(lifecycle.current.stage,"STRONGER");assert.equal(lifecycle.current.reviewCycleDate,"2028-08-25");assert.equal(lifecycle.current.incumbentVersion,"UPRO-SPBT-v1.0");
  const incumbents=lifecycle.current.candidateReviews.filter(r=>r.incumbent);assert.equal(incumbents.length,1);assert.equal(incumbents[0].version,"UPRO-SPBT-v1.0");
  assert.equal(lifecycle.current.productionHealth.version,"UPRO-SPBT-v1.0");assert.notEqual(lifecycle.current.productionHealth.state,"NOT_IN_PRODUCTION");
  assert.equal(a2.mode,"PRODUCTION","annual review calculation must not mutate Production authority");assert.equal(a2.effectiveDate,"2028-04-10");

  const oldHealth=emptyProductionHealthLedger("2027-08-25T20:00:00Z");oldHealth.events.push({key:"UPRO-SPBT-v1.0|2027-11-25",dueDate:"2027-11-25",recordedAt:"2027-11-26T21:01:00Z",version:"UPRO-SPBT-v1.0",state:"Healthy",timing:"ON_TIME",reasons:["old A episode"]});
  const health=updateProductionHealthLedger({production:a2,lifecycle,prior:oldHealth,now:"2028-08-25T20:01:00Z"});
  assert.equal(health.events[0].reasons[0],"old A episode","old A evidence remains append-only");assert.equal(health.events.length,2);
  assert.equal(health.current.lastReview,"2028-07-10","re-entered A must use only the new episode's review cursor");assert.equal(health.events.at(-1)!.timing,"LATE_CURRENT_STATE_ONLY");assert.equal(health.current.nextReview,"2028-10-10");
});
