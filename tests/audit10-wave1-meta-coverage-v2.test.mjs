import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {assertForwardLedgerInternalIntegrity} from "../lib/forward.ts";
import {assertPhase5LedgerInternalIntegrity} from "../lib/phase5-forward.ts";
import {assertLifecycleLedgerInternalIntegrity,emptyLifecycleLedger} from "../lib/lifecycle-review.ts";
import {assertProductionHealthLedgerInternalIntegrity,emptyProductionHealthLedger} from "../lib/production-health-review.ts";

/* Audit 10 Wave 1 v2 — evidence-graph / meta-coverage discovery.
 * Individual finding files are treated as the evidence object itself; grouped
 * finding registers are sectioned by their explicit A?-M?? marker. This avoids
 * confusing title-format differences with missing assurance evidence.
 */

const read=(p)=>fs.readFileSync(p,"utf8");
const exists=(p)=>fs.existsSync(p);
const protocol=read("research/multi-audit-assurance-protocol-v1.0-2026-08-27.md");
const audit9Charter=read("research/audit-9-charter-2026-08-29.md");
const audit10Charter=read("research/audit-10-charter-2026-08-29.md");
const pkg=JSON.parse(read("package.json"));
const core=pkg.scripts["test:core"]??"",ops=pkg.scripts["test:ops"]??"";
const expected=(prefix,n,hyphen=true)=>Array.from({length:n},(_,i)=>`${prefix}${hyphen?"-":""}${String(i+1).padStart(2,"0")}`);
const ids=(re,text)=>[...new Set([...text.matchAll(re)].map(m=>m[0]))].sort();

function groupedSection(path,id){
  const text=read(path),start=text.indexOf(id);assert.ok(start>=0,`${id} missing from grouped register ${path}`);
  const tail=text.slice(start+id.length),next=tail.search(/\n#{1,2}\s+A\d+-M\d+/);
  return text.slice(start,next<0?text.length:start+id.length+next);
}
function individual(path){assert.ok(exists(path),`finding evidence missing: ${path}`);return read(path)}
function assertF1F5(id,text){
  assert.match(text,/MATERIAL/i,`${id}: material classification absent`);
  for(const f of ["F1","F2","F3","F4","F5"])assert.match(text,new RegExp(`\\b${f}\\b`),`${id}: ${f} absent`);
}

const evidence=[
  ["A7-M01",()=>individual("research/audit-7-finding-001-production-authority-boundary-2026-08-27.md")],
  ["A7-M02",()=>groupedSection("research/audit-7-live-findings-2026-08-27.md","A7-M02")],
  ["A7-M03",()=>groupedSection("research/audit-7-live-findings-2026-08-27.md","A7-M03")],
  ["A7-M04",()=>individual("research/audit-7-finding-004-append-only-internal-integrity-2026-08-27.md")],
  ["A7-M05",()=>individual("research/audit-7-finding-005-multi-quarter-health-recovery-2026-08-27.md")],
  ["A7-M06",()=>individual("research/audit-7-finding-006-forward-generation-skew-2026-08-27.md")],
  ["A7-M07",()=>individual("research/audit-7-finding-007-append-only-chronology-integrity-2026-08-27.md")],
  ["A8-M01",()=>groupedSection("research/audit-8-findings-wave1-2026-08-27.md","A8-M01")],
  ["A8-M02",()=>groupedSection("research/audit-8-findings-wave1-2026-08-27.md","A8-M02")],
  ["A8-M03",()=>groupedSection("research/audit-8-findings-wave1-2026-08-27.md","A8-M03")],
  ["A8-M04",()=>groupedSection("research/audit-8-findings-wave2-2026-08-27.md","A8-M04")],
  ["A8-M05",()=>groupedSection("research/audit-8-findings-wave2-2026-08-27.md","A8-M05")],
  ["A8-M06",()=>groupedSection("research/audit-8-findings-wave2-2026-08-27.md","A8-M06")],
  ["A8-M07",()=>groupedSection("research/audit-8-findings-wave2-2026-08-27.md","A8-M07")],
  ["A8-M08",()=>groupedSection("research/audit-8-findings-wave2-2026-08-27.md","A8-M08")],
  ["A8-M09",()=>groupedSection("research/audit-8-findings-wave2-2026-08-27.md","A8-M09")],
  ["A8-M10",()=>individual("research/audit-8-finding-010-production-authority-chronology-2026-08-28.md")],
  ["A9-M01",()=>groupedSection("research/audit-9-findings-wave2-2026-08-29.md","A9-M01")],
  ["A9-M02",()=>groupedSection("research/audit-9-findings-wave2-2026-08-29.md","A9-M02")],
  ["A9-M03",()=>individual("research/audit-9-finding-003-health-recurrence-after-late-recovery-2026-08-29.md")],
  ["A10-M01",()=>individual("research/audit-10-finding-001-ledger-generation-chronology-symmetry-2026-08-29.md")],
  ["A10-M02",()=>individual("research/audit-10-finding-002-review-evidence-causal-chronology-2026-08-29.md")],
  ["A10-M03",()=>individual("research/audit-10-finding-003-current-state-evidence-provenance-2026-08-29.md")],
];

const permanentFamilies=[
  "tests/audit7-state-space.test.ts","tests/audit7-authority-bundle.test.ts","tests/audit7-ledger-integrity.test.ts","tests/audit7-interactions.test.ts","tests/audit7-corporate-action-interactions.test.ts","tests/audit7-episode-annual-review.test.ts","tests/audit7-boundary-closure.test.ts",
  "tests/audit8-independent-blackbox.test.ts","tests/audit8-wave2-blackbox.test.ts","tests/audit8-m10-production-authority-chronology.test.ts","tests/audit8-ui-differential.test.ts","tests/audit8-ledger-evidence-blackbox.test.ts","tests/audit8-pwa-cache-differential.test.ts",
  "tests/audit9-wave1-temporal-chaos.test.ts","tests/audit9-wave2-persistence-chaos.test.ts","tests/audit9-wave3-integrated-chaos.test.ts",
  "tests/audit10-m01-ledger-generation-chronology.test.ts","tests/audit10-wave2-independence-symmetry.test.mjs","tests/audit10-coverage-closure.test.mjs",
];

test("A10 Wave1v2 MTA-01: frozen assurance inventory IDs are exact",()=>{
  assert.deepEqual(ids(/\bI-\d{2}\b/g,protocol),expected("I",18));
  assert.deepEqual(ids(/\bFC-\d{2}\b/g,protocol),expected("FC",16));
  assert.deepEqual(ids(/\bD\d{2}\b/g,protocol),expected("D",22,false));
});

test("A10 Wave1v2 MTA-02/MTA-09: all A7-A10 material findings retain F1-F5 evidence",()=>{
  assert.equal(evidence.length,23,"expected A7 7 + A8 10 + A9 3 + A10 3 findings");
  for(const [id,get] of evidence)assertF1F5(id,get());
});

test("A10 Wave1v2 MTA-06: F5 inheritance is explicit from Audit8 to Audit9 and Audit9 to Audit10",()=>{
  for(let i=1;i<=10;i++){const id=`A8-M${String(i).padStart(2,"0")}`;assert.ok(audit9Charter.includes(id),`${id} missing from Audit9 inherited mutation charter`)}
  assert.match(audit10Charter,/A9-M01(?:–|-)M03|A9-M01[\s\S]*A9-M02[\s\S]*A9-M03/,"A9-M01–M03 inherited finding family missing from Audit10 charter");
});

test("A10 Wave1v2 MTA-07: permanent finding/audit families are in core and ops",()=>{
  for(const file of permanentFamilies){assert.ok(exists(file),`missing permanent regression ${file}`);assert.ok(core.includes(file),`${file} missing from test:core`);assert.ok(ops.includes(file),`${file} missing from test:ops`)}
});

test("A10 Wave1v2 MTA-04/MTA-05: discovery mechanisms and expected-value oracles remain independent",()=>{
  const p7=read("research/audit-7-close-2026-08-27.md"),p8=read("research/audit-8-charter-2026-08-27.md"),p9=audit9Charter,p10=audit10Charter;
  assert.match(p7,/white-box|state-space/i);assert.match(p8,/black-box|adversarial|differential/i);assert.match(p9,/500 market sessions|temporal \/ recovery \/ chaos|sequence/i);assert.match(p10,/meta-audit|coverage closure/i);
  assert.match(protocol,/another code-level regression pass/i);
  const a8=["tests/audit8-independent-blackbox.test.ts","tests/audit8-wave2-blackbox.test.ts","tests/audit8-m10-production-authority-chronology.test.ts"].map(read).join("\n");
  const a8Imports=a8.split("\n").filter(x=>x.startsWith("import ")).join("\n");
  for(const forbidden of ["market-calendar","operational-authority","execution-integrity","lifecycle-review","production-health-review"])assert.doesNotMatch(a8Imports,new RegExp(forbidden),`Audit8 oracle imports ${forbidden}`);
  const a9=["tests/audit9-wave1-temporal-chaos.test.ts","tests/audit9-wave2-persistence-chaos.test.ts","tests/audit9-wave3-integrated-chaos.test.ts"].map(read).join("\n");
  const a9Imports=a9.split("\n").filter(x=>x.startsWith("import ")).join("\n");assert.doesNotMatch(a9Imports,/market-calendar/,"Audit9 expected sequence must not import product market calendar");
});

test("A10 Wave1v2 MTA-08/A9-M01: Forward and Phase5 represent completeness explicitly without fabricating Phase5 source gaps",()=>{
  const forward=read("lib/forward.ts"),phase5=read("lib/phase5-forward.ts");
  assert.match(forward,/incomplete session history/);
  assert.match(phase5,/coverageGaps/);assert.match(phase5,/SOURCE_DATA_MISSING/);assert.match(phase5,/incomplete coverage/);
  assert.match(phase5,/duplicate\/conflicting coverage/);
});

test("A10 Wave1v2 MTA-08/A9-M02/A10-M01: all four append-only ledgers reject nested evidence after artifact generation",()=>{
  const forward=JSON.parse(read("github-pages/public/data/forward-ledger.json"));forward.records[0].recordedAt="2030-01-02T21:00:00.000Z";forward.updatedAt="2026-08-29T00:00:00.000Z";assert.throws(()=>assertForwardLedgerInternalIntegrity(forward),/chronology|generation/i);
  const phase5=JSON.parse(read("github-pages/public/data/phase-5-forward-ledger.json"));phase5.records[0].recordedAt="2030-01-02T21:00:00.000Z";phase5.updatedAt="2026-08-29T00:00:00.000Z";assert.throws(()=>assertPhase5LedgerInternalIntegrity(phase5),/chronology|generation/i);
  const lifecycle=emptyLifecycleLedger({interim:"2027-02-25",formal:"2027-08-25",stronger:"2028-08-25"},"2026-08-29T00:00:00.000Z");lifecycle.events.push({key:"INTERIM|2027-02-25",stage:"INTERIM",reviewDate:"2027-02-25",recordedAt:"2030-01-02T21:00:00.000Z",systemDecision:"fixture",userAction:"NONE",candidateReviews:[]});assert.throws(()=>assertLifecycleLedgerInternalIntegrity(lifecycle),/chronology|generation/i);
  const health=emptyProductionHealthLedger("2026-08-29T00:00:00.000Z");health.events.push({key:"VS13-v1.0|2027-11-25",dueDate:"2027-11-25",recordedAt:"2030-01-02T21:00:00.000Z",version:"VS13-v1.0",state:"Healthy",timing:"ON_TIME",reasons:["fixture"]});assert.throws(()=>assertProductionHealthLedgerInternalIntegrity(health),/chronology|generation/i);
});

test("A10 Wave1v2 MTA-08/A9-M03: late-review evidence label is not reused as an indefinite scheduler control flag",()=>{
  const health=read("lib/production-health-review.ts");
  assert.match(health,/nyseReviewBoundaryReached\(due,last\.recordedAt\)/,"late collapse must be bounded by recovery observation time");
  assert.doesNotMatch(health,/if\(last\?\.timing===\"LATE_CURRENT_STATE_ONLY\"\)while\(nyseReviewBoundaryReached\(due,now\)\)/,"historical late label must not suppress all future recurrence");
  for(const file of ["tests/audit9-wave2-persistence-chaos.test.ts","tests/audit9-wave3-integrated-chaos.test.ts"]){assert.ok(core.includes(file)&&ops.includes(file),`${file} recurrence coverage not permanent`)}
});

test("A10 Wave1v2 MTA-10/MTA-12: accounting and unattended soak remain separate",()=>{
  const a8=read("research/audit-8-close-2026-08-29.md"),a9=read("research/audit-9-close-2026-08-29.md");
  assert.match(a8,/PERMANENTLY NOT CLEAN|permanently NOT CLEAN/i);assert.match(a9,/PERMANENTLY NOT CLEAN/i);assert.match(a9,/0\/2/);assert.match(audit10Charter,/0-of-2 CLEAN/);assert.match(audit10Charter,/1\/2/);assert.match(audit10Charter,/10 consecutive NYSE-session|unattended soak/i);
});
