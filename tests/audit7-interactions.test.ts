import test from "node:test";
import assert from "node:assert/strict";
import {isNyseSession} from "../lib/market-calendar.ts";
import {emptyForwardLedger,type ForwardLedger} from "../lib/forward.ts";
import {emptyPhase5Ledger,updatePhase5LedgerSubset,type Phase5Ledger} from "../lib/phase5-forward.ts";
import {emptyLifecycleLedger,lifecycleStageAt,updateLifecycleReview} from "../lib/lifecycle-review.ts";
import {DEFAULT_PRODUCTION_CONFIG} from "../lib/production.ts";

const sessionsBetween=(start:string,end:string)=>{const out:string[]=[];const d=new Date(`${start}T12:00:00Z`),z=new Date(`${end}T12:00:00Z`);while(d<=z){const s=d.toISOString().slice(0,10);if(isNyseSession(s))out.push(s);d.setUTCDate(d.getUTCDate()+1)}return out};
const regimes=["強い上昇","レンジ","高ボラ"];

function seedLegacy(end:string):ForwardLedger{
  const ledger=emptyForwardLedger("2026-08-21T20:00:10Z");ledger.freezes=ledger.freezes.filter(x=>x.version==="VS13-v1.0");let equity=1_000_000;
  for(const [i,date] of sessionsBetween("2026-08-21",end).entries()){
    const trade=i<6;equity*=1.0002;ledger.records.push({key:`VS13-v1.0|${date}`,marketDataDate:date,recordedAt:`${date}T20:00:10Z`,recordMode:"LIVE",strategyId:"VS13",strategyName:"Volatility Shield 13%",strategyVersion:"VS13-v1.0",score:70,components:{trend:70,momentum:70,volatility:70,market:70},regime:regimes[i%regimes.length],targetExposure:.75,previousExposure:trade?0:.75,signal:trade?"INCREASE":"HOLD",tradeReason:"audit7 interaction fixture",intendedExecutionDate:date,execution:trade?{signalDate:date,intendedDate:date,recordedDate:date,price:100,before:0,after:.75,turnover:.75,commission:1,slippage:1,totalCost:2,status:"ON_TIME"}:null,assetClose:100,position:.75,quantity:7500,cash:250000,equity,dailyReturn:.0002,currentDrawdown:0,cumulativeCosts:2*Math.min(i+1,6),dataSource:"audit7",dataStatus:"VALID",buildVersion:"audit7"});
  }
  ledger.updatedAt=`${end}T20:00:10Z`;return ledger;
}

function seedPhase5(end:string):Phase5Ledger{
  const ledger=emptyPhase5Ledger("2026-08-25T20:00:10Z");const dates=sessionsBetween("2026-08-25",end);
  for(const [fi,freeze] of ledger.freezes.entries()){
    let equity=1_000_000;for(const [i,date] of dates.entries()){
      const trade=i<6;equity*=1.0002;ledger.records.push({key:`${freeze.version}|${date}`,marketDataDate:date,recordedAt:`${date}T20:00:10Z`,recordMode:"LIVE",strategyId:freeze.id,ticker:freeze.ticker,strategyName:freeze.name,strategyVersion:freeze.version,score:70,components:{trend:70,momentum:70,volatility:70,market:70},regime:regimes[(i+fi)%regimes.length],targetExposure:.75,previousExposure:trade?0:.75,signal:trade?"INCREASE":"HOLD",tradeReason:"audit7 interaction fixture",intendedExecutionDate:date,execution:trade?{signalDate:date,intendedDate:date,recordedDate:date,price:100,before:0,after:.75,turnover:.75,commission:1,slippage:1,totalCost:2,status:"ON_TIME"}:null,assetClose:100,position:.75,quantity:7500,cash:250000,equity,dailyReturn:.0002,currentDrawdown:0,cumulativeCosts:2*Math.min(i+1,6),dataSource:"audit7",dataStatus:"VALID",buildVersion:"audit7"});
    }
  }
  ledger.records.sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)||a.strategyVersion.localeCompare(b.strategyVersion));ledger.updatedAt=`${end}T20:00:10Z`;return ledger;
}

const lifecycleStatuses=(date:string,failedIncumbent=false)=>({
  phase5Status:{status:"success",errors:[],generatedAt:`${date}T20:00:30Z`,latestDates:{UPRO:date,SSO:date,QLD:date,SPY:date,QQQ:date,VIX:date},systems:{"UPRO-SPBT-v1.0":{status:"success",latestDate:date,errors:[]},"SSO-SPBT-Scaled-v1.0":{status:"success",latestDate:date,errors:[]},"QLD-VS13-Scaled-v1.0":{status:"success",latestDate:date,errors:[]}}},
  runtimeStatus:{generatedAt:`${date}T20:00:30Z`,actionStatus:failedIncumbent?"failed":"success",state:failedIncumbent?"failed":"latest",marketDataDate:date,errors:failedIncumbent?["incumbent feed unavailable"]:[]}
});

test("A7 D16 FC-01/06/12: formal review on holiday + incumbent failure opens only after next legal close and remains retryable",()=>{
  const phase5Blocked=seedPhase5("2027-07-06"),forwardBlocked=seedLegacy("2027-07-06");
  phase5Blocked.reviewSchedule={interim:"2027-01-04",formal:"2027-07-04",stronger:"2028-07-04"};
  assert.notEqual(lifecycleStageAt("2027-07-06T19:59:00Z",phase5Blocked.reviewSchedule),"FORMAL","holiday-dated formal review must not open before the next legal NYSE close");
  const prior=emptyLifecycleLedger(phase5Blocked.reviewSchedule,"2026-08-25T20:00:10Z");

  const blocked=updateLifecycleReview({phase5:phase5Blocked,forward:forwardBlocked,production:DEFAULT_PRODUCTION_CONFIG,prior,...lifecycleStatuses("2027-07-06",true),now:"2027-07-06T20:01:00Z"});
  assert.equal(blocked.current.stage,"FORMAL");assert.equal(blocked.current.userAction,"CHECK_DATA_AND_ACTIONS");assert.equal(blocked.current.nextReview,"2027-07-04");
  assert.equal(blocked.events.filter(e=>e.reviewDate==="2027-07-04").length,1);

  const phase5Recovered=seedPhase5("2027-07-07"),forwardRecovered=seedLegacy("2027-07-07");phase5Recovered.reviewSchedule=structuredClone(phase5Blocked.reviewSchedule);
  const recovered=updateLifecycleReview({phase5:phase5Recovered,forward:forwardRecovered,production:DEFAULT_PRODUCTION_CONFIG,prior:blocked,...lifecycleStatuses("2027-07-07",false),now:"2027-07-07T20:01:00Z"});
  assert.equal(recovered.current.userAction,"NONE","recovery from transient incumbent failure must not remain dead-ended");
  assert.equal(recovered.current.reviewResolved,true);assert.equal(recovered.current.nextReview,"2028-07-04");
  const cycleEvents=recovered.events.filter(e=>e.reviewDate==="2027-07-04");assert.equal(cycleEvents.length,2);assert.match(cycleEvents.at(-1)!.key,/RECOVERY/);
});

const priceSeries=(end:string,base:number,growth:number)=>sessionsBetween("2025-01-02",end).map((date,i)=>{const close=base*Math.pow(1+growth,i);return{date,open:close*.999,high:close*1.01,low:close*.99,close,adjClose:close,volume:1_000_000}});
const payload=(end:string)=>({source:"audit7",retrievedAt:`${end}T21:00:00Z`,series:{UPRO:priceSeries(end,40,.0012),SSO:priceSeries(end,50,.0008),QLD:priceSeries(end,60,.0009),SPY:priceSeries(end,100,.0004),QQQ:priceSeries(end,120,.0006),VIX:priceSeries(end,18,0)}});

test("A7 D20 FC-06/10: one Phase5 system failure is isolated and later retry catches up only that system without rewriting peers",()=>{
  const firstPayload=payload("2026-08-26") as any;delete firstPayload.series.SSO;
  let ledger=emptyPhase5Ledger("2026-08-25T15:15:00Z");
  ledger=updatePhase5LedgerSubset(firstPayload,ledger,["UPRO-SPBT-v1.0"],"2026-08-26T21:00:00Z");
  const beforeFailedAttempt=structuredClone(ledger);
  assert.throws(()=>updatePhase5LedgerSubset(firstPayload,ledger,["SSO-SPBT-Scaled-v1.0"],"2026-08-26T21:00:00Z"),/missing series for SSO/);
  assert.deepEqual(ledger,beforeFailedAttempt,"failed isolated system attempt must not mutate its supplied prior ledger");
  ledger=updatePhase5LedgerSubset(firstPayload,ledger,["QLD-VS13-Scaled-v1.0"],"2026-08-26T21:00:00Z");
  const peerPrefix=ledger.records.filter(r=>r.strategyVersion!=="SSO-SPBT-Scaled-v1.0").map(r=>structuredClone(r));

  const secondPayload=payload("2026-08-27");
  for(const version of ["UPRO-SPBT-v1.0","SSO-SPBT-Scaled-v1.0","QLD-VS13-Scaled-v1.0"])ledger=updatePhase5LedgerSubset(secondPayload,ledger,[version],"2026-08-27T21:00:00Z");
  const afterPeerPrefix=ledger.records.filter(r=>r.strategyVersion!=="SSO-SPBT-Scaled-v1.0"&&r.marketDataDate<="2026-08-26");
  assert.deepEqual(afterPeerPrefix,peerPrefix,"retry must preserve immutable peer history exactly");
  for(const version of ["UPRO-SPBT-v1.0","SSO-SPBT-Scaled-v1.0","QLD-VS13-Scaled-v1.0"]){const rows=ledger.records.filter(r=>r.strategyVersion===version);assert.equal(rows.at(-1)?.marketDataDate,"2026-08-27");}
  assert.equal(new Set(ledger.records.map(r=>r.key)).size,ledger.records.length,"subset recovery may not duplicate logical records");
});
