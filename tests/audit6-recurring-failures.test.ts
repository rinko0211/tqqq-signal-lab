import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {dailyBarIsComplete,isNyseSession,marketDataLagSessions} from "../lib/market-calendar.ts";

test("completed daily bars require a real NYSE session and cannot come from the future",()=>{
  assert.equal(isNyseSession("2026-02-31"),false);
  assert.equal(dailyBarIsComplete("2026-02-31","2026-08-27T12:00:00Z"),false);
  assert.equal(dailyBarIsComplete("2026-08-22","2026-08-27T12:00:00Z"),false);
  assert.equal(dailyBarIsComplete("2026-08-28","2026-08-27T12:00:00Z"),false);
});

test("market-data freshness fails closed for a not-yet-completed session",()=>{
  assert.equal(marketDataLagSessions("2027-08-26","2027-08-26T12:00:00Z"),Number.POSITIVE_INFINITY);
  assert.equal(marketDataLagSessions("2027-08-25","2027-08-26T12:00:00Z"),0);
});

test("Phase 5 uses the shared strict completed-bar guard",()=>{
  const s=fs.readFileSync("scripts/generate-phase5-forward.ts","utf8");
  assert.match(s,/dailyBarIsComplete/);assert.match(s,/keepCompletedNyseBars/);assert.doesNotMatch(s,/removeIncompleteCurrentBar|function nyParts/);
});

test("missed-open UI safety does not depend on browser-local holdings",()=>{
  const p=fs.readFileSync("lib/primary-action.ts","utf8"),line=p.split("\n").find(x=>x.includes("executionMissed=Boolean"))||"";
  assert.ok(p.includes('signalNumericUnsafe=Boolean'));
  assert.ok(p.includes('signalChange=Boolean(signal&&!signalNumericUnsafe&&Math.abs(signal.target-signal.previousTarget)>=.001)'));
  assert.ok(line.includes('signalChange&&executionWindow==="OPEN_PASSED"'));assert.doesNotMatch(line,/holdingsMatch|actual/);
  const missed=p.indexOf('if(executionMissed)'),holdings=p.indexOf('if(!holdingsMatch)');assert.ok(missed>=0&&holdings>missed,"expired-open guard must precede any browser-local holdings branch");
});

test("Phase 5 never deploys an unpersisted or authority-stale workspace",()=>{
  const y=fs.readFileSync(".github/workflows/phase5-forward.yml","utf8");
  assert.match(y,/id: persist/);assert.match(y,/id: authority/);
  const build=y.slice(y.indexOf("- name: Build integrated PWA"),y.indexOf("- uses: actions\/configure-pages@v6"));
  assert.match(build,/steps\.persist\.outcome == 'success'/);assert.match(build,/steps\.authority\.outcome == 'success'/);assert.match(build,/steps\.integrity\.outcome == 'success'/);
  const deploy=y.slice(y.indexOf("- name: Deploy integrated Pages"),y.indexOf("- name: Enforce Phase 5"));assert.match(deploy,/steps\.persist\.outcome == 'success'/);assert.match(deploy,/steps\.authority\.outcome == 'success'/);
});

test("Audit 6 lifecycle and health episode regressions are permanent source tests",()=>{
  const l=fs.readFileSync("tests/lifecycle-review.test.ts","utf8"),h=fs.readFileSync("tests/production-health-review.test.ts","utf8");
  assert.match(l,/transient incumbent failure at a scheduled review is retryable/);assert.match(l,/RECOVERY/);
  assert.match(h,/re-entering the same Production version starts a new quarterly health episode/);
});


test("Daily filters every operational bar through the shared completed-session predicate",()=>{
  const s=fs.readFileSync("scripts/generate-daily.ts","utf8");assert.match(s,/ds\.days\.filter\(d=>dailyBarIsComplete\(d\.date,generatedAt\)\)/);assert.doesNotMatch(s,/while\(ds\.days\.length&&!dailyBarIsComplete/);
});

test("weekend or holiday review dates roll to the next NYSE close",async()=>{
  const {nyseReviewBoundaryReached,effectiveReviewSession}=await import("../lib/market-calendar.ts");
  assert.equal(effectiveReviewSession("2027-08-28"),"2027-08-30");assert.equal(nyseReviewBoundaryReached("2027-08-28","2027-08-28T22:00:00Z"),false);assert.equal(nyseReviewBoundaryReached("2027-08-28","2027-08-30T19:59:00Z"),false);assert.equal(nyseReviewBoundaryReached("2027-08-28","2027-08-30T20:01:00Z"),true);
});

test("Phase5 acquisition and lifecycle isolate frozen systems by version",()=>{
  const data=fs.readFileSync("lib/official-data.ts","utf8"),gen=fs.readFileSync("scripts/generate-phase5-forward.ts","utf8"),life=fs.readFileSync("lib/lifecycle-review.ts","utf8"),p5=fs.readFileSync("lib/phase5-forward.ts","utf8");
  assert.match(data,/Promise\.allSettled/);assert.match(gen,/systems:Record/);assert.match(gen,/updatePhase5LedgerSubset/);assert.match(p5,/export function updatePhase5LedgerSubset/);assert.match(life,/status\?\.systems\?\.\[version\]/);assert.match(life,/phase5StatusQuality\(phase5Status,now,false,version\)/);
});
