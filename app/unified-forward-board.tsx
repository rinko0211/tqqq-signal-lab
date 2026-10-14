"use client";
import {useEffect,useMemo,useState} from "react";
import {summarizeForward,type ForwardLedger} from "../lib/forward";
import {summarizePhase5,type Phase5Ledger} from "../lib/phase5-forward";
import {GOLD_DATA_BASE,parseGoldForwardEvidence,type GoldEvidence} from "../lib/gold-forward-evidence";
import {parseGoldModelEvidence,type GoldModelEvidence} from "../lib/gold-performance-evidence";

type Source="VS13系"|"Native/比較"|"Gold50";
type UnifiedRow={
 version:string;asset:string;source:Source;role:string;start:string;latest:string|null;
 observations:number;modelReturn:number|null;maxDd:number|null;
 modelOrders:number|null;allocation:string;evidence:string;dataState:string;
};
type Props={tqqq:ForwardLedger|null;phase5:Phase5Ledger|null;compact?:boolean};
const fmtPct=(n:number|null)=>n===null||!Number.isFinite(n)?"—":(n>=0?"+":"")+(100*n).toFixed(1)+"%";
const safeDate=(d:unknown)=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)?d:null;
const fallback:GoldEvidence={ok:false,reason:null,status:null,phaseC:null,rows:[],segments:[],gaps:[]};
const riskFallback:GoldModelEvidence={ok:false,reason:null,status:null,rows:[]};
function statusLabel(row:UnifiedRow){
 if(row.dataState==="要確認")return "データ確認";
 if(row.observations===0)return "初回待ち";
 if(row.source==="Gold50")return "配分観測中";
 return "暫定・検証中";
}
function stateTone(row:UnifiedRow){
 if(row.dataState==="要確認")return "bad";
 if(row.observations===0)return "neutral";
 return "warn";
}
export function UnifiedForwardBoard({tqqq,phase5,compact=false}:Props){
 const [gold,setGold]=useState<GoldEvidence>(fallback);
 const [goldRisk,setGoldRisk]=useState<GoldModelEvidence>(riskFallback);
 const [goldLoading,setGoldLoading]=useState(true);
 useEffect(()=>{
  let active=true;
  const refresh=async()=>{
   try{
    const names=["forward/status.json","phase-c/status.json","forward/ledger.jsonl","forward/performance-status.json","forward/performance-ledger.jsonl"];
    const texts=await Promise.all(names.map(async name=>{
     const url=GOLD_DATA_BASE+name;
     const response=await fetch(url,{cache:"no-store",redirect:"error"});
     if(!response.ok||response.redirected||response.url.split("?")[0]!==url)throw Error("Gold50公開記録取得エラー");
     const body=await response.text();
     if(body.length>600000)throw Error("Gold50公開記録が大きすぎます");
     return body;
    }));
    if(active){const ev=parseGoldForwardEvidence(JSON.parse(texts[0]),JSON.parse(texts[1]),texts[2]);
     setGold(ev);setGoldRisk(parseGoldModelEvidence(JSON.parse(texts[3]),texts[4],ev));}
   }catch{
    if(active){setGold({...fallback,reason:"Gold50データ取得失敗"});setGoldRisk({...riskFallback,reason:"Gold50 DDデータ取得失敗"});}
   }finally{if(active)setGoldLoading(false)}
  };
  void refresh();
  const timer=setInterval(()=>void refresh(),300000);
  return()=>{active=false;clearInterval(timer)};
 },[]);
 const rows=useMemo(()=>{
  const all:UnifiedRow[]=[];
  if(tqqq)for(const s of summarizeForward(tqqq)){
   const freeze=tqqq.freezes.find(f=>f.version===s.version);
   const records=tqqq.records.filter(r=>r.strategyVersion===s.version);
   const last=records.at(-1);
   all.push({version:s.version,asset:freeze?.asset??"TQQQ",source:"VS13系",
    role:s.role==="champion"?"基準":s.role==="benchmark"?"比較指標":"対抗",
    start:freeze?.startDate??"—",latest:safeDate(last?.marketDataDate),
    observations:s.observations,modelReturn:records.length?s.totalReturn:null,
    maxDd:records.length?s.metrics.maxDd:null,modelOrders:s.orders,
    allocation:last?fmtPct(last.targetExposure):"—",
    evidence:s.evidence,dataState:s.missing>0?"欠測あり":"記録正常"});
  }
  if(phase5)for(const s of summarizePhase5(phase5)){
   const freeze=phase5.freezes.find(f=>f.version===s.version);
   const records=phase5.records.filter(r=>r.strategyVersion===s.version);
   const last=records.at(-1);
   all.push({version:s.version,asset:s.ticker,source:"Native/比較",
    role:s.role==="PRIMARY_CHALLENGER"?"対抗":"比較",
    start:freeze?.startDate??"—",latest:safeDate(last?.marketDataDate),
    observations:s.liveObservations,modelReturn:records.length?s.totalReturn:null,
    maxDd:records.length?s.metrics.maxDd:null,modelOrders:s.executions,
    allocation:last?fmtPct(last.targetExposure):"—",
    evidence:s.evidence,dataState:s.status==="DATA_REVIEW_REQUIRED"?"要確認":s.missing>0?"欠測あり":"記録正常"});
  }
  const last=gold.rows.at(-1);
  const validatedRisk=goldRisk.ok&&goldRisk.status?.state==="ACCUMULATING"&&goldRisk.rows.length>0;
  const latestRisk=goldRisk.rows.at(-1);
  const riskFields=validatedRisk&&latestRisk?{modelReturn:latestRisk.index/100-1,maxDd:latestRisk.maxDd,
   modelOrders:goldRisk.rows.filter(x=>x.continuity.kind==="CONTIGUOUS"||x.continuity.kind==="INITIAL").reduce((sum,x)=>sum+x.orderLegs,0)}:
   {modelReturn:null,maxDd:null,modelOrders:null};
  all.push({version:"TQQQ-Gold50-Research-v0.1",asset:"TQQQ / GLD / 現金",source:"Gold50",
   role:"金・現金分散",start:"2026-10-12",latest:safeDate(last?.marketDataDate),
   observations:gold.ok?gold.rows.length:0,...riskFields,
   allocation:gold.ok&&last?("T "+fmtPct(last.target.TQQQ)+" / G "+fmtPct(last.target.GLD)+" / 現金 "+fmtPct(last.target.CASH)):"—",
   evidence:gold.ok?(last?"観測中":"初回待ち"):"未確認",
   dataState:goldLoading?"読込中":gold.ok?(gold.status?.state==="CHECK_DATA"?"要確認":"記録正常"):"要確認"});
  return all;
 },[tqqq,phase5,gold,goldLoading,goldRisk]);
 const [selection,setSelection]=useState<"全系列"|"TQQQ系"|"他ETF・Native"|"金分散">("全系列");
 const filtered=rows.filter(r=>selection==="全系列"||(selection==="TQQQ系"&&r.source==="VS13系")||(selection==="他ETF・Native"&&r.source==="Native/比較")||(selection==="金分散"&&r.source==="Gold50"));
 const ready=rows.length===9&&tqqq?.freezes.length===5&&phase5?.freezes.length===3;
 const goldUnavailable=!gold.ok||gold.status?.state==="CHECK_DATA";
 return <section className="unifiedForward">
  <div className="unifiedHeading">
   <div><em>ONE COHORT · FROZEN STRATEGY FORWARD</em><h2>9系列を同じ物差しで監視</h2>
    <p>基準3本・比較指標2本・他ETF/Native 3本・Gold50 1本。全シリーズの凍結条件と独立台帳を維持したまま、表示と検証状況を一本化しています。</p>
   </div>
   <span className={"status "+(ready?"ok":"bad")}>{ready?"9系列 / 一覧統合":"台帳取得を確認"}</span>
  </div>
  <div className="unifiedKpis">
   <div><small>研究対象</small><strong>{ready?"9 / 9":rows.length+" / 9"}</strong><span>検証済みの定義済み系列</span></div>
   <div><small>TQQQ系列</small><strong>{tqqq?.freezes.length??0} / 5</strong><span>3候補＋2比較指標</span></div>
   <div><small>他ETF・Native</small><strong>{phase5?.freezes.length??0} / 3</strong><span>UPRO / SSO / QLD</span></div>
   <div><small>Gold50</small><strong>{goldLoading?"確認中":gold.ok?gold.rows.length+"件":"要確認"}</strong><span>新Forward 2026-10-12〜</span></div>
  </div>
  <div className="unifiedFilter" role="group" aria-label="表示する研究グループ">
   {(["全系列","TQQQ系","他ETF・Native","金分散"] as const).map(x=><button key={x} type="button"
    className={selection===x?"selected":""} aria-pressed={selection===x} onClick={()=>setSelection(x)}>{x}</button>)}
  </div>
  <div className="table unifiedTable"><table><thead><tr>
   <th>系列 / 役割</th><th>Version</th><th>最新NYSE</th><th>有効観測</th>
   <th>Model損益</th><th>Max DD</th><th>モデル約定</th><th>目標配分</th><th>状態</th>
  </tr></thead><tbody>
   {filtered.map(r=><tr key={r.version} className={r.source==="Gold50"?"goldUnifiedRow":""}>
    <td><strong>{r.asset}</strong><small>{r.source} · {r.role}</small></td>
    <td className="versionCell">{r.version}</td><td>{r.latest??"—"}</td>
    <td>{r.observations}</td><td>{fmtPct(r.modelReturn)}</td>
    <td>{fmtPct(r.maxDd)}</td><td>{r.modelOrders??"—"}</td>
    <td className="allocationCell">{r.allocation}</td>
    <td><span className={"status "+stateTone(r)}>{statusLabel(r)}</span>{r.dataState==="欠測あり"?<small>欠測の監査要</small>:null}</td>
   </tr>)}
  </tbody></table></div>
  {goldUnavailable&&!goldLoading?<p className="warningNote">Gold50公開台帳は現在「確認要」です。古い金配分を新規の売買判断に使わないでください。{gold.reason??gold.status?.reasonCode}</p>:null}
  {goldRisk.ok&&goldRisk.status?.state==="ACCUMULATING"&&goldRisk.rows.length>0?<p className="note">Gold50のモデル損益・DDは{goldRisk.status.startDate}以降の<strong>参考値</strong>（最終{goldRisk.status.lastMarketDate}）。予測シグナルの記録2日分を後付け計算していません。TQQQ既存Forwardとは計測開始日が異なり、直接ランキングには使用できません。</p>:<p className="note">Gold50の損益・DDは2026-10-14以降の独立モデルForward初回評価待ちです（現状「—」）。{goldRisk.status?.state==="CHECK_DATA"?"価格検証が停止中："+goldRisk.status.reasonCode:""}。不明な期間を補完してゼロDDにはしません。</p>}
  <p className="note">**統一表示 ≠ 同条件の収益順位**。TQQQ/他ETFは為替・税・実口座費用を含まない仮想モデル。Gold50の今後の値は翌営業日寄付時点で凍結配分を研究上執行した分割可能株数・想定費用8bpの補助モデルで、実約定ではありません。実際の手動発注30〜40回/年の達成可否は、モデル約定数だけでは確定しません。</p>
  {!compact?<p className="note">同じ期間・同じ損益計算条件・欠測を揃えた比較評価は後続の検証で行います。過去ソークC10/10は長期Forwardに算入しません。Native研究の追加パラメータ探索は既存の研究詳細に保存されており、新規Forward系列として数えません。</p>:null}
 </section>;
}
