import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page=readFileSync("app/page.tsx","utf8");
const summary=readFileSync("app/unified-forward-board.tsx","utf8");
const style=readFileSync("app/globals.css","utf8");
const gold=readFileSync("app/gold-forward-ui.tsx","utf8");
const p5=readFileSync("app/phase5-ui.tsx","utf8");

test("top navigation has exactly five coherent user-entry sections, not the previous isolated 21 tabs",()=>{
 const nav=page.match(/const MAIN_NAV = \[([\s\S]*?)\] as const;/);
 assert.ok(nav);
 const ids=[...nav[1].matchAll(/\["([^"]+)","[^"]+"\]/g)].map(x=>x[1]);
 assert.deepEqual(ids,["signal","dashboard","forward","researchhub","managehub"]);
 assert.match(page,/\{MAIN_NAV\.map\(/);
 assert.doesNotMatch(page,/\{TABS\.map\(/);
});
test("Native, ETF research and robustness remain accessible through ONE detail menu",()=>{
 assert.match(page,/RESEARCH_MENU:Tab\[\]=\["compare","walk","year","trades","robust","research","deep","universe","native"\]/);
 assert.match(page,/<select id="detailScreenSelector"/);
 assert.match(page,/tab==="native"/);
 assert.match(page,/tab === "universe"/);
 assert.match(page,/tab === "deep"/);
});
test("TQQQ primary action is not reimplemented by the research overview",()=>{
 assert.match(page,/primaryAction=derivePrimaryAction\(/);
 assert.match(page,/<SignalView/);
 assert.doesNotMatch(summary,/derivePrimaryAction|broker\.|placeOrder|submitOrder|executeTrade/);
});
test("same nine-series model scorecard appears in dashboard AND Forward",()=>{
 assert.equal((page.match(/<UnifiedForwardBoard tqqq=\{forwardLedger\} phase5=\{phase5Ledger\}/g)||[]).length,2);
 assert.match(summary,/summarizeForward\(tqqq\)/);
 assert.match(summary,/summarizePhase5\(phase5\)/);
 assert.match(summary,/TQQQ-Gold50-Research-v0\.1/);
 assert.match(summary,/rows\.length===9/);
 assert.match(summary,/tqqq\?\.freezes\.length===5/);
 assert.match(summary,/phase5\?\.freezes\.length===3/);
});
test("Gold50 Model return/DD and model execution are explicitly unavailable, not zero performance",()=>{
 assert.match(summary,/modelReturn:null,maxDd:null,modelOrders:null/);
 assert.match(summary,/fmtPct\(r\.modelReturn\)/);
 assert.match(summary,/fmtPct\(r\.maxDd\)/);
 assert.match(summary,/r\.modelOrders\?\?"—"/);
 assert.match(summary,/parseGoldForwardEvidence\(/);
 assert.match(summary,/Gold50公開台帳は現在「確認要」/);
});
test("long-form assets and Native/Gold50 remain independently inspectable behind one Forward screen",()=>{
 assert.match(page,/tab==="forward"/);
 assert.match(page,/forwardDetails/);
 assert.match(page,/TQQQ・比較指標/);
 assert.match(page,/他ETF・Native Forward/);
 assert.match(page,/Gold50詳細/);
 assert.match(page,/<ForwardView ledger=\{forwardLedger\}/);
 assert.match(page,/<Phase5ForwardPanel productionForward=\{forwardLedger\}/);
 assert.match(page,/<GoldIntegratedForward compact/);
 assert.match(gold,/非観測期間/);
 assert.match(p5,/FORWARD/);
});
test("operational / governance / data management still accessible",()=>{
 assert.match(page,/MANAGEMENT_MENU:Tab\[\]=\["lifecycle","production","paper","status","data","guide","roadmap","glossary","spec"\]/);
 assert.match(page,/tab==="managehub"/);
 assert.match(page,/<LifecycleActionCenter/);
 assert.match(page,/tab === "production"/);
 assert.match(page,/tab === "paper"/);
 assert.match(page,/tab === "status"/);
});
test("compact five-section nav and matrix remain responsive",()=>{
 assert.match(style,/COHORT_FIRST_UNIFIED_NAV/);
 assert.match(style,/\.mainNav/);
 assert.match(style,/\.unifiedTable/);
 assert.match(style,/@media\(max-width:750px\)/);
});
