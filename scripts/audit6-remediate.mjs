import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const write=(p,s)=>fs.writeFileSync(p,s);
const replace=(p,from,to,label)=>{
  const s=read(p);
  if(!s.includes(from))throw new Error(`Audit6 target missing in ${p}: ${label}`);
  if(s.indexOf(from)!==s.lastIndexOf(from))throw new Error(`Audit6 target ambiguous in ${p}: ${label}`);
  write(p,s.replace(from,to));
};

// A6-1: Strict NYSE/date completeness. Past malformed or non-session dates and
// future/current-incomplete dates must never be accepted as completed daily bars.
replace(
  "lib/market-calendar.ts",
  'const DATE_RE=/^\\d{4}-\\d{2}-\\d{2}$/;\n',
  'const DATE_RE=/^\\d{4}-\\d{2}-\\d{2}$/;\nexport function isValidIsoMarketDate(date:string){if(!DATE_RE.test(date))return false;const d=new Date(`${date}T12:00:00Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===date}\n',
  "strict date helper",
);
replace(
  "lib/market-calendar.ts",
  'export function isNyseHoliday(date:string){\n  const y=+date.slice(0,4),goodFriday=easter(y);',
  'export function isNyseHoliday(date:string){\n  if(!isValidIsoMarketDate(date))return false;\n  const y=+date.slice(0,4),goodFriday=easter(y);',
  "holiday date validation",
);
replace(
  "lib/market-calendar.ts",
  'export function isNyseSession(date:string){const d=new Date(`${date}T12:00:00Z`);return DATE_RE.test(date)&&Number.isFinite(d.getTime())&&![0,6].includes(d.getUTCDay())&&!isNyseHoliday(date)}',
  'export function isNyseSession(date:string){if(!isValidIsoMarketDate(date))return false;const d=new Date(`${date}T12:00:00Z`);return ![0,6].includes(d.getUTCDay())&&!isNyseHoliday(date)}',
  "session strict date validation",
);
replace(
  "lib/market-calendar.ts",
  '  if(!DATE_RE.test(startDate)||!DATE_RE.test(endDate)||endDate<startDate)return 0;',
  '  if(!isValidIsoMarketDate(startDate)||!isValidIsoMarketDate(endDate)||endDate<startDate)return 0;',
  "session count strict dates",
);
replace(
  "lib/market-calendar.ts",
  '  if(!DATE_RE.test(reviewDate))return false;',
  '  if(!isValidIsoMarketDate(reviewDate))return false;',
  "review strict date",
);
replace(
  "lib/market-calendar.ts",
  '  if(!DATE_RE.test(barDate)||graceMinutes<0)return false;\n  const clock=nyClock(now);\n  if(barDate<clock.localDate)return true;\n  if(barDate>clock.localDate)return false;\n  if(!isNyseSession(barDate))return false;\n  return clock.minutes>=CLOSE_MINUTES+graceMinutes;',
  '  if(!isValidIsoMarketDate(barDate)||graceMinutes<0||!isNyseSession(barDate))return false;\n  const clock=nyClock(now);\n  if(barDate<clock.localDate)return true;\n  if(barDate>clock.localDate)return false;\n  return clock.minutes>=CLOSE_MINUTES+graceMinutes;',
  "complete bar strict session",
);
replace(
  "lib/market-calendar.ts",
  'export function marketDataLagSessions(marketDataDate:string|undefined,now=new Date().toISOString()){\n  if(!marketDataDate)return Number.POSITIVE_INFINITY;\n  const end=nyClock(now);let latest=end.localDate;\n  if(end.minutes<CLOSE_MINUTES||!isNyseSession(latest)){const d=new Date(`${latest}T12:00:00Z`);do d.setUTCDate(d.getUTCDate()-1);while(!isNyseSession(d.toISOString().slice(0,10)));latest=d.toISOString().slice(0,10)}\n  if(marketDataDate>=latest)return 0;',
  'export function marketDataLagSessions(marketDataDate:string|undefined,now=new Date().toISOString()){\n  if(!marketDataDate||!isNyseSession(marketDataDate))return Number.POSITIVE_INFINITY;\n  const end=nyClock(now);let latest=end.localDate;\n  if(end.minutes<CLOSE_MINUTES||!isNyseSession(latest)){const d=new Date(`${latest}T12:00:00Z`);do d.setUTCDate(d.getUTCDate()-1);while(!isNyseSession(d.toISOString().slice(0,10)));latest=d.toISOString().slice(0,10)}\n  if(marketDataDate>latest)return Number.POSITIVE_INFINITY;\n  if(marketDataDate===latest)return 0;',
  "future market data fail closed",
);

// A6-2: Phase 5 must use the shared strict completed-NYSE-bar rule, not a
// local same-day-only clock filter.
replace(
  "scripts/generate-phase5-forward.ts",
  'import { emptyPhase5Ledger, summarizePhase5, updatePhase5Ledger, type Phase5Ledger } from "../lib/phase5-forward.ts";\n',
  'import { emptyPhase5Ledger, summarizePhase5, updatePhase5Ledger, type Phase5Ledger } from "../lib/phase5-forward.ts";\nimport {dailyBarIsComplete} from "../lib/market-calendar.ts";\n',
  "Phase5 calendar import",
);
replace(
  "scripts/generate-phase5-forward.ts",
  'function nyParts(iso:string){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(iso));const x=Object.fromEntries(p.map(v=>[v.type,v.value]));return{date:`${x.year}-${x.month}-${x.day}`,minutes:Number(x.hour)*60+Number(x.minute)}}\nfunction removeIncompleteCurrentBar<T extends {date:string}>(rows:T[],now:string){const ny=nyParts(now);return rows.filter(r=>!(r.date===ny.date&&ny.minutes<16*60+15))}\n',
  'function keepCompletedNyseBars<T extends {date:string}>(rows:T[],now:string){return rows.filter(r=>dailyBarIsComplete(r.date,now))}\n',
  "remove local partial-bar clock",
);
replace(
  "scripts/generate-phase5-forward.ts",
  '  const safe={...payload,series:Object.fromEntries(Object.entries(payload.series).map(([k,v])=>[k,removeIncompleteCurrentBar(v,generatedAt)]))};',
  '  const safe={...payload,series:Object.fromEntries(Object.entries(payload.series).map(([k,v])=>[k,keepCompletedNyseBars(v,generatedAt)]))};',
  "strict Phase5 completed bar filter",
);

// A6-3: A scheduled review blocked by a transient integrity fault is retryable.
// Preserve the original event and append one immutable recovery snapshot when
// current upstream state becomes safe again.
replace(
  "lib/lifecycle-review.ts",
  '  const cycleDate=latestSelectionCycle(now,schedule),existingCycle=cycleDate?out.events.find(e=>e.reviewDate===cycleDate):undefined;\n  if(cycleDate&&!existingCycle){\n    const d=selectionDecision(reviews),cycleStage=cycleDate===schedule.formal?"FORMAL":"STRONGER";\n    out.events.push({key:`${cycleStage}|${cycleDate}`,stage:cycleStage,reviewDate:cycleDate,recordedAt:now,systemDecision:d.systemDecision,userAction:d.userAction,message:d.message,candidateReviews:structuredClone(reviews)});\n  }\n  const cycle=cycleDate?out.events.find(e=>e.reviewDate===cycleDate):undefined;\n  const approvalResolved=Boolean(cycle&&cycle.userAction==="RUN_PHASE6_HUMAN_REVIEW"&&hasActiveProduction(args.production)&&args.production.approvalDate&&args.production.approvalDate>=cycle.reviewDate);\n  const cycleResolved=Boolean(cycle&&(cycle.userAction!=="RUN_PHASE6_HUMAN_REVIEW"||approvalResolved));',
  '  const cycleDate=latestSelectionCycle(now,schedule);\n  let cycle=cycleDate?out.events.filter(e=>e.reviewDate===cycleDate).at(-1):undefined;\n  if(cycleDate&&!cycle){\n    const d=selectionDecision(reviews),cycleStage=cycleDate===schedule.formal?"FORMAL":"STRONGER";\n    out.events.push({key:`${cycleStage}|${cycleDate}`,stage:cycleStage,reviewDate:cycleDate,recordedAt:now,systemDecision:d.systemDecision,userAction:d.userAction,message:d.message,candidateReviews:structuredClone(reviews)});\n    cycle=out.events.filter(e=>e.reviewDate===cycleDate).at(-1);\n  }\n  if(cycleDate&&cycle?.userAction==="CHECK_DATA_AND_ACTIONS"){\n    const recovered=selectionDecision(reviews);\n    if(recovered.userAction!=="CHECK_DATA_AND_ACTIONS"){\n      const cycleStage=cycleDate===schedule.formal?"FORMAL":"STRONGER";\n      out.events.push({key:`${cycleStage}|${cycleDate}|RECOVERY|${now}`,stage:cycleStage,reviewDate:cycleDate,recordedAt:now,systemDecision:recovered.systemDecision,userAction:recovered.userAction,message:recovered.message,candidateReviews:structuredClone(reviews)});\n      cycle=out.events.at(-1);\n    }\n  }\n  const approvalResolved=Boolean(cycle&&cycle.userAction==="RUN_PHASE6_HUMAN_REVIEW"&&hasActiveProduction(args.production)&&args.production.approvalDate&&args.production.approvalDate>=cycle.reviewDate);\n  const cycleResolved=Boolean(cycle&&(cycle.userAction==="NONE"||approvalResolved));',
  "retryable scheduled review cycle",
);
replace(
  "lib/lifecycle-review.ts",
  '  const nextReview=cycle&&cycle.userAction==="RUN_PHASE6_HUMAN_REVIEW"&&!approvalResolved?cycle.reviewDate:cycle?nextSelectionCycle(cycle.reviewDate,schedule):stage==="ACCUMULATING"?schedule.interim:schedule.formal;',
  '  const cyclePending=Boolean(cycle&&((cycle.userAction==="RUN_PHASE6_HUMAN_REVIEW"&&!approvalResolved)||cycle.userAction==="CHECK_DATA_AND_ACTIONS"));\n  const nextReview=cyclePending?cycle!.reviewDate:cycle?nextSelectionCycle(cycle.reviewDate,schedule):stage==="ACCUMULATING"?schedule.interim:schedule.formal;',
  "retryable next review",
);

// A6-4: Production Health events belong to one Production episode. Re-entering
// the same version later must start its quarterly cadence from the new effectiveDate.
replace(
  "lib/production-health-review.ts",
  '  const last=out.events.filter(x=>x.version===p.strategyVersion).at(-1),firstDue=p.nextHealthReview??(p.effectiveDate?addMonths(p.effectiveDate,3):null);let due=last?addMonths(last.dueDate,3):firstDue;',
  '  const episodeStart=p.effectiveDate,episodeEvents=out.events.filter(x=>x.version===p.strategyVersion&&(!episodeStart||x.dueDate>=episodeStart));\n  const last=episodeEvents.at(-1),firstDue=p.nextHealthReview??(p.effectiveDate?addMonths(p.effectiveDate,3):null);let due=last?addMonths(last.dueDate,3):firstDue;',
  "health episode scoping",
);
replace(
  "lib/production-health-review.ts",
  '  const latest=out.events.filter(x=>x.version===p.strategyVersion).at(-1),state=health.state==="NOT_IN_PRODUCTION"?"Critical":health.state,userAction=state==="Critical"?"URGENT_INTEGRITY_REVIEW":state==="Revalidation Required"?"REVALIDATE_PRODUCTION":"NONE";',
  '  const latest=out.events.filter(x=>x.version===p.strategyVersion&&(!episodeStart||x.dueDate>=episodeStart)).at(-1),state=health.state==="NOT_IN_PRODUCTION"?"Critical":health.state,userAction=state==="Critical"?"URGENT_INTEGRITY_REVIEW":state==="Revalidation Required"?"REVALIDATE_PRODUCTION":"NONE";',
  "health current episode last review",
);

// A6-5: Missed-open safety is a property of the signal/execution window, not
// whether browser-local holdings happened to be entered.
replace(
  "app/page.tsx",
  '    executionMissed=Boolean(holdingsMatch&&actual!==null&&Math.abs(actual-target)>=.001&&executionWindow==="OPEN_PASSED"),',
  '    executionMissed=Boolean(signal&&Math.abs(signal.target-signal.previousTarget)>=.001&&executionWindow==="OPEN_PASSED"),',
  "holdings-independent missed open",
);
replace(
  "app/page.tsx",
  '        : !holdingsMatch\n          ? `運用Tickerが${currentTicker}へ切り替わりました。旧Tickerの保有値は流用しません。${currentTicker}の保有状況を再入力してください`\n          : actual === null\n            ? "保有状況未入力：目標のみ表示"\n            : executionMissed\n              ? `売買しない：予定始値（${executionDate}）を通過しています。過去の始値を追認せず、次のDaily Signal更新後に再確認してください`',
  '        : executionMissed\n          ? `売買しない：予定始値（${executionDate}）を通過しています。過去の始値を追認せず、次のDaily Signal更新後に再確認してください`\n          : !holdingsMatch\n            ? `運用Tickerが${currentTicker}へ切り替わりました。旧Tickerの保有値は流用しません。${currentTicker}の保有状況を再入力してください`\n            : actual === null\n              ? "保有状況未入力：目標のみ表示"',
  "missed open action priority",
);

// Dynamic lifecycle recovery test.
let lifeTest=read("tests/lifecycle-review.test.ts");
lifeTest += `\n\ntest("transient incumbent failure at a scheduled review is retryable after current data recovers",()=>{\n  const x=base();for(const f of x.phase5.freezes)seedPhase5(x.phase5,f.version,262,6);seedIncumbent(x.forward,262,6);\n  x.runtimeStatus.generatedAt="2027-08-20T22:00:00Z";\n  const blocked=updateLifecycleReview({...x,prior:null});\n  assert.equal(blocked.current.userAction,"CHECK_DATA_AND_ACTIONS");assert.equal(blocked.current.nextReview,"2027-08-25");assert.equal(blocked.current.reviewResolved,false);assert.equal(blocked.events.length,1);\n  const recovered=updateLifecycleReview({...x,prior:blocked,now:"2027-08-26T12:00:00Z",runtimeStatus:{...x.runtimeStatus,generatedAt:"2027-08-26T11:00:00Z",marketDataDate:"2027-08-25"},phase5Status:{...x.phase5Status,generatedAt:"2027-08-26T11:00:00Z"}});\n  assert.equal(recovered.current.systemDecision,"PHASE6_HUMAN_DECISION_REQUIRED");assert.equal(recovered.current.userAction,"RUN_PHASE6_HUMAN_REVIEW");assert.equal(recovered.current.nextReview,"2027-08-25");assert.equal(recovered.events.length,2);assert.match(recovered.events[1].key,/RECOVERY/);\n});\n`;
write("tests/lifecycle-review.test.ts",lifeTest);

// Dynamic Production Health re-entry test.
let healthTest=read("tests/production-health-review.test.ts");
healthTest += `\n\ntest("re-entering the same Production version starts a new quarterly health episode",()=>{\n  const old=emptyProductionHealthLedger("2027-08-25T00:00:00Z");old.events.push({key:"UPRO-SPBT-v1.0|2027-11-25",dueDate:"2027-11-25",recordedAt:"2027-11-25T12:00:00Z",version:"UPRO-SPBT-v1.0",state:"Healthy",timing:"ON_TIME",reasons:["old episode"]});\n  const d=transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION"),p=transitionMode(d,"PRODUCTION",{ticker:"UPRO",system:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0",date:"2029-01-10",evidence:"Strong",finalReviewComplete:true});\n  const l=lifecycle();l.current.productionHealth={state:"Healthy",version:"UPRO-SPBT-v1.0",reasons:["ok"],nextHealthReview:"2029-04-10"};\n  const before=updateProductionHealthLedger({production:p,lifecycle:l,prior:old,now:"2029-01-11T12:00:00Z"});assert.equal(before.events.length,1);assert.equal(before.current.lastReview,null);assert.equal(before.current.nextReview,"2029-04-10");\n  const due=updateProductionHealthLedger({production:p,lifecycle:l,prior:before,now:"2029-04-10T20:30:00Z"});assert.equal(due.events.length,2);assert.equal(due.current.lastReview,"2029-04-10");assert.equal(due.current.nextReview,"2029-07-10");\n});\n`;
write("tests/production-health-review.test.ts",healthTest);

const audit6=`import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\nimport {dailyBarIsComplete,isNyseSession,marketDataLagSessions} from "../lib/market-calendar.ts";\n\ntest("completed daily bars require a real NYSE session and cannot come from the future",()=>{\n  assert.equal(isNyseSession("2026-02-31"),false);\n  assert.equal(dailyBarIsComplete("2026-02-31","2026-08-27T12:00:00Z"),false);\n  assert.equal(dailyBarIsComplete("2026-08-22","2026-08-27T12:00:00Z"),false);\n  assert.equal(dailyBarIsComplete("2026-08-28","2026-08-27T12:00:00Z"),false);\n});\n\ntest("market-data freshness fails closed for a not-yet-completed session",()=>{\n  assert.equal(marketDataLagSessions("2027-08-26","2027-08-26T12:00:00Z"),Number.POSITIVE_INFINITY);\n  assert.equal(marketDataLagSessions("2027-08-25","2027-08-26T12:00:00Z"),0);\n});\n\ntest("Phase 5 uses the shared strict completed-bar guard",()=>{\n  const s=fs.readFileSync("scripts/generate-phase5-forward.ts","utf8");\n  assert.match(s,/dailyBarIsComplete/);assert.match(s,/keepCompletedNyseBars/);assert.doesNotMatch(s,/removeIncompleteCurrentBar|function nyParts/);\n});\n\ntest("missed-open UI safety does not depend on browser-local holdings",()=>{\n  const p=fs.readFileSync("app/page.tsx","utf8"),line=p.split("\\n").find(x=>x.includes("executionMissed=Boolean"))||"";\n  assert.match(line,/signal&&Math\\.abs\\(signal\\.target-signal\\.previousTarget\\)/);assert.doesNotMatch(line,/holdingsMatch|actual/);\n  const action=p.slice(p.indexOf("    action ="),p.indexOf("  const sourceLabel"));assert.ok(action.indexOf(": executionMissed")<action.indexOf(": !holdingsMatch"));\n});\n\ntest("Phase 5 never deploys an unpersisted or authority-stale workspace",()=>{\n  const y=fs.readFileSync(".github/workflows/phase5-forward.yml","utf8");\n  assert.match(y,/id: persist/);assert.match(y,/id: authority/);\n  const build=y.slice(y.indexOf("- name: Build integrated PWA"),y.indexOf("- uses: actions\\/configure-pages@v6"));\n  assert.match(build,/steps\\.persist\\.outcome == 'success'/);assert.match(build,/steps\\.authority\\.outcome == 'success'/);assert.match(build,/steps\\.integrity\\.outcome == 'success'/);\n  const deploy=y.slice(y.indexOf("- name: Deploy integrated Pages"),y.indexOf("- name: Enforce Phase 5"));assert.match(deploy,/steps\\.persist\\.outcome == 'success'/);assert.match(deploy,/steps\\.authority\\.outcome == 'success'/);\n});\n\ntest("Audit 6 lifecycle and health episode regressions are permanent source tests",()=>{\n  const l=fs.readFileSync("tests/lifecycle-review.test.ts","utf8"),h=fs.readFileSync("tests/production-health-review.test.ts","utf8");\n  assert.match(l,/transient incumbent failure at a scheduled review is retryable/);assert.match(l,/RECOVERY/);\n  assert.match(h,/re-entering the same Production version starts a new quarterly health episode/);\n});\n`;
write("tests/audit6-recurring-failures.test.ts",audit6);

const pkg=JSON.parse(read("package.json"));
for(const k of ["test:core","test:ops"]){if(!pkg.scripts[k].includes("tests/audit6-recurring-failures.test.ts"))pkg.scripts[k]+=" tests/audit6-recurring-failures.test.ts";}
write("package.json",JSON.stringify(pkg,null,2)+"\n");

console.log("Audit 6 remediation applied");
