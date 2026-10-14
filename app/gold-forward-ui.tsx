"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {GOLD_DATA_BASE,GOLD_FORWARD_FIRST_SESSION,parseGoldForwardEvidence,manualGoldResearchProjection,type GoldEvidence} from "../lib/gold-forward-evidence";
import {parseGoldModelEvidence,type GoldModelEvidence} from "../lib/gold-performance-evidence";

type Props={tqqqSignalDate?:string|null;tqqqStatusDate?:string|null;compact?:boolean};
const pct=(n:number)=>(n*100).toFixed(1)+"%";
const fmt=(n:number)=>n.toLocaleString("ja-JP",{maximumFractionDigits:2});
const blank:GoldEvidence={ok:false,reason:null,status:null,phaseC:null,rows:[],segments:[],gaps:[]};
const blankRisk:GoldModelEvidence={ok:false,reason:null,status:null,rows:[]};
async function readGold(path:string){
 const url=GOLD_DATA_BASE+path;
 const response=await fetch(url,{cache:"no-store",redirect:"error"});
 if(!response.ok||response.redirected||response.url.split("?")[0]!==url)throw Error(path+": 取得不良");
 const value=await response.text();
 if(value.length>600000)throw Error(path+": サイズ超過");
 return value;
}
export function GoldIntegratedForward({tqqqSignalDate,tqqqStatusDate,compact=false}:Props){
 const [ev,setEv]=useState<GoldEvidence>(blank);
 const [risk,setRisk]=useState<GoldModelEvidence>(blankRisk);
 const [error,setError]=useState<string|null>(null);
 const [busy,setBusy]=useState(true);
 const [history,setHistory]=useState(false);
 const [inputs,setInputs]=useState({cash:"",tShares:"",gShares:"",tPrice:"",gPrice:""});
 const refresh=useCallback(async()=>{
  setBusy(true);
  try{
   const [a,b,c]=await Promise.all([readGold("forward/status.json"),readGold("phase-c/status.json"),readGold("forward/ledger.jsonl")]);
   const parsed=parseGoldForwardEvidence(JSON.parse(a),JSON.parse(b),c);
   setEv(parsed);setError(parsed.ok?null:parsed.reason);
   try{const [x,y]=await Promise.all([readGold("forward/performance-status.json"),readGold("forward/performance-ledger.jsonl")]);
    setRisk(parseGoldModelEvidence(JSON.parse(x),y,parsed));
   }catch{setRisk({...blankRisk,reason:"仮想損益・DD台帳の読み込み待ち"});}
  }catch(e){setEv(blank);setRisk(blankRisk);setError(e instanceof Error?e.message:"読み込み失敗")}
  finally{setBusy(false)}
 },[]);
 useEffect(()=>{void refresh();const id=setInterval(()=>void refresh(),300000);return()=>clearInterval(id)},[refresh]);
 const {status,phaseC,rows,segments,gaps}=ev,last=rows.at(-1);
 const riskLast=risk.rows.at(-1);
 const riskReady=risk.ok&&risk.status?.state==="ACCUMULATING"&&Boolean(riskLast);
 const mismatch=Boolean(last&&(tqqqSignalDate!==last.marketDataDate||tqqqStatusDate!==last.marketDataDate));
 const age=status?.evaluatedAt?Date.now()-Date.parse(status.evaluatedAt):Infinity;
 const stale=!Number.isFinite(age)||age< -60000||age>96*3600*1000;
 const safe=ev.ok&&status?.state==="ACCUMULATING"&&Boolean(last)&&!mismatch&&!stale&&
  (gaps.length===0||(segments.at(-1)?.count??0)>=2);
 const preview=useMemo(()=>{
  if(!safe||!last||Object.values(inputs).some(x=>x.trim()===""))return null;
  return manualGoldResearchProjection({weights:last.target,cashUsd:Number(inputs.cash),
   tqqqShares:Number(inputs.tShares),gldShares:Number(inputs.gShares),
   tqqqUsd:Number(inputs.tPrice),gldUsd:Number(inputs.gPrice)});
 },[safe,last,inputs]);
 const stateLabel=!ev.ok?"検証不能":status?.state==="CHECK_DATA"?"確認要":
  status?.state==="ACCUMULATING"?"Forward観測中":"初回観測待ち";
 return <div className="goldIntegrated">
  <article className="guideHero goldHero"><em>GOLD50 × TQQQ · INTEGRATED RESEARCH</em>
   <h2>Gold50 — 同じ画面でForward検証</h2>
   <p>既存VS13の目標値をTQQQに、残りをGLDと現金に50:50で配分します。研究シグナルだけを自動表示し、注文はご自身が証券会社で手動操作します。</p>
   <p className="warningNote">自動発注・自動採用・投資助言ではありません。Gold50の損益曲線はまだ正式計算・監査されておらず、TQQQのモデル成績とは同列比較しません。</p>
  </article>
  <article className="panel"><div className="panelHead"><div><em>AUTHORITATIVE GOLD RESEARCH DATA</em><h2>現在の検証状況</h2></div>
   <span className={"status "+(!ev.ok||status?.state==="CHECK_DATA"?"bad":last?"warn":"neutral")}>{stateLabel}</span></div>
   <div className="goldKpis">
    <div><small>Phase C</small><strong>{phaseC?.counter??"未確認"}</strong><span>2026-09-21終了</span></div>
    <div><small>長期Forward</small><strong>{ev.ok?String(status?.validObservations??0)+"件":"—"}</strong><span>2026-10-12開始</span></div>
    <div><small>最新のNYSE日</small><strong>{last?.marketDataDate??"未開始"}</strong><span>{status?.nextExpectedSession?"次回 "+status.nextExpectedSession:"検証待ち"}</span></div>
    <div><small>売買操作</small><strong>手動のみ</strong><span>発注機能なし</span></div>
   </div>
   {error?<p className="warningNote">取得・整合性エラー：{error}。古い配分を現行シグナルとして使用しません。</p>:null}
   {status?.reasonCode?<p className="warningNote">観測の状態：{status.reasonCode}</p>:null}
   {mismatch?<p className="warningNote">TQQQ現行SignalとGold50最終市場日が不一致。手動売買の試算を停止しました。</p>:null}
   {stale&&ev.ok?<p className="warningNote">観測時刻が古いか不正です。研究配分を最新の判断に使用しないでください。</p>:null}
   {busy?<p className="note">検証済みデータを読み込み中…</p>:null}
   <button type="button" onClick={()=>void refresh()}>最新状態を再取得</button>
   <p className="note">Gold50の公開研究台帳を読み取り専用で参照します。TQQQ側のソーク記録は変更しません。</p>
  </article>
  <article className="panel"><div className="panelHead"><div><em>PROSPECTIVE MODEL EQUITY · UNCERTIFIED</em><h2>Gold50の仮想損益・DD</h2></div>
   <span className={"status "+(risk.status?.state==="CHECK_DATA"?"bad":riskReady?"warn":"neutral")}>{riskReady?"モデルForward観測中":risk.status?.state==="CHECK_DATA"?"価格検証停止":"最初の評価待ち"}</span></div>
   <div className="goldKpis">
    <div><small>モデル指数（開始100）</small><strong>{riskReady&&riskLast?riskLast.index.toFixed(2):"—"}</strong><span>{riskLast?.marketDataDate??"開始 2026-10-14〜"}</span></div>
    <div><small>現在DD</small><strong>{riskReady&&riskLast?pct(riskLast.dd):"—"}</strong><span>有効なモデル観測のみ</span></div>
    <div><small>最大DD</small><strong>{riskReady&&riskLast?pct(riskLast.maxDd):"—"}</strong><span>連続した観測区間内</span></div>
    <div><small>評価記録</small><strong>{risk.ok?risk.rows.length+"件":"—"}</strong><span>配分シグナルとは独立</span></div>
   </div>
   {risk.status?.state==="CHECK_DATA"?<p className="warningNote">DD更新停止：{risk.status.reasonCode}。不明な価格の補間や仮の損益は作成しません。</p>:null}
   {!risk.ok&&risk.reason?<p className="note">価格評価は未確認です：{risk.reason}</p>:null}
   <p className="warningNote">このDDは<strong>証券会社の実損益ではない参考モデル</strong>です。2026-10-14以降の米国市場で、前営業日のGold50配分を翌営業日寄付で反映し、売買コスト8bpsを仮定します。10月12～13日のシグナルに遡及して損益を捏造しません。TQQQ系とは観測開始日が異なり、まだ直接比較できません。</p>
  </article>
  <article className="panel"><em>DISCONTINUITY-SAFE TIMELINE</em><h2>ソーク終了・空白・Forward開始</h2>
   <div className="goldTimeline">
    <div><b>Phase C完了</b><span>2026-09-08 ～ 2026-09-21</span><small>10営業日の運用ソーク。既存台帳を固定。</small></div>
    <div className="goldGap"><b>非観測期間</b><span>2026-09-22 ～ 2026-10-09</span><small>この期間をGold50長期Forwardとして計上しません。</small></div>
    <div><b>長期Forward</b><span>{GOLD_FORWARD_FIRST_SESSION} ～ {last?.marketDataDate??"初回未記録"}</span><small>新しい観測期間。将来の終了や再開を過去と混ぜません。</small></div>
    {gaps.map((g,i)=><div className="goldGap" key={g.after+"-"+i}><b>観測不連続</b><span>{g.after} ～ {g.before}</span><small>データ欠損期間を隠さず、この位置で期間を分割します。</small></div>)}
   </div>
   <p className="note">長期Forward内の連続区間：{segments.length}。区間をまたぐ損益や架空の観測日は作成しません。</p>
  </article>
  <article className="panel"><em>FORWARD SIGNAL HISTORY</em><h2>Gold50目標配分・履歴</h2>
   {ev.ok&&last?<div className="goldAllocation">
    {(["TQQQ","GLD","CASH"] as const).map(k=><div key={k}><small>{k==="CASH"?"現金":k}</small><strong>{pct(last.target[k])}</strong></div>)}
   </div>:<p className="warningNote">検証済みの長期Forward配分はまだありません。</p>}
   <button type="button" onClick={()=>setHistory(v=>!v)}>{history?"履歴を閉じる":"保存済みのForward記録を開く"}</button>
   {history&&<div className="table goldTable"><table><thead><tr>
    <th>NYSE日</th><th>TQQQ</th><th>GLD</th><th>現金</th><th>Action Day</th><th>推定注文脚数</th>
   </tr></thead><tbody>
    {rows.length?rows.slice().reverse().map(r=><tr key={r.marketDataDate}>
     <td>{r.marketDataDate}</td><td>{pct(r.target.TQQQ)}</td><td>{pct(r.target.GLD)}</td><td>{pct(r.target.CASH)}</td>
     <td>{r.execution.actionDay===null?"不明":r.execution.actionDay?"あり":"なし"}</td><td>{r.execution.estimatedManualOrderLegs===null?"不明":r.execution.estimatedManualOrderLegs}</td>
    </tr>):<tr><td colSpan={6}>新しい有効NYSE観測がありません。</td></tr>}
   </tbody></table></div>}
   <p className="note">一覧はGold50の実際に保存されたシグナルのみ。欠測後の最初の行はAction Dayと推定注文数を「不明」と表示します。自動発注記録や仮想口座損益ではありません。</p>
  </article>
  {!compact&&<article className="panel"><em>MANUAL-ORDER PLANNING · RESEARCH ONLY</em><h2>本人用の参考株数計算</h2>
   <p>米ドル現金、現保有株数、証券会社で確認した現在価格を入力します。発注も入力内容の保存・外部送信も行いません。</p>
   {!safe?<p className="warningNote">有効なGold50観測とTQQQの同日Signalの整合・鮮度・連続性が揃うまでは、参考株数試算を停止します。</p>:null}
   <div className="goldInputs">
    {([["cash","現金（USD）"],["tShares","TQQQ保有株数"],["gShares","GLD保有株数"],
       ["tPrice","TQQQ確認価格（USD）"],["gPrice","GLD確認価格（USD）"]] as const).map(([k,label])=>
      <label key={k}>{label}<input type="number" min="0" step={k.includes("Shares")?"1":"any"}
       autoComplete="off" disabled={!safe} value={inputs[k]} placeholder="手入力"
       onChange={e=>setInputs(o=>({...o,[k]:e.target.value}))}/></label>)}
   </div>
   {preview?<div className="goldEstimation">
    <p>入力資産総額：{fmt(preview.total)} USD</p>
    <p>TQQQ理論株数：{fmt(preview.targets.TQQQ)}（保有との差 {fmt(preview.delta.TQQQ)}）</p>
    <p>GLD理論株数：{fmt(preview.targets.GLD)}（保有との差 {fmt(preview.delta.GLD)}）</p>
    <p>理論残余現金：{fmt(preview.estimatedCash)} USD</p>
    <p className="warningNote">{preview.label}</p>
   </div>:<p className="note">有効な配分とすべての入力が揃うと、理論上の株数を表示します。注文指示ではありません。</p>}
  </article>}
  <article className="panel"><em>FORWARD EVIDENCE / HUMAN DECISION</em><h2>採用は未決定</h2>
   <p>Gold50の前向きシグナルを保存していますが、比較可能な損益、複数相場局面、欠損・費用・ドローダウン、年間30～40回程度以内の実際の手動注文数は引き続き検証が必要です。</p>
   <p className="warningNote">Gold50を研究上観測していることは、売買の承認を意味しません。最終的な銘柄・戦略選択と発注はユーザーが行います。</p>
  </article>
 </div>;
}
