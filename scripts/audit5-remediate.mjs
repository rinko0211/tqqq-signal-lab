import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const write=(p,s)=>fs.writeFileSync(p,s);
const replace=(p,from,to,label=from.slice(0,60))=>{
  const s=read(p);
  if(!s.includes(from))throw new Error(`Audit5 patch target missing in ${p}: ${label}`);
  if(s.indexOf(from)!==s.lastIndexOf(from))throw new Error(`Audit5 patch target ambiguous in ${p}: ${label}`);
  write(p,s.replace(from,to));
};
const replaceLine=(p,prefix,to)=>{
  const s=read(p),lines=s.split("\n"),idx=lines.findIndex(x=>x.startsWith(prefix));
  if(idx<0)throw new Error(`Audit5 line target missing in ${p}: ${prefix}`);
  if(lines.filter(x=>x.startsWith(prefix)).length!==1)throw new Error(`Audit5 line target ambiguous in ${p}: ${prefix}`);
  lines.splice(idx,1,...to.split("\n"));write(p,lines.join("\n"));
};

// 1) Daily must never ingest a still-forming NYSE daily bar.
replace(
  "scripts/generate-daily.ts",
  'import {isNyseSession} from "../lib/market-calendar.ts";',
  'import {dailyBarIsComplete,isNyseSession} from "../lib/market-calendar.ts";',
  "daily market calendar import",
);
replace(
  "scripts/generate-daily.ts",
  '  const errors = dataset.issues.filter(x=>x.severity==="error"); if (errors.length) throw Error(errors.map(x=>x.message).join("; "));\n  const bt = runBacktest(dataset, selected.config),latest = bt.daily.at(-1)!,bar = dataset.days.at(-1)!;',
  '  const errors = dataset.issues.filter(x=>x.severity==="error"); if (errors.length) throw Error(errors.map(x=>x.message).join("; "));\n  const keepCompleteBars=(ds:typeof trackADataset)=>{while(ds.days.length&&!dailyBarIsComplete(ds.days.at(-1)!.date,generatedAt))ds.days.pop();if(ds.days.length<201)throw Error("DATA-003: no sufficiently long completed NYSE daily-bar history is available; no Signal was generated")};\n  keepCompleteBars(trackADataset);if(dataset!==trackADataset)keepCompleteBars(dataset);\n  const bt = runBacktest(dataset, selected.config),latest = bt.daily.at(-1)!,bar = dataset.days.at(-1)!;',
  "completed daily bar guard",
);

// 2) Production approval: regenerate authoritative upstreams immediately before
// approval, then regenerate Daily/Lifecycle/Health from the resulting Production
// state before one atomic persistence/deploy.
replace(
  ".github/workflows/approve-production.yml",
  '      - run: npm ci\n      - name: Record explicit human decision locally',
  '      - run: npm ci\n      - name: Refresh authoritative review inputs immediately before Production approval\n        if: inputs.mode == \'PRODUCTION\'\n        run: |\n          npm run generate:daily\n          test ! -s github-pages/public/data/.failed\n          npm run generate:phase5-forward\n          npm run generate:lifecycle-review\n      - name: Record explicit human decision locally',
  "preapproval lifecycle refresh",
);
replace(
  ".github/workflows/approve-production.yml",
  '      - name: Preflight the exact resulting operational state\n        run: |\n          npm run generate:daily\n          test ! -s github-pages/public/data/.failed\n          npm run test:ops\n          npm run build:pages',
  '      - name: Preflight the exact resulting operational state\n        run: |\n          npm run generate:daily\n          test ! -s github-pages/public/data/.failed\n          npm run generate:lifecycle-review\n          npm run generate:production-health-review\n          npm run test:ops\n          npm run build:pages',
  "postapproval coherent state refresh",
);

// 3) Primary UI: a missed scheduled open is not a still-valid execution instruction.
replace(
  "app/page.tsx",
  'import {LifecycleActionCenter,LifecycleGlobalBanner} from "./lifecycle-ui";',
  'import {LifecycleActionCenter,LifecycleGlobalBanner} from "./lifecycle-ui";\nimport {nyseExecutionWindow} from "../lib/market-calendar";',
  "execution window import",
);
replace(
  "app/page.tsx",
  '    actual = displayHoldings.ratio === "" ? null : Number(displayHoldings.ratio) / 100,\n    signalUnsafe=Boolean(runtimeStatus?.state==="failed"||fresh?.stale),\n    action =\n      signalUnsafe\n        ? "売買しない：データ/Signalが安全確認できません。System Statusを確認してください"\n        : !holdingsMatch\n          ? `運用Tickerが${currentTicker}へ切り替わりました。旧Tickerの保有値は流用しません。${currentTicker}の保有状況を再入力してください`\n          : actual === null\n            ? "保有状況未入力：目標のみ表示"\n            : Math.abs(actual - target) < 0.001\n              ? "変更なし"\n              : actual < target\n                ? `${currentTicker}比率を${target * 100}%まで増加`\n                : `${currentTicker}比率を${target * 100}%まで縮小`;',
  '    actual = displayHoldings.ratio === "" ? null : Number(displayHoldings.ratio) / 100,\n    executionDate=signal?.executionDate||(signal?nextExecutionDate(signal.date):undefined),\n    executionWindow=executionDate?nyseExecutionWindow(executionDate,now.toISOString()):null,\n    executionMissed=Boolean(holdingsMatch&&actual!==null&&Math.abs(actual-target)>=.001&&executionWindow==="OPEN_PASSED"),\n    signalUnsafe=Boolean(runtimeStatus?.state==="failed"||fresh?.stale),\n    action =\n      signalUnsafe\n        ? "売買しない：データ/Signalが安全確認できません。System Statusを確認してください"\n        : !holdingsMatch\n          ? `運用Tickerが${currentTicker}へ切り替わりました。旧Tickerの保有値は流用しません。${currentTicker}の保有状況を再入力してください`\n          : actual === null\n            ? "保有状況未入力：目標のみ表示"\n            : executionMissed\n              ? `売買しない：予定始値（${executionDate}）を通過しています。過去の始値を追認せず、次のDaily Signal更新後に再確認してください`\n              : Math.abs(actual - target) < 0.001\n                ? "変更なし"\n                : actual < target\n                  ? `${currentTicker}比率を${target * 100}%まで増加`\n                  : `${currentTicker}比率を${target * 100}%まで縮小`;',
  "missed execution fail closed",
);
replace(
  "app/page.tsx",
  '            signalUnsafe={signalUnsafe}\n            ticker={dailySignal?.assetTicker||"TQQQ"}',
  '            signalUnsafe={signalUnsafe}\n            executionMissed={executionMissed}\n            ticker={dailySignal?.assetTicker||"TQQQ"}',
  "SignalView execution prop",
);
replace(
  "app/page.tsx",
  '  signalUnsafe,\n  ticker,',
  '  signalUnsafe,\n  executionMissed,\n  ticker,',
  "SignalView destructuring",
);
replace(
  "app/page.tsx",
  '  signalUnsafe:boolean;\n  ticker:string;',
  '  signalUnsafe:boolean;\n  executionMissed:boolean;\n  ticker:string;',
  "SignalView prop type",
);
replace(
  "app/page.tsx",
  '<strong>{signalUnsafe?"売買しない・System Status確認":changed?`次回始値で${Math.abs(signal.target-signal.previousTarget)*100}%${direction}`:"売買なし"}</strong>',
  '<strong>{signalUnsafe?"売買しない・System Status確認":executionMissed?"予定始値通過・新規売買しない":changed?`次回始値で${Math.abs(signal.target-signal.previousTarget)*100}%${direction}`:"売買なし"}</strong>',
  "primary call missed-open label",
);
replace(
  "app/page.tsx",
  '<Status kind={signalUnsafe?"bad":activeProduction?"ok":"warn"}>{signalUnsafe?"データ安全確認待ち・売買禁止":decisionPending?"正式Production継続中 · Decision Review Pending":activeProduction?"正式Production · Human Approved":"Operational Baseline · Research"}</Status>',
  '<Status kind={signalUnsafe||executionMissed?"bad":activeProduction?"ok":"warn"}>{signalUnsafe?"データ安全確認待ち・売買禁止":executionMissed?"予定始値通過 · 次回判定待ち":decisionPending?"正式Production継続中 · Decision Review Pending":activeProduction?"正式Production · Human Approved":"Operational Baseline · Research"}</Status>',
  "primary status missed-open label",
);

// 4) TQQQ legacy Forward remains a reference baseline, never a contradictory
// claim that it is the current Production after a future ticker transition.
replace("app/page.tsx",'<h2>現在のChampion：VS13-v1.0</h2>','<h2>TQQQ Reference Baseline：VS13-v1.0</h2>',"legacy mini heading");
replace("app/page.tsx",'<em>BALANCED CHAMPION</em><h2>VS13 — バランス型</h2>','<em>TQQQ REFERENCE BASELINE</em><h2>VS13 — バランス型Reference</h2>',"legacy forward heading");
replace("app/page.tsx",'<Metric label="Balanced Champion" value="VS13-v1.0"/>','<Metric label="TQQQ Reference" value="VS13-v1.0"/>',"legacy metric label");

// 5) Roadmap derives the operating system from authoritative Production config.
replaceLine(
  "app/page.tsx",
  "function RoadmapV2()",
`function RoadmapV2({config}:{config:ProductionConfig|null}){
  const active=Boolean(config?.approvedByHuman&&config?.mode!=="RESEARCH"&&config?.selectedTicker&&config?.strategyVersion);
  const operate=active?\`${'${config!.selectedTicker} ${config!.strategyVersion} · HUMAN APPROVED PRODUCTION'}\`:"TQQQ VS13 · OPERATIONAL REFERENCE BASELINE";
  const phases=[["Phase 0","Freeze / Audit / Charter","COMPLETE","既存Production・Forwardを保護して研究境界を固定"],["Phase 1","Underlying × Leverage Screening","COMPLETE","Core 4本を選抜"],["Phase 1.5","Leverage-Neutral Check","COMPLETE","2x Stopを13%×2/3へ機械換算"],["Phase 2","Common Robustness","COMPLETE","TQQQ/QLD/UPRO/SSOのFrontierを確認"],["Phase 3","Native Research","COMPLETE","S&P Broad Trend採用・NasdaqはCommon維持"],["Phase 4","Winner + Cash Allocator","REJECTED","Ticker swing v1は単体UPRO Nativeを上回らず"],["Phase 5","True Forward Gate","ACTIVE","凍結ForwardはProduction選択後も比較Referenceとして継続"],["Phase 6","Periodic Human Review / Production","ACTIVE WHEN DUE","12か月Gate後も年次再レビュー。変更はHuman Approvalのみ"]];
  return <><article className="guideHero"><em>INTEGRATED PRODUCT ROADMAP</em><h2>Research → Forward → Periodic Review → Production</h2><p>{active?\`現在の正式Productionは ${'${config!.selectedTicker} / ${config!.strategyVersion}'} です。TQQQ VS13とPhase 5台帳は比較Referenceとして継続します。\`:"現在はTQQQ VS13をOperational Reference Baselineとして日次観測し、Phase 5候補を別台帳で未来観測しています。"}</p></article><article className="panel"><Table heads={["段階","テーマ","状態","結論 / 完了条件"]} rows={phases}/></article><article className="panel formula"><em>CURRENT OPERATING BOUNDARY</em><h2>現在地</h2><code>OPERATE: {operate} · VALIDATE: frozen Forward frontier · RESEARCH: frozen archive</code><p>正式Productionが変わってもReference Forwardを削除・改名せず、次回年次Reviewの比較材料として継続します。</p></article></>;
}`,
);
replace("app/page.tsx",'{tab === "roadmap" && <RoadmapV2/>}','{tab === "roadmap" && <RoadmapV2 config={productionConfig}/>}','roadmap config prop');

// 6) Phase 5 integrated UI knows when one of its frozen versions is the actual
// Production and never renders the same version again as RESEARCH.
replace(
  "app/page.tsx",
  'platformMode={productionConfig?.mode} humanApproved={productionConfig?.approvedByHuman}/>',
  'platformMode={productionConfig?.mode} humanApproved={productionConfig?.approvedByHuman} productionTicker={productionConfig?.selectedTicker||undefined} productionVersion={productionConfig?.strategyVersion||undefined}/>',
  "dashboard production identity",
);
replace(
  "app/page.tsx",
  '<Phase5ForwardPanel productionForward={forwardLedger} ledger={phase5Ledger} status={phase5Status}/>',
  '<Phase5ForwardPanel productionForward={forwardLedger} ledger={phase5Ledger} status={phase5Status} productionVersion={productionConfig?.strategyVersion||undefined}/>',
  "phase5 forward production identity",
);
replace(
  "app/page.tsx",
  '<Phase5PaperPanel ledger={phase5Ledger}/>',
  '<Phase5PaperPanel ledger={phase5Ledger} productionVersion={productionConfig?.strategyVersion||undefined}/>',
  "phase5 paper production identity",
);

replace(
  "app/phase5-ui.tsx",
  'export function IntegratedDashboard({ production, productionForward, phase5, phase5Status, platformMode, humanApproved }: {',
  'export function IntegratedDashboard({ production, productionForward, phase5, phase5Status, platformMode, humanApproved, productionTicker, productionVersion }: {',
  "dashboard args",
);
replace(
  "app/phase5-ui.tsx",
  '  humanApproved?: boolean;\n}) {',
  '  humanApproved?: boolean;\n  productionTicker?: string;\n  productionVersion?: string;\n}) {',
  "dashboard prop types",
);
replace(
  "app/phase5-ui.tsx",
  '<div className="panelHead"><div><em>PHASE 5 · RESEARCH OBSERVATION ONLY</em><h2>Productionとは別の候補群</h2></div>',
  '<div className="panelHead"><div><em>PHASE 5 · FROZEN FORWARD REFERENCE SET</em><h2>現Productionを含み得る比較台帳</h2></div>',
  "phase5 dashboard heading",
);
replace(
  "app/phase5-ui.tsx",
  '<p>ここに表示されるUPRO / SSO / QLDは、現在の売買指示ではありません。Phase 6までは独立Forwardで観測します。</p>',
  '<p>{activeProduction&&productionVersion&&challengers.some(x=>x.version===productionVersion)?`${productionTicker||production?.ticker||"選択Ticker"} / ${productionVersion} は現在の正式Productionです。残りは比較用Forwardで、ここから売買指示は出しません。`:"UPRO / SSO / QLDは凍結Forward候補です。正式Production承認前は比較観測のみで、ここから売買指示は出しません。"}</p>',
  "phase5 dashboard explanatory text",
);
replace(
  "app/phase5-ui.tsx",
  '          ...challengers.map((x) => {\n            const last = phase5!.records.filter((r) => r.strategyVersion === x.version).at(-1);\n            return [<Chip key={x.version} tone="warn">RESEARCH</Chip>,',
  '          ...challengers.filter(x=>!(activeProduction&&x.version===productionVersion)).map((x) => {\n            const last = phase5!.records.filter((r) => r.strategyVersion === x.version).at(-1);\n            return [<Chip key={x.version} tone="warn">REFERENCE</Chip>,',
  "avoid duplicated Production as research row",
);
replace(
  "app/phase5-ui.tsx",
  'export function Phase5ForwardPanel({ productionForward, ledger, status }: {\n  productionForward: ForwardLedger | null;\n  ledger: Phase5Ledger | null;\n  status: Phase5StatusFile | null;\n}) {',
  'export function Phase5ForwardPanel({ productionForward, ledger, status, productionVersion }: {\n  productionForward: ForwardLedger | null;\n  ledger: Phase5Ledger | null;\n  status: Phase5StatusFile | null;\n  productionVersion?: string;\n}) {',
  "phase5 forward props",
);
replace("app/phase5-ui.tsx",'<em>FORWARD FRONTIER</em><h2>既存TQQQ Operational Baselineとの比較</h2>','<em>FORWARD FRONTIER</em><h2>TQQQ Reference Baselineと凍結Frontierの比較</h2>',"forward frontier heading");
replace(
  "app/phase5-ui.tsx",
  'return [`${f.ticker} / ${f.version}`, roleLabel[f.role] || f.role, f.startDate,',
  'return [`${f.ticker} / ${f.version}`, f.version===productionVersion?"CURRENT PRODUCTION":roleLabel[f.role] || f.role, f.startDate,',
  "phase5 production role",
);
replace(
  "app/phase5-ui.tsx",
  'export function Phase5PaperPanel({ ledger }: { ledger: Phase5Ledger | null }) {',
  'export function Phase5PaperPanel({ ledger, productionVersion }: { ledger: Phase5Ledger | null; productionVersion?: string }) {',
  "phase5 paper props",
);
replace(
  "app/phase5-ui.tsx",
  '<Chip tone={ledger ? "warn" : "bad"}>Research only</Chip>',
  '<Chip tone={ledger ? "warn" : "bad"}>{productionVersion&&ledger?.freezes.some(f=>f.version===productionVersion)?"Production reference paper · no broker orders":"Research reference only"}</Chip>',
  "paper semantic chip",
);

// 7) Lifecycle UI refers to the actual incumbent after Production transition.
replace("app/lifecycle-ui.tsx","現行TQQQ維持を含め1本だけ選択","現行Production維持を含め1本だけ選択","phase6 step incumbent wording");
replace("app/lifecycle-ui.tsx","現行TQQQとの共通期間Pareto比較","current incumbentとの共通期間Pareto比較","phase6 note incumbent wording");
replace(
  "app/lifecycle-ui.tsx",
  '<p className="note">現在のTQQQ日次SignalはOperational Baselineです。正式なProduction modeはHuman Approval後だけ有効です。自動Healthが測るのはIntegrity・データ鮮度・DD・Action Daysです。実brokerコスト・税・FX・商品構造はQuarterly/Phase 6の人間確認項目です。</p>',
  '<p className="note">{production?.approvedByHuman&&production?.mode!=="RESEARCH"?`現在の正式Productionは ${production.selectedTicker} / ${production.strategyVersion} です。TQQQ VS13はReference Baselineとして継続記録します。`:"現在はTQQQ VS13をOperational Reference Baselineとして使用します。"} 自動Healthが測るのはIntegrity・データ鮮度・DD・Action Daysです。実brokerコスト・税・FX・商品構造はQuarterly/年次Human Reviewの確認項目です。</p>',
  "lifecycle production note",
);

// 8) Preserve the scheduled review snapshot's human-readable decision message.
replace(
  "lib/lifecycle-review.ts",
  'export type ReviewEvent={key:string;stage:Exclude<LifecycleStage,"ACCUMULATING">;reviewDate:string;recordedAt:string;systemDecision:string;userAction:UserAction;candidateReviews:CandidateReview[]};',
  'export type ReviewEvent={key:string;stage:Exclude<LifecycleStage,"ACCUMULATING">;reviewDate:string;recordedAt:string;systemDecision:string;userAction:UserAction;message?:string;candidateReviews:CandidateReview[]};',
  "review event message type",
);
replace(
  "lib/lifecycle-review.ts",
  'out.events.push({key:`${cycleStage}|${cycleDate}`,stage:cycleStage,reviewDate:cycleDate,recordedAt:now,systemDecision:d.systemDecision,userAction:d.userAction,candidateReviews:structuredClone(reviews)});',
  'out.events.push({key:`${cycleStage}|${cycleDate}`,stage:cycleStage,reviewDate:cycleDate,recordedAt:now,systemDecision:d.systemDecision,userAction:d.userAction,message:d.message,candidateReviews:structuredClone(reviews)});',
  "review event message persistence",
);

// 9) Existing lifecycle tests used a time before the NYSE close. Move fixtures
// beyond the review close boundary and keep upstream timestamps current.
replace("tests/lifecycle-review.test.ts",'const base=(now="2027-08-25T12:00:00Z")=>','const base=(now="2027-08-25T21:30:00Z")=>',"formal review test time");
replace("tests/lifecycle-review.test.ts",'generatedAt:"2027-08-25T11:00:00Z",latestDates:{UPRO:"2027-08-24",SSO:"2027-08-24",QLD:"2027-08-24",SPY:"2027-08-24",QQQ:"2027-08-24",VIX:"2027-08-24"}},runtimeStatus:{generatedAt:"2027-08-25T11:00:00Z",actionStatus:"success",state:"latest",marketDataDate:"2027-08-24"',
'generatedAt:"2027-08-25T21:10:00Z",latestDates:{UPRO:"2027-08-25",SSO:"2027-08-25",QLD:"2027-08-25",SPY:"2027-08-25",QQQ:"2027-08-25",VIX:"2027-08-25"}},runtimeStatus:{generatedAt:"2027-08-25T21:10:00Z",actionStatus:"success",state:"latest",marketDataDate:"2027-08-25"',"formal upstream freshness fixtures");
replace("tests/lifecycle-review.test.ts",'const x=base("2027-02-25T12:00:00Z");x.phase5Status.generatedAt="2027-02-25T11:00:00Z";',
'const x=base("2027-02-25T22:00:00Z");x.phase5Status.generatedAt="2027-02-25T21:30:00Z";',"interim review test time");
replace("tests/lifecycle-review.test.ts",'x.runtimeStatus.generatedAt="2027-02-25T11:00:00Z";',
'x.runtimeStatus.generatedAt="2027-02-25T21:30:00Z";',"interim runtime freshness");

// 10) Permanent Audit 5 regression suite and certification policy.
const audit5=`import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\nimport {dailyBarIsComplete,nyseExecutionWindow,nyseReviewBoundaryReached} from "../lib/market-calendar.ts";\n\ntest("lifecycle review cannot open on UTC date or before the NYSE close",()=>{\n  assert.equal(nyseReviewBoundaryReached("2027-08-25","2027-08-25T01:15:00Z"),false);\n  assert.equal(nyseReviewBoundaryReached("2027-08-25","2027-08-25T13:00:00Z"),false);\n  assert.equal(nyseReviewBoundaryReached("2027-08-25","2027-08-25T20:30:00Z"),true);\n});\n\ntest("same-day provider bars are rejected until the conservative post-close boundary",()=>{\n  assert.equal(dailyBarIsComplete("2027-08-25","2027-08-25T20:14:00Z"),false);\n  assert.equal(dailyBarIsComplete("2027-08-25","2027-08-25T20:15:00Z"),true);\n  assert.equal(dailyBarIsComplete("2027-08-26","2027-08-25T22:00:00Z"),false);\n});\n\ntest("execution window flips exactly at the NYSE core open",()=>{\n  assert.equal(nyseExecutionWindow("2026-08-26","2026-08-26T13:29:00Z"),"UPCOMING_OPEN");\n  assert.equal(nyseExecutionWindow("2026-08-26","2026-08-26T13:30:00Z"),"OPEN_PASSED");\n});\n\ntest("Daily generator and primary UI fail closed around incomplete bars and missed opens",()=>{\n  const daily=fs.readFileSync("scripts/generate-daily.ts","utf8"),page=fs.readFileSync("app/page.tsx","utf8");\n  assert.match(daily,/dailyBarIsComplete/);assert.match(daily,/DATA-003/);\n  assert.match(page,/executionMissed/);assert.match(page,/予定始値.*通過/);assert.match(page,/過去の始値を追認せず/);\n});\n\ntest("Production approval refreshes lifecycle both before and after human transition",()=>{\n  const y=fs.readFileSync(".github/workflows/approve-production.yml","utf8");\n  const first=y.indexOf("Refresh authoritative review inputs immediately before Production approval"),approve=y.indexOf("Record explicit human decision locally"),post=y.indexOf("Preflight the exact resulting operational state");\n  assert.ok(first>=0&&approve>first&&post>approve);\n  assert.match(y,/generate:phase5-forward/);assert.ok((y.match(/generate:lifecycle-review/g)||[]).length>=2);assert.match(y,/generate:production-health-review/);\n});\n\ntest("post-selection UI treats TQQQ as reference and does not duplicate a Phase5 Production as research",()=>{\n  const page=fs.readFileSync("app/page.tsx","utf8"),p5=fs.readFileSync("app/phase5-ui.tsx","utf8"),life=fs.readFileSync("app/lifecycle-ui.tsx","utf8");\n  assert.doesNotMatch(page,/現在のChampion：VS13-v1\\.0/);assert.match(page,/TQQQ Reference Baseline/);\n  assert.match(p5,/CURRENT PRODUCTION/);assert.match(p5,/filter\\(x=>!\\(activeProduction&&x\\.version===productionVersion\\)\\)/);\n  assert.match(life,/current incumbentとの共通期間Pareto比較/);\n});\n\ntest("lifecycle implementation supports dynamic incumbent and recurring annual review cycles",()=>{\n  const life=fs.readFileSync("lib/lifecycle-review.ts","utf8");\n  assert.match(life,/configuredIncumbent=hasActiveProduction/);assert.match(life,/s\.version===configuredIncumbent/);\n  assert.match(life,/nextSelectionCycle/);assert.match(life,/addYears\\(cycle\\)/);assert.match(life,/POST_REVIEW_CONTINUE_FORWARD/);\n});\n`;
write("tests/audit5-operational-continuity.test.ts",audit5);

const policy=`# Final Reliability Certification Policy v2 — 2026-08-27\n\n## Status\nThis policy supersedes the earlier interpretation that two clean code audits alone constitute final unattended-operation certification.\n\n## Three-layer certification\n\n### Layer 1 — Independent clean audits\n- Require **two consecutive complete independent CLEAN audits**.\n- A new material defect resets the clean count to **0/2**.\n- A round that discovers and remediates a material defect remains **NOT CLEAN**; successful remediation does not retroactively make that round clean.\n- Each round must directly inspect source/configuration and live authoritative state rather than only rerunning the prior audit checklist.\n\n### Layer 2 — Permanent boundary and fault-injection regression\nPermanent regression must cover at least: New York review-date/close boundaries, DST, weekends/holidays, delayed or incomplete provider bars, stale/failed upstreams, missed execution opens, append-only Forward behavior, Production approval races, post-approval state coherence, dynamic incumbent transitions, PWA/data fail-closed semantics, and annual review recurrence.\n\n### Layer 3 — Unattended operational soak\nBefore issuing **Final Unattended Operations Certification**, require at least **10 consecutive NYSE sessions** on the same materially unchanged control-plane implementation with no manual repair. Daily, Phase 5 and Lifecycle must remain coherent; no missing/duplicate/retroactive Forward records, stale actionable UI, automatic Production promotion, or authoritative-ledger rewrite is permitted. Scheduled-run delay alone is not a failure if freshness/SLO controls remain safe and no action is exposed from stale state.\n\n## Certification wording\n- Passing Layer 1 only: `CODE/CONTROL-PLANE CLEAN 2/2`\n- Passing Layers 1+2 but not soak: `PRE-SOAK RELIABILITY QUALIFIED`\n- Passing all three layers: `FINAL UNATTENDED OPERATIONS CERTIFIED`\n\n## Current effect\nAudit 5 found new material defects. Therefore the clean streak is reset/remains **0/2**. The next independent audit begins a new candidate clean streak only after Audit 5 remediation is closed and validated.\n`;
write("research/final-reliability-certification-policy-2026-08-27.md",policy);

const pkg=JSON.parse(read("package.json"));
for(const k of ["test:core","test:ops"]){if(!pkg.scripts[k].includes("tests/audit5-operational-continuity.test.ts"))pkg.scripts[k]+=" tests/audit5-operational-continuity.test.ts";}
write("package.json",JSON.stringify(pkg,null,2)+"\n");

console.log("Audit 5 remediation patch applied in workspace");
