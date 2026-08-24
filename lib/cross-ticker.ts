import { STRATEGIES, runBacktest, type Bar, type Dataset, type Metrics } from "./engine.ts";
import { fixedOos } from "./research.ts";

export type CrossTicker = "TQQQ" | "UPRO" | "SOXL" | "TECL" | "TNA";
export type ScreeningRow = {
  ticker: CrossTicker;
  included: true;
  issuer: "ProShares" | "Direxion";
  leverage: "3x daily";
  underlying: string;
  proxy: "QQQ" | "SPY" | "SOXX" | "XLK" | "IWM";
  inception: string;
  expenseRatio: number;
  aumUsd: number | null;
  dailyVolume: number;
  medianSpread: number | null;
  concentration: "Broad" | "Sector" | "Small cap";
  operationalQuality: number;
  reason: string;
  officialUrl: string;
};

export const SCREENING_AS_OF = "2026-08-24";
export const SCREENING: ScreeningRow[] = [
  {ticker:"TQQQ",included:true,issuer:"ProShares",leverage:"3x daily",underlying:"Nasdaq-100",proxy:"QQQ",inception:"2010-02-09",expenseRatio:.0082,aumUsd:35_788_123_029,dailyVolume:47_654_275,medianSpread:.0001,concentration:"Broad",operationalQuality:98,reason:"最大級のAUM、非常に厚い出来高、0.01%の公表median spread。NASDAQ集中は別途リスク。",officialUrl:"https://www.proshares.com/our-etfs/leveraged-and-inverse/tqqq"},
  {ticker:"UPRO",included:true,issuer:"ProShares",leverage:"3x daily",underlying:"S&P 500",proxy:"SPY",inception:"2009-06-23",expenseRatio:.0089,aumUsd:5_501_024_129,dailyVolume:1_645_456,medianSpread:.0002,concentration:"Broad",operationalQuality:94,reason:"広い分散、長期実績、十分なAUMと0.02%の公表median spread。",officialUrl:"https://www.proshares.com/our-etfs/leveraged-and-inverse/upro"},
  {ticker:"SOXL",included:true,issuer:"Direxion",leverage:"3x daily",underlying:"NYSE Semiconductor Index",proxy:"SOXX",inception:"2010-03-11",expenseRatio:.0075,aumUsd:null,dailyVolume:49_839_000,medianSpread:null,concentration:"Sector",operationalQuality:86,reason:"非常に厚い出来高と長い履歴。ただし半導体集中と極端なvolatility dragを重く評価。",officialUrl:"https://www.direxion.com/product/daily-semiconductor-bull-bear-3x-etfs"},
  {ticker:"TECL",included:true,issuer:"Direxion",leverage:"3x daily",underlying:"Technology Select Sector Index",proxy:"XLK",inception:"2008-12-17",expenseRatio:.0087,aumUsd:null,dailyVolume:477_000,medianSpread:null,concentration:"Sector",operationalQuality:75,reason:"長い履歴と明確な指数。TQQQと重複が大きく、出来高は上位3銘柄より薄い。",officialUrl:"https://www.direxion.com/product/daily-technology-bull-bear-3x-etfs"},
  {ticker:"TNA",included:true,issuer:"Direxion",leverage:"3x daily",underlying:"Russell 2000",proxy:"IWM",inception:"2008-11-05",expenseRatio:.0105,aumUsd:null,dailyVolume:4_604_000,medianSpread:null,concentration:"Small cap",operationalQuality:80,reason:"NASDAQ/S&Pと異なる小型株Exposure。流動性は十分だが費用と景気感応度が高い。",officialUrl:"https://www.direxion.com/product/daily-small-cap-bull-bear-3x-etfs"},
];

export const EXCLUDED = [
  {ticker:"SPXL",reason:"UPROと同じS&P 500の3xでExposureが重複。UPROを代表として採用。"},
  {ticker:"FAS",reason:"金融セクター集中が強く、今回の5銘柄枠ではSOXL/TECLと重複するSector枠を増やさない。"},
  {ticker:"FNGG",reason:"2021年設定、公式出来高5,600株で履歴・流動性が不足。"},
  {ticker:"EURL",reason:"公式出来高12,200株で、日次運用候補として流動性が不足。"},
  {ticker:"Single-stock 2x products",reason:"単一企業リスク、短い履歴、閉鎖リスクが高く、共通Frameworkの対象外。"},
  {ticker:"Inverse leveraged ETFs",reason:"長期の負のcompoundingと用途の違いにより、Long tactical allocationの候補外。"},
];

type Payload = { source?:string; retrievedAt?:string; crossSeries?:Record<string,Bar[]> };
const meta = (bars:Bar[]) => ({start:bars[0]?.date||"",end:bars.at(-1)?.date||"",count:bars.length,adjusted:false});

function makeDataset(payload:Payload,row:ScreeningRow,start?:string):Dataset|null {
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
  ticker:CrossTicker;underlying:string;proxy:string;dataStart:string;dataEnd:string;days:number;actualOnly:true;
  full:Metrics;oos:Metrics;common:Metrics;normalized:Metrics;operationalQuality:number;researchScore:number;pareto:boolean;
};
export type CrossBundle={
  schemaVersion:1;generatedAt:string;asOf:string;source:string;actualSyntheticPolicy:string;commonStart:string|null;
  screening:ScreeningRow[];excluded:typeof EXCLUDED;results:CrossResult[];forwardCandidates:CrossTicker[];
  selectionRule:string;limitations:string[];
};

const norm=(x:number,min:number,max:number)=>max===min ? .5 : (x-min)/(max-min);
export function crossTickerBundle(payload:Payload):CrossBundle {
  const datasets=SCREENING.map(row=>({row,ds:makeDataset(payload,row)})).filter((x):x is {row:ScreeningRow;ds:Dataset}=>Boolean(x.ds));
  const commonStart=datasets.length?datasets.map(x=>x.ds.days[0].date).sort().at(-1)!:null;
  const raw=datasets.map(({row,ds})=>{
    const full=runBacktest(ds,STRATEGIES.defensive).metrics;
    const oos=fixedOos(ds,STRATEGIES.defensive).metrics;
    const commonDs=commonStart?makeDataset(payload,row,commonStart)!:ds;
    const common=runBacktest(commonDs,STRATEGIES.defensive).metrics;
    const normalized=runBacktest(ds,{...STRATEGIES.defensive,sizing:"volTarget",targetPortfolioVol:.30}).metrics;
    return{ticker:row.ticker,underlying:row.underlying,proxy:row.proxy,dataStart:ds.days[0].date,dataEnd:ds.days.at(-1)!.date,days:ds.days.length,actualOnly:true as const,full,oos,common,normalized,operationalQuality:row.operationalQuality,researchScore:0,pareto:false};
  });
  const cagr=raw.map(x=>x.oos.cagr),calmar=raw.map(x=>x.oos.calmar),sortino=raw.map(x=>x.oos.sortino),dd=raw.map(x=>Math.abs(x.oos.maxDd));
  for(const r of raw)r.researchScore=.25*norm(r.oos.cagr,Math.min(...cagr),Math.max(...cagr))+.25*norm(r.oos.calmar,Math.min(...calmar),Math.max(...calmar))+.15*norm(r.oos.sortino,Math.min(...sortino),Math.max(...sortino))+.15*(1-norm(Math.abs(r.oos.maxDd),Math.min(...dd),Math.max(...dd)))+.20*r.operationalQuality/100;
  for(const a of raw)a.pareto=!raw.some(b=>b!==a&&b.oos.cagr>=a.oos.cagr&&b.oos.maxDd>=a.oos.maxDd&&(b.oos.cagr>a.oos.cagr||b.oos.maxDd>a.oos.maxDd));
  const forwardCandidates=raw.filter(x=>x.operationalQuality>=80&&x.pareto).sort((a,b)=>b.researchScore-a.researchScore).slice(0,3).map(x=>x.ticker);
  return{schemaVersion:1,generatedAt:new Date().toISOString(),asOf:SCREENING_AS_OF,source:payload.source||"Nasdaq Historical + Cboe VIX History",actualSyntheticPolicy:"Actual ETF OHLC only. Synthetic leveraged returns are not used or mixed.",commonStart,screening:SCREENING,excluded:EXCLUDED,results:raw,forwardCandidates,selectionRule:"Common VS13 framework; OOS return 25%, OOS Calmar 25%, OOS Sortino 15%, OOS DD 15%, Operational Quality 20%. ParetoかつOperational Quality>=80から最大3銘柄。自動Champion化は禁止。",limitations:["SOXX is a liquid proxy for SOXL's NYSE Semiconductor Index and is not the exact index.","Direxion accessible product pages did not expose fund-level AUM or median spread; missing fields reduce confidence and require issuer verification before real capital.","Candidate selection has survivorship/selection bias; excluded and failed products remain in the registry."]};
}
