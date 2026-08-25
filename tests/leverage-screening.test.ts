import test from "node:test";
import assert from "node:assert/strict";
import { SCREENING, EXCLUDED } from "../lib/cross-ticker.ts";

test("Phase 1 core universe contains Nasdaq and S&P 2x/3x pairs",()=>{
  const qld=SCREENING.find(x=>x.ticker==="QLD"),tqqq=SCREENING.find(x=>x.ticker==="TQQQ");
  const sso=SCREENING.find(x=>x.ticker==="SSO"),upro=SCREENING.find(x=>x.ticker==="UPRO");
  assert.equal(qld?.proxy,"QQQ");
  assert.equal(tqqq?.proxy,"QQQ");
  assert.equal(qld?.leverage,"2x daily");
  assert.equal(tqqq?.leverage,"3x daily");
  assert.equal(sso?.proxy,"SPY");
  assert.equal(upro?.proxy,"SPY");
  assert.equal(sso?.leverage,"2x daily");
  assert.equal(upro?.leverage,"3x daily");
  assert.equal(qld?.researchPhase,"CORE");
  assert.equal(sso?.researchPhase,"CORE");
});

test("New 2x products cannot enter Forward automatically in Phase 1",()=>{
  for(const ticker of ["QLD","SSO","ROM","USD"]){
    const row=SCREENING.find(x=>x.ticker===ticker);
    assert.ok(row,`${ticker} missing`);
    assert.equal(row.forwardEligible,false);
  }
});

test("Semiconductor 2x/3x pair is not treated as a clean leverage comparison",()=>{
  const usd=SCREENING.find(x=>x.ticker==="USD")!,soxl=SCREENING.find(x=>x.ticker==="SOXL")!;
  assert.notEqual(usd.underlying,soxl.underlying);
  assert.equal(usd.researchPhase,"QUEUE");
  assert.equal(soxl.researchPhase,"QUEUE");
});

test("Inverse products remain outside Production long universe",()=>{
  assert.ok(EXCLUDED.some(x=>x.ticker==="Inverse leveraged ETFs"));
});
