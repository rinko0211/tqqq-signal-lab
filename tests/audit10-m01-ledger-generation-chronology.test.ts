import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {emptyLifecycleLedger,assertLifecycleLedgerInternalIntegrity,updateLifecycleReview,type LifecycleLedger} from "../lib/lifecycle-review.ts";
import {emptyProductionHealthLedger,assertProductionHealthLedgerInternalIntegrity,updateProductionHealthLedger,type ProductionHealthLedger} from "../lib/production-health-review.ts";
import type {Phase5Ledger} from "../lib/phase5-forward.ts";
import type {ForwardLedger} from "../lib/forward.ts";
import type {ProductionConfig} from "../lib/production.ts";

const clone=<T>(x:T):T=>structuredClone(x);
const schedule={interim:"2027-02-25",formal:"2027-08-25",stronger:"2028-08-25"};
const lifecycleEvent=(recordedAt:string)=>({key:"INTERIM|2027-02-25",stage:"INTERIM" as const,reviewDate:"2027-02-25",recordedAt,systemDecision:"fixture",userAction:"NONE" as const,candidateReviews:[]});
const healthEvent=(recordedAt:string)=>({key:"VS13-v1.0|2027-11-25",dueDate:"2027-11-25",recordedAt,version:"VS13-v1.0",state:"Healthy" as const,timing:"ON_TIME" as const,reasons:["Audit10 M01 fixture"]});

function lifecycleWith(updatedAt:string,recordedAt:string){const x=emptyLifecycleLedger(schedule,updatedAt);x.events.push(lifecycleEvent(recordedAt));return x}
function healthWith(updatedAt:string,recordedAt:string){const x=emptyProductionHealthLedger(updatedAt);x.events.push(healthEvent(recordedAt));return x}

test("A10-M01 Lifecycle accepts nested evidence before/equal to ledger generation",()=>{
  assert.doesNotThrow(()=>assertLifecycleLedgerInternalIntegrity(lifecycleWith("2027-03-01T21:00:00.000Z","2027-02-28T21:00:00.000Z")));
  assert.doesNotThrow(()=>assertLifecycleLedgerInternalIntegrity(lifecycleWith("2027-03-01T21:00:00.000Z","2027-03-01T21:00:00.000Z")));
});

test("A10-M01 Lifecycle rejects nested evidence after ledger generation and malformed generation",()=>{
  assert.throws(()=>assertLifecycleLedgerInternalIntegrity(lifecycleWith("2027-03-01T21:00:00.000Z","2030-01-02T21:00:00.000Z")),/chronology|generation/i);
  const bad=lifecycleWith("2027-03-01T21:00:00.000Z","2027-03-01T20:00:00.000Z");bad.updatedAt="not-a-time";
  assert.throws(()=>assertLifecycleLedgerInternalIntegrity(bad),/generation|updatedAt|invalid/i);
});

test("A10-M01 Production Health accepts nested evidence before/equal to ledger generation",()=>{
  assert.doesNotThrow(()=>assertProductionHealthLedgerInternalIntegrity(healthWith("2027-11-26T22:00:00.000Z","2027-11-26T21:00:00.000Z")));
  assert.doesNotThrow(()=>assertProductionHealthLedgerInternalIntegrity(healthWith("2027-11-26T22:00:00.000Z","2027-11-26T22:00:00.000Z")));
});

test("A10-M01 Production Health rejects nested evidence after ledger generation and malformed generation",()=>{
  assert.throws(()=>assertProductionHealthLedgerInternalIntegrity(healthWith("2027-11-26T22:00:00.000Z","2030-01-02T21:00:00.000Z")),/chronology|generation/i);
  const bad=healthWith("2027-11-26T22:00:00.000Z","2027-11-26T21:00:00.000Z");bad.updatedAt="not-a-time";
  assert.throws(()=>assertProductionHealthLedgerInternalIntegrity(bad),/generation|updatedAt|invalid/i);
});

test("A10-M01 repeated Lifecycle retry rejects impossible prior without mutating it",()=>{
  const phase5=JSON.parse(fs.readFileSync("github-pages/public/data/phase-5-forward-ledger.json","utf8")) as Phase5Ledger;
  const forward=JSON.parse(fs.readFileSync("github-pages/public/data/forward-ledger.json","utf8")) as ForwardLedger;
  const production=JSON.parse(fs.readFileSync("github-pages/public/data/production-config.json","utf8")) as ProductionConfig;
  const prior=emptyLifecycleLedger(phase5.reviewSchedule,"2026-08-29T00:00:00.000Z");
  prior.events.push({key:`INTERIM|${phase5.reviewSchedule.interim}`,stage:"INTERIM",reviewDate:phase5.reviewSchedule.interim,recordedAt:"2030-01-02T21:00:00.000Z",systemDecision:"fixture",userAction:"NONE",candidateReviews:[]});
  const before=clone(prior);
  for(let i=0;i<3;i++)assert.throws(()=>updateLifecycleReview({phase5,forward,production,prior,now:`2028-08-28T2${i}:00:00.000Z`}),/chronology|generation/i);
  assert.deepEqual(prior,before);
});

test("A10-M01 repeated Production Health retry rejects impossible prior without mutating it",()=>{
  const production=JSON.parse(fs.readFileSync("github-pages/public/data/production-config.json","utf8")) as ProductionConfig;
  const lifecycle=JSON.parse(fs.readFileSync("github-pages/public/data/lifecycle-review.json","utf8")) as LifecycleLedger;
  const prior=healthWith("2026-08-29T00:00:00.000Z","2030-01-02T21:00:00.000Z");
  const before=clone(prior);
  for(let i=0;i<3;i++)assert.throws(()=>updateProductionHealthLedger({production,lifecycle,prior,now:`2028-08-28T2${i}:00:00.000Z`}),/chronology|generation/i);
  assert.deepEqual(prior,before);
});
