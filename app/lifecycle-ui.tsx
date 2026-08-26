"use client";
import { useEffect, useState } from "react";
import type { LifecycleLedger } from "../lib/lifecycle-review";
import type { ProductionConfig } from "../lib/production";
import type { ProductionHealthLedger } from "../lib/production-health-review";

const label:Record<string,string>={ACCUMULATING:"Forward蓄積中",INTERIM:"6か月レビュー",FORMAL:"12か月正式レビュー",STRONGER:"24か月強化レビュー",NONE:"操作不要",CHECK_DATA_AND_ACTIONS:"データ/実行確認が必要",RUN_PHASE6_HUMAN_REVIEW:"Phase 6 人間判断が必要",REVALIDATE_PRODUCTION:"Production再検証が必要",URGENT_INTEGRITY_REVIEW:"緊急Integrity確認"};
const strategy:Record<string,string>={"VS13-v1.0":"Volatility Shield 13%","UPRO-SPBT-v1.0":"UPRO + S&P Broad Trend","SSO-SPBT-Scaled-v1.0":"SSO + S&P Broad Trend + scaled stop","QLD-VS13-Scaled-v1.0":"QLD + Common VS13 + scaled stop"};
const tone=(a:string)=>a==="NONE"?"ok":a.includes("URGENT")||a.includes("REVALIDATE")||a.includes("CHECK")?"bad":"warn";
const REVIEW_STALE_MS=48*60*60*1000;
const isReviewStale=(review:LifecycleLedger|null)=>!review||!Number.isFinite(Date.parse(review.updatedAt))||Date.now()-Date.parse(review.updatedAt)>REVIEW_STALE_MS;
const pct=(v:number,d=1)=>Number.isFinite(v)?`${v>=0?"+":""}${(v*100).toFixed(d)}%`:"—";
const num=(v:number,d=2)=>Number.isFinite(v)?v.toFixed(d):"—";
const meritLabel:Record<string,string>={INCUMBENT:"現行基準",NOT_EVALUATED:"未評価",PARETO_SUPPORTED:"Pareto支持",MIXED:"Trade-off",DOMINATED_BY_INCUMBENT:"現行に支配"};

function useLifecycle(){
  const [review,setReview]=useState<LifecycleLedger|null>(null),[production,setProduction]=useState<ProductionConfig|null>(null),[health,setHealth]=useState<ProductionHealthLedger|null>(null),[loaded,setLoaded]=useState(false);
  useEffect(()=>{let alive=true;Promise.all([
    fetch("./data/lifecycle-review.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null),
    fetch("./data/production-config.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null),
    fetch("./data/production-health-review.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null),
  ]).then(([a,b,h])=>{if(alive){setReview(a);setProduction(b);setHealth(h);setLoaded(true)}});return()=>{alive=false}},[]);
  return{review,production,health,loaded,reviewStale:loaded&&isReviewStale(review)};
}

export function LifecycleGlobalBanner(){
  const{review,health,loaded,reviewStale}=useLifecycle();if(!loaded)return null;
  if(!review)return <section className="issueBlock"><b>LIFECYCLE REVIEW UNAVAILABLE</b><p>Review判定を取得できません。Production変更は禁止し、System Status / GitHub Actionsを確認してください。</p></section>;
  if(reviewStale)return <section className="issueBlock"><b>LIFECYCLE REVIEW STALE</b><p>自動Reviewが48時間以上更新されていません。古い「操作不要」は無効です。Production変更や新規リスク追加を行わず、GitHub ActionsのAutonomous Lifecycle Reviewを確認してください。</p></section>;
  const action=health?.current.userAction!=="NONE"?health!.current.userAction:review.current.userAction;if(action==="NONE")return null;
  const message=health?.current.userAction!=="NONE"?health!.current.message:review.current.message;return <section className="issueBlock"><b>{label[action]||action}</b><p>{message} 「Review / 次のAction」タブを開いて手順を確認してください。</p></section>;
}

export function LifecycleActionCenter(){
  const{review,production,health,loaded,reviewStale}=useLifecycle();
  if(!loaded)return <article className="emptyState"><span>AUTONOMOUS REVIEW</span><h2>Review状態を確認中</h2></article>;
  if(!review)return <article className="panel"><em>AUTONOMOUS REVIEW</em><h2>Lifecycle Reviewを読み込めません</h2><p className="warningNote">日次Signalは継続できますが、Review判定が見えないためProduction変更は禁止です。System StatusでLifecycle Review workflowを確認してください。</p></article>;
  const c=review.current,operationalEligible=c.candidateReviews.filter(x=>x.eligible),selectable=c.candidateReviews.filter(x=>x.promotionSelectable),effectiveAction=reviewStale?"CHECK_DATA_AND_ACTIONS":health?.current.userAction!=="NONE"?health!.current.userAction:c.userAction;
  const effectiveMessage=reviewStale?"Lifecycle Reviewが48時間以上更新されていません。古い判定を使わず、Actionsを確認してください。":health?.current.userAction!=="NONE"?health!.current.message:c.message;
  return <>
    <article className={`systemHero ${effectiveAction==="NONE"?"ok":""}`}><em>AUTONOMOUS LIFECYCLE CONTROL</em><h2>{label[effectiveAction]||effectiveAction}</h2><p>{effectiveMessage}</p><div className="contextBadges"><span className={`status ${tone(effectiveAction)}`}>{label[c.stage]||c.stage}</span><span className="status neutral">判定日 {c.asOf}</span><span className="status neutral">Forward次回 {c.nextReview||"定期Review完了"}</span></div></article>
    <article className="panel"><div className="panelHead"><div><em>WHAT TO DO NEXT</em><h2>今ユーザーがすること</h2></div><span>自動判定はしても自動売買戦略変更はしません。</span></div>
      {effectiveAction==="NONE"&&<div className="opsNext"><span>USER ACTION</span><strong>何もしなくて大丈夫です。Forward・レビュー・Production Healthは自動継続します。</strong></div>}
      {effectiveAction==="CHECK_DATA_AND_ACTIONS"&&<><div className="opsNext"><span>USER ACTION</span><strong>System Status / GitHub Actionsを確認。データ・実行・Review更新の異常が解消するまでProduction変更や新規リスク追加を行わない。</strong></div><p className="warningNote">パラメータを変更して救済しないでください。データ障害なら復旧後の新しいLIVE観測から継続します。</p></>}
      {effectiveAction==="RUN_PHASE6_HUMAN_REVIEW"&&<><div className="opsNext"><span>STEP 1</span><strong>GitHub Actions → Human Production Approval → mode = DECISION を実行</strong></div><div className="opsNext"><span>STEP 2</span><strong>下のProduction-selectable候補から、現行TQQQ維持を含め1本だけ選択</strong></div><div className="opsNext"><span>STEP 3</span><strong>同WorkflowをPRODUCTIONで実行し、Ticker / Strategy / Versionを下記どおり入力、confirmationに APPROVE PRODUCTION</strong></div></>}
      {effectiveAction==="REVALIDATE_PRODUCTION"&&<div className="opsNext"><span>USER ACTION</span><strong>新規リスク追加を停止し、Production Healthの理由を確認。自動Strategy置換はしない。</strong></div>}
      {effectiveAction==="URGENT_INTEGRITY_REVIEW"&&<div className="opsNext"><span>USER ACTION</span><strong>Integrity問題です。新規リスク追加を行わず、System Status / Actionsを最優先で確認してください。</strong></div>}
    </article>
    <article className="panel"><div className="panelHead"><div><em>REVIEW GATE</em><h2>4つのFrontierの自動判定</h2></div><span>Operationally eligible ≠ Production-selectable。最終変更はHuman Approvalのみ。</span></div>
      <div className="table"><table><thead><tr><th>System</th><th>Gate</th><th>Promotion merit</th><th>Live obs</th><th>Executions</th><th>Regime families</th><th>Action/y</th><th>Total Return</th><th>Max DD</th><th>Sortino</th><th>Calmar</th></tr></thead><tbody>{c.candidateReviews.map(x=>{const actionRate=x.liveObservations>=63&&Number.isFinite(x.actionDaysPerYear)?x.actionDaysPerYear.toFixed(1):"—";const gate=x.promotionSelectable?"PRODUCTION SELECTABLE":x.eligible?"OPERATIONALLY ELIGIBLE":x.decision;const gateTone=x.promotionSelectable?"ok":x.decision.includes("REVIEW")||x.decision.includes("REVALIDATION")?"bad":x.eligible?"warn":"neutral";return <tr key={x.version}><td>{x.ticker}{x.incumbent?" · incumbent":""}<br/><small>{x.version}</small></td><td><span className={`status ${gateTone}`}>{gate}</span></td><td>{meritLabel[x.promotionMerit]||x.promotionMerit}{x.paretoCommonDays?` · ${x.paretoCommonDays} common days`:""}</td><td>{x.liveObservations}</td><td>{x.executions}</td><td>{x.regimeFamilies.length?x.regimeFamilies.join(" / "):"—"}{x.regimeCoverageOk?" ✓":""}</td><td>{actionRate}{x.liveObservations<63?<><br/><small>63 obs未満は年率非表示</small></>:null}</td><td>{pct(x.totalReturn)}</td><td>{pct(x.maxDd)}</td><td>{x.liveObservations>=20?num(x.sortino):"—"}</td><td>{x.liveObservations>=63?num(x.calmar):"—"}</td></tr>})}</tbody></table></div>
      <p className="note">Eligibleは「壊れておらず正式レビューに載せられる」という意味です。Production-selectableはさらに現行TQQQとの共通期間Pareto比較を通った候補だけです。63観測未満のAction/yearは年率化ノイズのため表示しません。</p>
      {operationalEligible.length>0&&selectable.length===0&&!reviewStale&&<p className="warningNote">運用上レビュー可能な候補はありますが、現時点でProduction入力可能な候補はありません。</p>}
      {selectable.length>0&&!reviewStale&&<div className="formula"><p>Production入力候補:</p>{selectable.map(x=><code key={x.version}>Ticker: {x.ticker} / Strategy: {strategy[x.version]} / Version: {x.version}</code>)}</div>}
    </article>
    <article className="panel"><div className="panelHead"><div><em>PRODUCTION STATE</em><h2>正式運用とHealth Review</h2></div><span>Research → Decision → Human Approval → Production → Quarterly Health</span></div><div className="opsMiniGrid"><div><span>Platform mode</span><b>{production?.mode||"RESEARCH"}</b></div><div><span>Human approved</span><b>{production?.approvedByHuman?"YES":"NO"}</b></div><div><span>Production Health</span><b>{health?.current.state||c.productionHealth.state}</b></div><div><span>Last Health Review</span><b>{health?.current.lastReview||"—"}</b></div><div><span>Next Health Review</span><b>{health?.current.nextReview||production?.nextHealthReview||"Production開始後"}</b></div><div><span>Health events</span><b>{health?.events.length??0}</b></div></div><p className="note">現在のTQQQ日次SignalはOperational Baselineです。正式なProduction modeはHuman Approval後だけ有効です。自動Healthが測るのはIntegrity・データ鮮度・DD・Action Daysです。実brokerコスト・税・FX・商品構造はQuarterly/Phase 6の人間確認項目です。</p></article>
  </>;
}
