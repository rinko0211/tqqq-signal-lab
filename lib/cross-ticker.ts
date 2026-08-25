import { STRATEGIES, runBacktest, type Bar, type Dataset, type Metrics } from "./engine.ts";
import { fixedOos } from "./research.ts";

export type CrossTicker = "TQQQ" | "QLD" | "UPRO" | "SSO" | "SOXL" | "USD" | "TECL" | "ROM" | "TNA";
export type ResearchPhase = "CORE" | "CONDITIONAL" | "QUEUE" | "DEFERRED";
export type ScreeningRow = {
  ticker: CrossTicker;
  included: true;
  issuer: "ProShares" | "Direxion";
  leverage: "2x daily" | "3x daily";
  underlying: string;
  proxy: "QQQ" | "SPY" | "SOXX" | "XLK" | "IWM";
  inception: string;
  expenseRatio: number;
  aumUsd: number | null;
  dailyVolume: number;
  medianSpread: number | null;
  concentration: "Broad" | "Sector" | "Small cap";
  operationalQuality: number;
  researchPhase: ResearchPhase;
  forwardEligible: boolean;
  reason: string;
  officialUrl: string;
};

export const SCREENING_AS_OF = "2026-08-25";
export const SCREENING: ScreeningRow[] = [
  {ticker:"TQQQ",included:true,issuer:"ProShares",leverage:"3x daily",underlying:"Nasdaq-100",proxy:"QQQ",inception:"2010-02-09",expenseRatio:.0082,aumUsd:35_788_123_029,dailyVolume:47_654_275,medianSpread:.0001,concentration:"Broad",operationalQuality:98,researchPhase:"CORE",forwardEligible:true,reason:"既存基準。最大級のAUM、非常に厚い出来高。NASDAQ集中と3xの日次複利リスクは別途評価。",officialUrl:"https://www.proshares.com/our-etfs/leveraged-and-inverse/tqqq"},
  {ticker:"QLD",included:true,issuer:"ProShares",leverage:"2x daily",underlying:"Nasdaq-100",proxy:"QQQ",inception:"2006-06-19",expenseRatio:.0095,aumUsd:13_886_000_000,dailyVolume:2_570_952,medianSpread:.0001,concentration:"Broad",operationalQuality:98,researchPhase:"CORE",forwardEligible:false,reason:"同一Nasdaq-100で2xと3xを比較できる最重要Phase-1候補。長期履歴・AUM・0.01% median spreadが強い。",officialUrl:"https://www.proshares.com/our-etfs/leveraged-and-inverse/qld"},
  {ticker:"UPRO",included:true,issuer:"ProShares",leverage:"3x daily",underlying:"S&P 500",proxy:"SPY",inception:"2009-06-23",expenseRatio:.0089,aumUsd:5_501_024_129,dailyVolume:1_645_456,medianSpread:.0002,concentration:"Broad",operationalQuality:94,researchPhase:"CORE",forwardEligible:true,reason:"既存Track B。広い分散、長期実績、十分な流動性。",officialUrl:"https://www.proshares.com/our-etfs/leveraged-and-inverse/upro"},
  {ticker:"SSO",included:true,issuer:"ProShares",leverage:"2x daily",underlying:"S&P 500",proxy:"SPY",inception:"2006-06-19",expenseRatio:.0087,aumUsd:8_413_000_000,dailyVolume:1_973_256,medianSpread:.0001,concentration:"Broad",operationalQuality:97,researchPhase:"CORE",forwardEligible:false,reason:"同一S&P 500で2xと3xを比較できるCore候補。長期履歴・AUM・0.01% median spread。",officialUrl:"https://www.proshares.com/our-etfs/leveraged-and-inverse/sso"},
  {ticker:"SOXL",included:true,issuer:"Direxion",leverage:"3x daily",underlying:"NYSE Semiconductor Index",proxy:"SOXX",inception:"2010-03-11",expenseRatio:.0075,aumUsd:null,dailyVolume:49_839_000,medianSpread:null,concentration:"Sector",operationalQuality:86,researchPhase:"QUEUE",forwardEligible:false,reason:"非常に厚い出来高。ただし半導体集中と極端なvolatility drag。USDとは指数が違うため純粋な倍率比較には使わない。",officialUrl:"https://www.direxion.com/product/daily-semiconductor-bull-bear-3x-etfs"},
  {ticker:"USD",included:true,issuer:"ProShares",leverage:"2x daily",underlying:"Dow Jones U.S. Semiconductors Index",proxy:"SOXX",inception:"2007-01-30",expenseRatio:.0095,aumUsd:2_647_000_000,dailyVolume:534_085,medianSpread:.0007,concentration:"Sector",operationalQuality:82,researchPhase:"QUEUE",forwardEligible:false,reason:"半導体2xの参考候補。SOXLとはUnderlying indexが異なるため、2x対3xの因果比較からは除外。0.07% spreadもBroad系より不利。",officialUrl:"https://www.proshares.com/our-etfs/leveraged-and-inverse/usd"},
  {ticker:"TECL",included:true,issuer:"Direxion",leverage:"3x daily",underlying:"Technology Select Sector Index",proxy:"XLK",inception:"2008-12-17",expenseRatio:.0087,aumUsd:null,dailyVolume:477_000,medianSpread:null,concentration:"Sector",operationalQuality:75,researchPhase:"CONDITIONAL",forwardEligible:false,reason:"長い履歴と明確な指数だがTQQQとの重複が大きく、流動性はCore候補より弱い。",officialUrl:"https://www.direxion.com/product/daily-technology-bull-bear-3x-etfs"},
  {ticker:"ROM",included:true,issuer:"ProShares",leverage:"2x daily",underlying:"S&P Technology Select Sector Index",proxy:"XLK",inception:"2007-01-30",expenseRatio:.0095,aumUsd:1_225_000_000,dailyVolume:32_183,medianSpread:null,concentration:"Sector",operationalQuality:72,researchPhase:"CONDITIONAL",forwardEligible:false,reason:"Technology 2xの長期候補だが出来高がCore候補より大幅に小さい。運用適格性を定量成績より先に割り引く。",officialUrl:"https://www.proshares.com/our-etfs/leveraged-and-inverse/rom"},
  {ticker:"TNA",included:true,issuer:"Direxion",leverage:"3x daily",underlying:"Russell 2000",proxy:"IWM",inception:"2008-11-05",expenseRatio:.0105,aumUsd:null,dailyVolume:4_604_000,medianSpread:null,concentration:"Small cap",operationalQuality:80,researchPhase:"DEFERRED",forwardEligible:false,reason:"既存3x研究が弱く、Research multiplicityを増やさないためPhase 1では再選抜しない。",officialUrl:"https://www.direxion.com/product/daily-small-cap-bull-bear-3x-etfs"},
];

export const EXCLUDED = [
  {ticker:"SPXL",reason:"UPROと同じS&P 500の3xでExposureが重複。UPROを代表として採用。"},
  {ticker:"UWM",reason:"Russell 2000系は既存TNA成績が弱いためPhase 1ではDEFERRED。新しい仮説なしに探索範囲を広げない。"},
  {ticker:"FAS",reason:"金融セクター集中が強く、今回の限定UniverseではSector枠を増やさない。"},
  {ticker:"FNGG",reason:"短い履歴・低流動性で共通Frameworkの主要候補にしない。"},
  {ticker:"EURL",reason:"流動性が低く、日次運用候補として優先度が低い。"},
  {ticker:"Single-stock leveraged products",reason:"単一企業リスク、短い履歴、閉鎖リスクが高く、共通Frameworkの対象外。"},
  {ticker:"Inverse leveraged ETFs",reason:"ユーザー運用制約と長期の負のcompoundingを踏まえ、Production long tactical universeから除外。Research-only。"},
];

type Payload = { source?:string; retrievedAt?:string; crossSeries?:Record<string,Bar[]> };
const meta = (bars:Bar[]) => ({start:bars[0]?.date||"",end:bars.at(-1)?.date||"",count:bars.length,adjusted:false});

export function makeCrossTickerDataset(payload:Payload,row:ScreeningRow,start?:string):Dataset|null {
  const s=payload.crossSeries;if(!s)return null;
  const lev=s[row.ticker],under=s[row.proxy],spy=s.SPY,vix=s.VIX;
  if(!lev||!under||!spy||!vix)return null;
  const maps=[lev,under,spy,vix].map(x=>new Map(x.map(b=>[b.date,b])));
  const dates=lev.map(x=>x.date).filter(d=>(!start||d>=start)&&maps.slice(1).every(m=>m.has(d)));
  if(dates.length<252)return null;
  const days=dates.map(date=>({date,tqqq:maps[0].get(date)!,qqq:maps[1].get(date)!,spy:maps[2].get(date)!,vix:maps[3].get(date)!}));
  return{days,issues:[],source:"auto",precision:"next-open",retrievedAt:payload.retrievedAt,provider:payload.source,tickers:{TQQQ:meta(lev),QQQ:meta(under),SPY:meta(spy),VIX:meta(vix)}};
}

export type CrossResult={
  ticker:CrossTicker;underlying:string;proxy:string;leverage:"2x daily"|"3x daily";researchPhase:ResearchPhase;dataStart:string;dataEnd:string;days:number;actualOnly:true;
  full:Metrics;oos:Metrics;common:Metrics;normalized:Metrics;operationalQuality:number;researchScore:number;pareto:boolean;
  actionDaysPerYear:number;actionDayCapPassed:boolean;
};
export type CrossBundle={
  schemaVersion:1;generatedAt:string;asOf:string;source:string;actualSyntheticPolicy:string;commonStart:string|null;
  screening:ScreeningRow[];excluded:typeof EXCLUDED;results:CrossResult[];forwardCandidates:CrossTicker[];
  selectionRule:string;limitations:string[];
};

const norm=(x:number,min:number,max:number)=>max===min ? .5 : (x-min)/(max-min);
export function crossTickerBundle(payload:Payload):CrossBundle {
  const datasets=SCREENING.filter(row=>row.researchPhase!=="DEFERRED").map(row=>({row,ds:makeCrossTickerDataset(payload,row)})).filter((x):x is {row:ScreeningRow;ds:Dataset}=>Boolean(x.ds));
  const commonStart=datasets.length?datasets.map(x=>x.ds.days[0].date).sort().at(-1)!:null;
  const raw=datasets.map(({row,ds})=>{
    const full=runBacktest(ds,STRATEGIES.defensive).metrics;
    const oos=fixedOos(ds,STRATEGIES.defensive).metrics;
    const commonDs=commonStart?makeCrossTickerDataset(payload,row,commonStart)!:ds;
    const common=runBacktest(commonDs,STRATEGIES.defensive).metrics;
    const normalized=runBacktest(ds,{...STRATEGIES.defensive,sizing:"volTarget",targetPortfolioVol:.30}).metrics;
    const actionDaysPerYear=oos.ordersPerYear;
    return{ticker:row.ticker,underlying:row.underlying,proxy:row.proxy,leverage:row.leverage,researchPhase:row.researchPhase,dataStart:ds.days[0].date,dataEnd:ds.days.at(-1)!.date,days:ds.days.length,actualOnly:true as const,full,oos,common,normalized,operationalQuality:row.operationalQuality,researchScore:0,pareto:false,actionDaysPerYear,actionDayCapPassed:actionDaysPerYear<=40};
  });
  if(raw.length){
    const cagr=raw.map(x=>x.oos.cagr),calmar=raw.map(x=>x.oos.calmar),sortino=raw.map(x=>x.oos.sortino),dd=raw.map(x=>Math.abs(x.oos.maxDd));
    for(const r of raw)r.researchScore=.25*norm(r.oos.cagr,Math.min(...cagr),Math.max(...cagr))+.25*norm(r.oos.calmar,Math.min(...calmar),Math.max(...calmar))+.15*norm(r.oos.sortino,Math.min(...sortino),Math.max(...sortino))+.15*(1-norm(Math.abs(r.oos.maxDd),Math.min(...dd),Math.max(...dd)))+.20*r.operationalQuality/100;
    for(const a of raw)a.pareto=!raw.some(b=>b!==a&&b.oos.cagr>=a.oos.cagr&&b.oos.maxDd>=a.oos.maxDd&&(b.oos.cagr>a.oos.cagr||b.oos.maxDd>a.oos.maxDd));
  }
  const forwardCandidates=raw.filter(x=>{
    const row=SCREENING.find(s=>s.ticker===x.ticker)!;
    return row.forwardEligible&&x.actionDayCapPassed&&x.operationalQuality>=80&&x.pareto;
  }).sort((a,b)=>b.researchScore-a.researchScore).slice(0,3).map(x=>x.ticker);
  return{schemaVersion:1,generatedAt:new Date().toISOString(),asOf:SCREENING_AS_OF,source:payload.source||"Nasdaq Historical + Cboe VIX History",actualSyntheticPolicy:"Actual ETF OHLC only. Synthetic leveraged returns are not used or mixed.",commonStart,screening:SCREENING,excluded:EXCLUDED,results:raw,forwardCandidates,selectionRule:"Phase 1 extends the common VS13 screen to pre-registered 2x/3x products. New 2x products are screening-only and cannot enter Forward automatically. Production eligibility requires <=40 Action Days/year. Native tuning is forbidden in this phase.",limitations:["Phase 1 is screening, not final strategy selection; historical ranking cannot promote a new Production system.","USD tracks Dow Jones U.S. Semiconductors while SOXL tracks NYSE Semiconductor Index, so their comparison confounds leverage and underlying-index effects.","SOXX is only a liquid semiconductor proxy for signal context and is not the exact index for USD or SOXL.","ROM has substantially lower trading volume than QLD/SSO/TQQQ/UPRO, reducing operational confidence even if historical metrics are attractive.","Candidate selection has survivorship/selection bias; excluded, deferred and failed products remain in the registry."]};
}
