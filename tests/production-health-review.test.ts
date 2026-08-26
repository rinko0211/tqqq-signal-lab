import test from "node:test";
import assert from "node:assert/strict";
import { emptyProductionHealthLedger, updateProductionHealthLedger } from "../lib/production-health-review.ts";
import { DEFAULT_PRODUCTION_CONFIG, transitionMode } from "../lib/production.ts";
import { emptyLifecycleLedger, type LifecycleLedger } from "../lib/lifecycle-review.ts";
import { emptyPhase5Ledger } from "../lib/phase5-forward.ts";

const production=()=>{const d=transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION");return transitionMode(d,"PRODUCTION",{ticker:"UPRO",system:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0",date:"2027-08-25",evidence:"Strong",finalReviewComplete:true})};
const lifecycle=(state:"Healthy"|"Watch"|"Revalidation Required"|"Critical"="Healthy")=>{const l=emptyLifecycleLedger(emptyPhase5Ledger().reviewSchedule,"2027-11-25T00:00:00Z") as LifecycleLedger;l.current.productionHealth={state,version:"UPRO-SPBT-v1.0",reasons:state==="Healthy"?["ok"]:["trigger"],nextHealthReview:"2027-11-25"};return l};

test("quarterly Production review is recorded and rolled forward",()=>{const p=production(),a=updateProductionHealthLedger({production:p,lifecycle:lifecycle(),prior:null,now:"2027-11-25T12:00:00Z"});assert.equal(a.events.length,1);assert.equal(a.events[0].timing,"ON_TIME");assert.equal(a.current.nextReview,"2028-02-25");assert.equal(a.current.userAction,"NONE")});
test("same quarterly review is append-only and never duplicated",()=>{const p=production(),a=updateProductionHealthLedger({production:p,lifecycle:lifecycle(),prior:null,now:"2027-11-25T12:00:00Z"}),b=updateProductionHealthLedger({production:p,lifecycle:lifecycle(),prior:a,now:"2027-11-26T12:00:00Z"});assert.equal(b.events.length,1);assert.deepEqual(b.events,a.events)});
test("critical Production health creates urgent user action",()=>{const p=production(),a=updateProductionHealthLedger({production:p,lifecycle:lifecycle("Critical"),prior:null,now:"2027-11-25T12:00:00Z"});assert.equal(a.current.userAction,"URGENT_INTEGRITY_REVIEW")});
test("late review never fabricates a historical health state",()=>{const p=production(),a=updateProductionHealthLedger({production:p,lifecycle:lifecycle(),prior:emptyProductionHealthLedger(),now:"2027-12-10T12:00:00Z"});assert.equal(a.events[0].timing,"LATE_CURRENT_STATE_ONLY");assert.ok(a.events[0].reasons.some(x=>/no retrospective/i.test(x)))});
