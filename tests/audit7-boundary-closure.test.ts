import test from "node:test";
import assert from "node:assert/strict";
import {dailyBarIsComplete,earliestLegalNyseOpen,nyseReviewBoundaryReached} from "../lib/market-calendar.ts";
import {lifecycleReviewCoversUpstreams,lifecycleReviewIsFresh} from "../lib/lifecycle-approval.ts";
import {emptyLifecycleLedger} from "../lib/lifecycle-review.ts";
import {emptyPhase5Ledger} from "../lib/phase5-forward.ts";

test("A7 D04 FC-01: early-close session remains conservatively closed until the normal 16:00/16:15 ET gates",()=>{
  // 2027-11-26 is the Friday after Thanksgiving and is ordinarily a 13:00 ET early close.
  // The control plane intentionally does not model that earlier close: it stays late, never early.
  assert.equal(dailyBarIsComplete("2027-11-26","2027-11-26T18:30:00Z"),false,"13:30 ET must remain incomplete under the conservative Daily gate");
  assert.equal(nyseReviewBoundaryReached("2027-11-26","2027-11-26T18:30:00Z"),false,"13:30 ET must remain below the conservative review boundary");
  assert.equal(nyseReviewBoundaryReached("2027-11-26","2027-11-26T21:01:00Z"),true);
  assert.equal(dailyBarIsComplete("2027-11-26","2027-11-26T21:16:00Z"),true);
});

test("A7 D18 FC-01/09/08: partial current Daily data plus delayed run can never chase the already-passed open",()=>{
  // At 10:00 ET on Aug 26 the Aug 26 bar is still incomplete, while an Aug 25 close is usable.
  assert.equal(dailyBarIsComplete("2026-08-26","2026-08-26T14:00:00Z"),false);
  assert.equal(dailyBarIsComplete("2026-08-25","2026-08-26T14:00:00Z"),true);
  // If the Aug 25 close is first actionable only now, the Aug 26 09:30 open is expired.
  assert.equal(earliestLegalNyseOpen("2026-08-25","2026-08-26T14:00:00Z"),"2026-08-27");
});

test("A7 D21 FC-02/11: fresh upstream regeneration invalidates an older Lifecycle approval snapshot until Lifecycle is refreshed",()=>{
  const schedule=emptyPhase5Ledger().reviewSchedule;
  const stale=emptyLifecycleLedger(schedule,"2027-08-25T20:00:00Z");
  assert.equal(lifecycleReviewIsFresh(stale,"2027-08-25T20:30:00Z"),true,"age alone may still be fresh");
  assert.equal(lifecycleReviewCoversUpstreams(stale,["2027-08-25T20:05:00Z","2027-08-25T20:06:00Z"]),false,"newer upstream authority must invalidate the older review even within the 48h age window");
  const refreshed={...stale,updatedAt:"2027-08-25T20:07:00Z"};
  assert.equal(lifecycleReviewCoversUpstreams(refreshed,["2027-08-25T20:05:00Z","2027-08-25T20:06:00Z"]),true);
});
