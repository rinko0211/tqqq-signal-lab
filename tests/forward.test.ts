import test from "node:test";
import assert from "node:assert/strict";
import { demoDataset } from "../lib/engine.ts";
import { emptyForwardLedger, summarizeForward, updateForwardLedger } from "../lib/forward.ts";
import { DEFAULT_PRODUCTION_CONFIG, assessHealth, resolveProductionSystem, transitionMode } from "../lib/production.ts";
import { emptyTickerForwardLedger } from "../lib/ticker-forward.ts";

function forwardDataset(extra=0){
  const base=demoDataset(),days=base.days.slice(0,201+extra).map((d,i)=>({...d,date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10)}));
  days[200]={...days[200],date:"2026-08-21"};
  if(extra>=1)days[201]={...days[201],date:"2026-08-24"};
  if(extra>=2)days[202]={...days[202],date:"2026-08-25"};
  return{...base,days};
}

test("Forward freezeはVS13 Championを固定し12/30候補を別Versionにする",()=>{
  const ledger=emptyForwardLedger("2026-08-24T00:00:00Z");
  assert.equal(ledger.championId,"VS13");
  assert.deepEqual(ledger.freezes.slice(0,3).map(x=>x.version),["VS13-v1.0","VS12-v1.0","VT30-v1.0"]);
  assert.match(ledger.promotionRule,/Human approval only/);
});

test("Forward履歴は同一日再実行で重複せずAppend-only",()=>{
  const ds=forwardDataset(),first=updateForwardLedger(ds,null,"test","2026-08-24T00:00:00Z"),second=updateForwardLedger(ds,first,"test","2026-08-24T01:00:00Z");
  assert.equal(first.records.length,5);
  assert.equal(second.records.length,5);
  assert.deepEqual(second.records.map(x=>x.key),first.records.map(x=>x.key));
});

test("t日Signalはt+1始値で約定し費用を記録する",()=>{
  const first=updateForwardLedger(forwardDataset(),null,"test","2026-08-24T00:00:00Z");
  const second=updateForwardLedger(forwardDataset(1),first,"test","2026-08-25T00:00:00Z");
  const record=second.records.find(x=>x.strategyId==="TQQQ_BH"&&x.marketDataDate==="2026-08-24")!;
  assert.equal(record.execution?.signalDate,"2026-08-21");
  assert.equal(record.execution?.intendedDate,"2026-08-24");
  assert.equal(record.execution?.status,"ON_TIME");
  assert.ok((record.execution?.commission||0)>0);
  assert.ok((record.execution?.slippage||0)>0);
});

test("失敗日を後日補完しても過去Signalを後知恵生成しない",()=>{
  const first=updateForwardLedger(forwardDataset(),null,"test","2026-08-24T00:00:00Z");
  const caught=updateForwardLedger(forwardDataset(2),first,"test","2026-08-26T00:00:00Z");
  const missing=caught.records.find(x=>x.strategyId==="VS13"&&x.marketDataDate==="2026-08-24")!;
  assert.equal(missing.recordMode,"BACKFILLED_OBSERVATION");
  assert.equal(missing.dataStatus,"BACKFILLED_NO_SIGNAL");
  assert.match(missing.tradeReason,/後知恵/);
  assert.equal(caught.records.find(x=>x.strategyId==="VS13"&&x.marketDataDate==="2026-08-25")?.recordMode,"LIVE");
});

test("Evidenceは短いForward期間をStrongと誤表示しない",()=>{
  const ledger=updateForwardLedger(forwardDataset(),null,"test","2026-08-24T00:00:00Z");
  assert.ok(summarizeForward(ledger).every(x=>x.evidence==="Insufficient"));
});

test("UPRO ForwardはCommon VS13をTrack B固有の比較基準にする",()=>{
  const ledger=emptyTickerForwardLedger("2026-08-24T00:00:00Z");
  const rows=summarizeForward(ledger);
  assert.equal(ledger.championId,"UPRO_VS13");
  assert.equal(rows.find(x=>x.id==="UPRO_VS13")?.status,"KEEP CHAMPION");
  assert.equal(rows.find(x=>x.id==="UPRO_NATIVE")?.status,"INSUFFICIENT EVIDENCE");
});

test("データSource変更後も以前のForward Recordを書き換えない",()=>{
  const first=updateForwardLedger(forwardDataset(),null,"source-A","2026-08-24T00:00:00Z");
  const next=updateForwardLedger(forwardDataset(1),first,"source-B","2026-08-25T00:00:00Z");
  assert.ok(next.records.filter(x=>x.marketDataDate==="2026-08-21").every(x=>x.dataSource==="source-A"));
  assert.ok(next.records.filter(x=>x.marketDataDate==="2026-08-24").every(x=>x.dataSource==="source-B"));
});

test("ProductionはDECISIONと明示Human Approvalなしに開始できない",()=>{
  assert.throws(()=>transitionMode(DEFAULT_PRODUCTION_CONFIG,"PRODUCTION"),/DECISION/);
  const decision=transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION");
  assert.throws(()=>transitionMode(decision,"PRODUCTION"),/Human approval/);
  assert.throws(()=>transitionMode(decision,"PRODUCTION",{ticker:"TQQQ",system:"Volatility Shield 13%",version:"VS13-v1.0",date:"2027-08-23"}),/Strong Forward evidence/);
  const production=transitionMode(decision,"PRODUCTION",{ticker:"TQQQ",system:"Volatility Shield 13%",version:"VS13-v1.0",date:"2027-08-23",evidence:"Strong",finalReviewComplete:true});
  assert.equal(production.mode,"PRODUCTION");assert.equal(production.approvedByHuman,true);assert.equal(production.nextHealthReview,"2027-11-23");
});

test("Productionは登録済みTicker × Strategy × Versionだけを許可する",()=>{
  assert.equal(resolveProductionSystem("UPRO","UPRO-Native-v1.0").config.targetPortfolioVol,.25);
  assert.throws(()=>resolveProductionSystem("TECL","TECL-Native-v1.0"),/unregistered production system/);
  assert.throws(()=>resolveProductionSystem("UPRO","UPRO-Native-v1.0","任意入力"),/does not match/);
});

test("Health Reviewは異常を示してもStrategyを自動置換しない",()=>{
  assert.equal(assessHealth({integrity:true,dataFresh:true,dd:-.50,historicalDd:-.38,rollingSortino:1,benchmarkGap:0,costRatio:1}),"Revalidation Required");
  assert.equal(assessHealth({integrity:false,dataFresh:true,dd:0,historicalDd:-.38,rollingSortino:1,benchmarkGap:0,costRatio:1}),"Critical");
  assert.equal(DEFAULT_PRODUCTION_CONFIG.selectedStrategy,null);
});
