import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {dailyBarIsComplete,nyseExecutionWindow,nyseReviewBoundaryReached} from "../lib/market-calendar.ts";

test("lifecycle review cannot open on UTC date or before the NYSE close",()=>{
  assert.equal(nyseReviewBoundaryReached("2027-08-25","2027-08-25T01:15:00Z"),false);
  assert.equal(nyseReviewBoundaryReached("2027-08-25","2027-08-25T13:00:00Z"),false);
  assert.equal(nyseReviewBoundaryReached("2027-08-25","2027-08-25T20:30:00Z"),true);
});

test("same-day provider bars are rejected until the conservative post-close boundary",()=>{
  assert.equal(dailyBarIsComplete("2027-08-25","2027-08-25T20:14:00Z"),false);
  assert.equal(dailyBarIsComplete("2027-08-25","2027-08-25T20:15:00Z"),true);
  assert.equal(dailyBarIsComplete("2027-08-26","2027-08-25T22:00:00Z"),false);
});

test("execution window flips exactly at the NYSE core open",()=>{
  assert.equal(nyseExecutionWindow("2026-08-26","2026-08-26T13:29:00Z"),"UPCOMING_OPEN");
  assert.equal(nyseExecutionWindow("2026-08-26","2026-08-26T13:30:00Z"),"OPEN_PASSED");
});

test("Daily generator and primary UI fail closed around incomplete bars and missed opens",()=>{
  const daily=fs.readFileSync("scripts/generate-daily.ts","utf8"),page=fs.readFileSync("app/page.tsx","utf8");
  assert.match(daily,/dailyBarIsComplete/);assert.match(daily,/DATA-003/);
  assert.match(page,/executionMissed/);assert.match(page,/予定始値.*通過/);assert.match(page,/過去の始値を追認せず/);
});

test("Production approval refreshes lifecycle both before and after human transition",()=>{
  const y=fs.readFileSync(".github/workflows/approve-production.yml","utf8");
  const first=y.indexOf("Refresh authoritative review inputs immediately before Production approval"),approve=y.indexOf("Record explicit human decision locally"),post=y.indexOf("Preflight the exact resulting operational state");
  assert.ok(first>=0&&approve>first&&post>approve);
  assert.match(y,/generate:phase5-forward/);assert.ok((y.match(/generate:lifecycle-review/g)||[]).length>=2);assert.match(y,/generate:production-health-review/);
});

test("post-selection UI treats TQQQ as reference and does not duplicate a Phase5 Production as research",()=>{
  const page=fs.readFileSync("app/page.tsx","utf8"),p5=fs.readFileSync("app/phase5-ui.tsx","utf8"),life=fs.readFileSync("app/lifecycle-ui.tsx","utf8");
  assert.doesNotMatch(page,/現在のChampion：VS13-v1\.0/);assert.match(page,/TQQQ Reference Baseline/);
  assert.match(p5,/CURRENT PRODUCTION/);assert.match(p5,/filter\(x=>!\(activeProduction&&x\.version===productionVersion\)\)/);
  assert.match(life,/current incumbentとの共通期間Pareto比較/);
});

test("lifecycle implementation supports dynamic incumbent and recurring annual review cycles",()=>{
  const life=fs.readFileSync("lib/lifecycle-review.ts","utf8");
  assert.match(life,/configuredIncumbent=hasActiveProduction/);assert.match(life,/s.version===configuredIncumbent/);
  assert.match(life,/nextSelectionCycle/);assert.match(life,/addYears\(cycle\)/);assert.match(life,/POST_REVIEW_CONTINUE_FORWARD/);
});


test("challenger failure is isolated while incumbent failure remains globally fail-closed",()=>{
  const life=fs.readFileSync("lib/lifecycle-review.ts","utf8");
  assert.doesNotMatch(life,/else if\(incumbentIssue\|\|candidateIssues\)/);
  assert.match(life,/else if\(incumbentIssue\)/);
  assert.match(life,/cycle&&cycle\.userAction===\"RUN_PHASE6_HUMAN_DECISION_REQUIRED\"|cycle&&cycle\.userAction===\"RUN_PHASE6_HUMAN_REVIEW\"/);
});

test("Daily runtime contains no one-shot Audit 5 bootstrap",()=>{
  const daily=fs.readFileSync("scripts/generate-daily.ts","utf8");
  assert.doesNotMatch(daily,/AUDIT5_BOOTSTRAP|audit5-remediate|Applying approved Audit 5 remediation/);
});
