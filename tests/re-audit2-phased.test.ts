import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page=fs.readFileSync("app/page.tsx","utf8");
const dash=fs.readFileSync("app/phase5-ui.tsx","utf8");

test("primary Signal UI treats approved DECISION as active Production",()=>{
  assert.match(page,/activeProduction=humanApproved&&platformMode!=="RESEARCH"/);
  assert.match(page,/decisionPending=activeProduction&&platformMode==="DECISION"/);
  assert.match(page,/正式Production継続中 · Decision Review Pending/);
  assert.doesNotMatch(page,/platformMode==="PRODUCTION"&&humanApproved\?"ok":"warn"/);
});

test("integrated dashboard preserves active Production while Decision review is pending",()=>{
  assert.match(dash,/activeProduction = humanApproved === true && platformMode !== "RESEARCH"/);
  assert.match(dash,/decisionPending = activeProduction && platformMode === "DECISION"/);
  assert.match(dash,/FORMAL PRODUCTION CONTINUES · DECISION REVIEW PENDING/);
  assert.match(dash,/Human Decision review中も既存の正式Productionは継続しています/);
  assert.match(dash,/Decision review中も既存Productionが実運用判断を継続/);
  assert.doesNotMatch(dash,/const formalProduction = platformMode === "PRODUCTION"/);
});
