import test from "node:test";
import assert from "node:assert/strict";
import {STRATEGIES,annualize,demoDataset,maxDrawdown,metricSet,nextExecutionDate,parseMarketCsv,runBacktest,signals,walkForward} from "../lib/engine.ts";
import type {StrategyConfig} from "../lib/engine.ts";
import {blockBootstrap,drawdownEpisodes,regimeAttribution} from "../lib/research.ts";

const close=(a:number,b:number)=>Math.abs(a-b)<1e-9;

test("日次リターン・Total Return・CAGRは固定値と一致する",()=>{
  const returns=[.10,-.05,.02];
  const metrics=metricSet(returns);
  assert.ok(close(metrics.totalReturn,1.10*.95*1.02-1));
  assert.ok(close(metrics.cagr,annualize(returns)));
});

test("Sharpe・Sortino・Maximum Drawdown・Calmarを計算する",()=>{
  const returns=[.10,-.10,.05,-.02];
  const metrics=metricSet(returns);
  assert.ok(Number.isFinite(metrics.sharpe));
  assert.ok(Number.isFinite(metrics.sortino));
  assert.ok(close(metrics.maxDd,-.10));
  assert.ok(close(metrics.calmar,metrics.cagr/Math.abs(metrics.maxDd)));
  assert.ok(close(maxDrawdown([1,1.2,.9,1.1]),-.25));
});

test("Profit Factor・勝率・平均保有期間・最大連敗",()=>{
  const rounds=[
    {entry:"2024-01-01",exit:"2024-01-10",return:.20,mfe:.3,mae:-.05,days:7},
    {entry:"2024-02-01",exit:"2024-02-05",return:-.10,mfe:.02,mae:-.12,days:3},
    {entry:"2024-03-01",exit:"2024-03-05",return:-.05,mfe:.01,mae:-.08,days:3},
  ];
  const m=metricSet([0,0,0],rounds);
  assert.ok(close(m.winRate,1/3));
  assert.ok(close(m.profitFactor,.2/.15));
  assert.ok(close(m.avgHold,13/3));
  assert.equal(m.maxLossStreak,2);
});

test("CSV長形式・複数ファイル・調整OHLCを読み込む",()=>{
  const make=(ticker:string)=>({name:`${ticker}.csv`,text:["Date,Open,High,Low,Close,Adj Close,Volume",...Array.from({length:260},(_,i)=>{const d=new Date(Date.UTC(2023,0,2+i));return `${d.toISOString().slice(0,10)},100,110,90,100,50,1000`})].join("\n")});
  const ds=parseMarketCsv([make("TQQQ"),make("QQQ"),make("SPY"),make("VIX")]);
  assert.equal(ds.precision,"next-open");
  assert.equal(ds.days[0].tqqq.open,50);
  assert.equal(ds.days[0].tqqq.high,55);
  assert.equal(ds.days.length,260);
});

test("欠損Ticker・重複日・始値欠損を黙って補完しない",()=>{
  const text="Date,Close,Adj Close,Ticker\n2024-01-02,10,10,TQQQ\n2024-01-02,10,10,TQQQ";
  const ds=parseMarketCsv([{name:"mixed.csv",text}]);
  assert.equal(ds.precision,"next-close");
  assert.ok(ds.issues.some(x=>x.code==="duplicate"));
  assert.ok(ds.issues.some(x=>x.code==="missing-ticker"&&x.severity==="error"));
});

function fixedDataset(){
  const ds=demoDataset(),days=ds.days.slice(0,205);
  for(let i=0;i<days.length;i++)for(const ticker of ["tqqq","qqq","spy"] as const){days[i][ticker]={...days[i][ticker],open:100,high:100,low:100,close:100,adjClose:100}}
  for(const d of days)d.vix={...d.vix,open:15,high:15,low:15,close:15,adjClose:15};
  days[201].tqqq={...days[201].tqqq,open:110,high:121,low:110,close:121,adjClose:121};
  return{...ds,days};
}

test("t日終値シグナルはt+1始値で約定し、同日終値を使わない",()=>{
  const ds=fixedDataset(),config:StrategyConfig={...STRATEGIES.adaptive,entry:0,exit:-1,strong:0,confirmDays:1,minHold:0,cooldown:0,trailStop:.99,weights:{trend:1,momentum:0,volatility:0,market:0}};
  const bt=runBacktest(ds,config,{commissionBps:0,slippageBps:0,delay:1});
  const order=bt.orders[0];
  assert.equal(order.signalDate,ds.days[200].date);
  assert.equal(order.executionDate,ds.days[201].date);
  assert.equal(order.executionPrice,110);
  const day=bt.daily.find(x=>x.date===ds.days[201].date)!;
  assert.ok(close(day.dailyReturn,.10));
});

test("始値なしのt+1終値代替でも価格リターンを資産曲線へ反映する",()=>{
  const ds=fixedDataset(),config:StrategyConfig={...STRATEGIES.adaptive,entry:0,exit:-1,strong:0,confirmDays:1,minHold:0,cooldown:0,trailStop:.99,weights:{trend:1,momentum:0,volatility:0,market:0}};
  ds.precision="next-close";ds.days[201].tqqq={...ds.days[201].tqqq,close:110,adjClose:110};ds.days[202].tqqq={...ds.days[202].tqqq,close:121,adjClose:121};
  const bt=runBacktest(ds,config,{commissionBps:0,slippageBps:0,delay:1}),day=bt.daily.find(x=>x.date===ds.days[202].date)!;
  assert.ok(close(day.dailyReturn,.10));
});

test("拡張指標は資産曲線・保有比率・保有日数から計算する",()=>{
  const rounds=[{entry:"2024-01-01",exit:"2024-01-03",return:.1,mfe:.1,mae:0,days:2},{entry:"2024-02-01",exit:"2024-02-08",return:-.05,mfe:0,mae:-.05,days:5}];
  const m=metricSet([.1,-.2,.15],rounds,[],[],[0,.5,1]);
  assert.ok(close(m.exposure,.5));assert.ok(close(m.timeInCash,1/3));assert.ok(close(m.medianHold,3.5));assert.ok(close(m.expectancy,.025));assert.ok(m.annualizedVolatility>0);assert.ok(m.ulcerIndex>0);
});

test("DD Attribution・Regime・Block Bootstrapは再現可能な値を返す",()=>{
  const bt=runBacktest(demoDataset(),STRATEGIES.defensive),dd=drawdownEpisodes(bt),regime=regimeAttribution(bt),a=blockBootstrap(bt,50,10),b=blockBootstrap(bt,50,10);
  assert.ok(dd.length>0&&dd.length<=10);assert.ok(dd.every(x=>x.peak<=x.trough));assert.ok(regime.length>=3);assert.deepEqual(a,b);assert.ok(a.prob30>=0&&a.prob30<=1);
});

test("OOS開始前のシグナルは開始ポジションへ持ち越さない",()=>{
  const ds=fixedDataset(),activeFrom=ds.days[202].date;
  const config:StrategyConfig={...STRATEGIES.adaptive,activeFrom,entry:0,exit:-1,strong:0,confirmDays:1,minHold:0,cooldown:0,trailStop:.99,weights:{trend:1,momentum:0,volatility:0,market:0}};
  const bt=runBacktest(ds,config,{commissionBps:0,slippageBps:0,delay:1});
  assert.ok(bt.orders.every(order=>order.signalDate>=activeFrom));
  assert.equal(bt.orders[0].executionDate,ds.days[203].date);
});

test("トレーリングストップはQQQではなくTQQQ価格で判定する",()=>{
  const ds=fixedDataset();
  ds.days[200].tqqq={...ds.days[200].tqqq,open:100,high:100,low:100,close:100,adjClose:100};
  ds.days[201].tqqq={...ds.days[201].tqqq,open:120,high:120,low:120,close:120,adjClose:120};
  ds.days[202].tqqq={...ds.days[202].tqqq,open:90,high:90,low:90,close:90,adjClose:90};
  const config:StrategyConfig={...STRATEGIES.adaptive,entry:0,exit:-1,strong:0,confirmDays:1,minHold:0,cooldown:0,trailStop:.17,weights:{trend:1,momentum:0,volatility:0,market:0}};
  const result=signals(ds.days,config);
  assert.equal(result[201].target,1);
  assert.equal(result[202].target,0);
  assert.match(result[202].reason,/トレーリングストップ/);
});

test("手数料・スリッページと段階ポジション変更量を控除する",()=>{
  const ds=fixedDataset(),config:StrategyConfig={...STRATEGIES.adaptive,entry:0,exit:-1,strong:101,confirmDays:1,minHold:0,cooldown:0,trailStop:.99,mode:"three",weights:{trend:1,momentum:0,volatility:0,market:0}};
  const bt=runBacktest(ds,config,{commissionBps:3,slippageBps:5,delay:1}),order=bt.orders[0];
  assert.equal(order.after,.5);
  assert.ok(close(order.turnover,.5));
  assert.ok(close(order.cost,.0004));
  assert.ok(close(order.executionPrice,110*(1+.0005)));
});

test("取引回数の定義を分離する",()=>{
  const orders=[
    {signalDate:"2024-01-01",executionDate:"2024-01-02",executionPrice:1,before:0,after:.5,turnover:.5,cost:0,reason:"",regime:"",components:{trend:0,momentum:0,volatility:0,market:0},score:0,subsequentPnl:0,mfe:0,mae:0,holdingDays:0},
    {signalDate:"2024-01-02",executionDate:"2024-01-03",executionPrice:1,before:.5,after:1,turnover:.5,cost:0,reason:"",regime:"",components:{trend:0,momentum:0,volatility:0,market:0},score:0,subsequentPnl:0,mfe:0,mae:0,holdingDays:0},
    {signalDate:"2024-01-03",executionDate:"2024-01-04",executionPrice:1,before:1,after:0,turnover:1,cost:0,reason:"",regime:"",components:{trend:0,momentum:0,volatility:0,market:0},score:0,subsequentPnl:0,mfe:0,mae:0,holdingDays:0},
  ];
  const m=metricSet(Array(252).fill(0),[],orders);
  assert.equal(m.entries,1);assert.equal(m.exits,1);assert.equal(m.rebalanceOrders,1);assert.equal(m.changeDays,3);assert.ok(close(m.annualTurnover,2));
});

test("Walk-Forwardは4年IS直後だけをOOSにし最終2年をホールドアウトする",()=>{
  const ds=demoDataset(),wf=walkForward(ds),years=[...new Set(ds.days.map(d=>+d.date.slice(0,4)))].sort(),holdout=years.at(-2)!;
  assert.ok(wf.years.every(x=>x.year<holdout));
  assert.equal(wf.holdout?.startYear,holdout);
  assert.ok(wf.oosCurve.every(x=>+x.date.slice(0,4)<holdout));
  assert.equal(new Set(wf.oosCurve.map(x=>x.date)).size,wf.oosCurve.length);
});

test("営業日ベースの実行予定日を返す",()=>{
  assert.equal(nextExecutionDate("2026-08-21"),"2026-08-24");
  assert.equal(nextExecutionDate("2026-08-20",2),"2026-08-24");
  assert.equal(nextExecutionDate("2026-12-24"),"2026-12-28");
});
