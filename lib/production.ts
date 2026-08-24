export type PlatformMode="RESEARCH"|"DECISION"|"PRODUCTION";
export type HealthState="Healthy"|"Watch"|"Revalidation Required"|"Critical";
export type ProductionConfig={schemaVersion:1;mode:PlatformMode;selectedTicker:string|null;selectedStrategy:string|null;strategyVersion:string|null;approvedByHuman:boolean;approvalDate:string|null;effectiveDate:string|null;lastHealthReview:string|null;nextHealthReview:string|null;updatedAt:string};
export const DEFAULT_PRODUCTION_CONFIG:ProductionConfig={schemaVersion:1,mode:"RESEARCH",selectedTicker:null,selectedStrategy:null,strategyVersion:null,approvedByHuman:false,approvalDate:null,effectiveDate:null,lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-24T00:00:00.000Z"};
export const HEALTH_POLICY={version:"health-policy-1.0",recommended:"Hybrid",operational:"Daily automated",strategy:"Quarterly",formal:"Annual",eventDriven:"Immediate",reason:"約10〜12注文/年の中期戦略ではMonthlyの成績判定は標本が少なく誤警報が多い。一方、レバレッジETFの商品・データ・流動性リスクは日次監視が必要。四半期は劣化傾向の観察、年次は十分な取引数で正式再検証する。",alternatives:[{frequency:"Monthly",benefit:"問題を早く発見",cost:"取引標本が1件前後でNoiseとForward overfittingが大きい",adopt:false},{frequency:"Quarterly",benefit:"運用劣化の早期傾向と標本量の妥協",cost:"単独では正式な戦略変更に弱い",adopt:true},{frequency:"Semiannual",benefit:"Noiseを抑えやすい",cost:"商品構造・実装問題への反応が遅い",adopt:false},{frequency:"Annual",benefit:"正式再検証に十分な取引標本を得やすい",cost:"運用監視には遅すぎる",adopt:true},{frequency:"Event-driven",benefit:"商品・データ・DD異常へ即応",cost:"客観的Triggerがないと恣意的",adopt:true},{frequency:"Hybrid",benefit:"日次運用監視、四半期傾向、年次判断を分離",cost:"状態管理が必要",adopt:true}]};
export const DEGRADATION_RULES=["Forward DDがHistorical Max DDより10pt以上悪化、またはStress envelopeを超過","12か月Rolling Sortinoが0未満、かつ単純Benchmarkへ15pt以上劣後","実コストが想定8bpsの2倍を3回連続で超過","ETF目的・leverage・指数Methodology・流動性に重大変更","データ汚染、重複約定、Look-ahead、実行不能を検出"];
export function transitionMode(current:ProductionConfig,next:PlatformMode,approval?:{system:string;ticker:string;version:string;date:string}):ProductionConfig{
  if(current.mode==="RESEARCH"&&next==="PRODUCTION")throw Error("DECISION review is required before PRODUCTION");
  if(next==="PRODUCTION"&&!approval)throw Error("Human approval is required");
  if(next==="DECISION")return{...current,mode:next,approvedByHuman:false,updatedAt:new Date().toISOString()};
  if(next==="PRODUCTION")return{...current,mode:next,selectedTicker:approval!.ticker,selectedStrategy:approval!.system,strategyVersion:approval!.version,approvedByHuman:true,approvalDate:approval!.date,effectiveDate:approval!.date,nextHealthReview:addMonths(approval!.date,3),updatedAt:new Date().toISOString()};
  return{...DEFAULT_PRODUCTION_CONFIG,updatedAt:new Date().toISOString()};
}
const addMonths=(date:string,n:number)=>{const d=new Date(date+"T00:00:00Z");d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10)};
export function assessHealth(x:{integrity:boolean;dataFresh:boolean;dd:number;historicalDd:number;rollingSortino:number;benchmarkGap:number;costRatio:number;structuralEvent?:boolean}):HealthState{
  if(!x.integrity||x.structuralEvent)return"Critical";
  if(!x.dataFresh||x.dd<x.historicalDd-.10||x.costRatio>2)return"Revalidation Required";
  if(x.rollingSortino<0&&x.benchmarkGap<-.15)return"Watch";
  return"Healthy";
}
