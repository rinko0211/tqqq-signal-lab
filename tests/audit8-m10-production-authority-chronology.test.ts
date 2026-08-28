import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {derivePrimaryAction,type PrimaryActionCode} from "../lib/primary-action.ts";

/* Audit 8 M10 permanent independent regression.
 * Expected outcomes are literal contract values. This file intentionally imports
 * no Production validator, authority helper, calendar helper, freshness helper,
 * or Forward validator.
 */
const G="2026-08-26T21:10:00.000Z";
const ID={ticker:"TQQQ",strategy:"Volatility Shield 12%",version:"VS12-v1.0"};
const authoritativeForward=JSON.parse(fs.readFileSync("public/data/forward-ledger.json","utf8"));
const status=(generatedAt=G,date="2026-08-26")=>({generatedAt,actionStatus:"success",marketDataDate:date,signalDate:date,state:"latest",errors:[]});
const signal=(mode:"PRODUCTION"|"DECISION"="PRODUCTION",generatedAt=G,date="2026-08-26",executionDate="2026-08-27")=>({generatedAt,dataDate:date,platformMode:mode,assetTicker:ID.ticker,strategy:ID.strategy,strategyVersion:ID.version,state:"latest",signal:{date,target:.75,previousTarget:.5,executionDate}});
const production=(x:Partial<any>={})=>({schemaVersion:1,mode:"PRODUCTION",selectedTicker:ID.ticker,selectedStrategy:ID.strategy,strategyVersion:ID.version,approvedByHuman:true,approvalDate:"2026-08-25",effectiveDate:"2026-08-25",lastHealthReview:null,nextHealthReview:"2026-11-25",updatedAt:"2026-08-25T12:00:00.000Z",...x});
const forward=(generatedAt=G)=>({...structuredClone(authoritativeForward),updatedAt:generatedAt});
const act=(x:{production:any;now?:string;mode?:"PRODUCTION"|"DECISION";generatedAt?:string;date?:string;executionDate?:string;forward?:any})=>derivePrimaryAction({signal:signal(x.mode??"PRODUCTION",x.generatedAt??G,x.date??"2026-08-26",x.executionDate??"2026-08-27"),status:status(x.generatedAt??G,x.date??"2026-08-26"),forward:x.forward??forward(x.generatedAt??G),production:x.production,now:x.now??"2026-08-27T12:00:00.000Z",holdings:{ratio:"50",ticker:ID.ticker,version:ID.version}}).code;
const expect=(got:PrimaryActionCode,want:PrimaryActionCode,label:string)=>assert.equal(got,want,label);

test("A8 M10 oracle independence: no white-box chronology imports",()=>{
  const imports=fs.readFileSync("tests/audit8-m10-production-authority-chronology.test.ts","utf8").split("\n").filter(x=>x.startsWith("import ")).join("\n");
  assert.match(imports,/primary-action\.ts/);
  for(const forbidden of ["production.ts","operational-authority","market-calendar","engine.ts","forward.ts"])
    assert.doesNotMatch(imports,new RegExp(`from [\\"'].*${forbidden}`));
});

test("A8 M10: future approval and effective dates fail closed",()=>{
  expect(act({production:production({approvalDate:"2026-08-28",effectiveDate:"2026-08-28"})}),"CHECK_DATA","future Production authority must not authorize current risk");
});

test("A8 M10: future approval with a preserved past episode date still fails closed",()=>{
  expect(act({production:production({approvalDate:"2026-08-28",effectiveDate:"2026-08-25"})}),"CHECK_DATA","future Human Approval cannot authorize current risk");
});

test("A8 M10: current approval cannot authorize a future effective date",()=>{
  expect(act({production:production({approvalDate:"2026-08-27",effectiveDate:"2026-08-28"})}),"CHECK_DATA","future effective authority must fail closed");
});

test("A8 M10: Production updatedAt cannot be in the future",()=>{
  expect(act({production:production({updatedAt:"2026-08-28T12:00:00.000Z"})}),"CHECK_DATA","future Production metadata must fail closed");
});

test("A8 M10: valid current-date Production chronology preserves normal action",()=>{
  expect(act({production:production({approvalDate:"2026-08-27",effectiveDate:"2026-08-27",updatedAt:"2026-08-27T11:00:00.000Z"})}),"INCREASE","same New York market date is valid once authority already exists");
});

test("A8 M10: same-system reaffirmation may keep an earlier episode effective date",()=>{
  expect(act({production:production({approvalDate:"2026-08-27",effectiveDate:"2026-08-25",updatedAt:"2026-08-27T11:00:00.000Z"})}),"INCREASE","later valid re-approval must not reset or invalidate the existing Production episode");
});

test("A8 M10: DECISION retaining an incumbent obeys the same chronology gate",()=>{
  const p=production({mode:"DECISION",approvalDate:"2026-08-28",effectiveDate:"2026-08-28"});
  expect(act({production:p,mode:"DECISION"}),"CHECK_DATA","DECISION cannot preserve temporally impossible incumbent authority");
});

test("A8 M10: date-only authority uses New York date, not UTC date",()=>{
  const g="2026-08-27T20:10:00.000Z";
  const f=forward(g);
  for(const r of f.records)r.recordedAt=g;
  const p=production({approvalDate:"2026-08-28",effectiveDate:"2026-08-28",updatedAt:"2026-08-27T20:00:00.000Z"});
  expect(act({production:p,now:"2026-08-28T01:00:00.000Z",generatedAt:g,date:"2026-08-27",executionDate:"2026-08-28",forward:f}),"CHECK_DATA","01:00 UTC is still prior New York market date and must not activate next-date authority");
});
