import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assertForwardLedgerInternalIntegrity,
} from "../lib/forward.ts";
import {
  assertPhase5LedgerInternalIntegrity,
} from "../lib/phase5-forward.ts";
import {
  assertLifecycleLedgerInternalIntegrity,
  emptyLifecycleLedger,
} from "../lib/lifecycle-review.ts";
import {
  assertProductionHealthLedgerInternalIntegrity,
  emptyProductionHealthLedger,
} from "../lib/production-health-review.ts";

/*
 * Audit 10 Wave 1 — meta-audit / coverage closure discovery.
 *
 * Primary expected values come from the frozen assurance protocol and persisted
 * finding records. This is not an action-oracle regression pass. Product ledger
 * validators are invoked only in the symmetry probe required by inherited
 * A9-M02, using one identical artifact-generation mutation across ledgers.
 */

const read=(p)=>fs.readFileSync(p,"utf8");
const protocol=read("research/multi-audit-assurance-protocol-v1.0-2026-08-27.md");
const packageJson=JSON.parse(read("package.json"));
const core=packageJson.scripts["test:core"]??"";
const ops=packageJson.scripts["test:ops"]??"";

const expected=(prefix,n,hyphen=true)=>Array.from({length:n},(_,i)=>`${prefix}${hyphen?"-":""}${String(i+1).padStart(2,"0")}`);
const ids=(re,text)=>[...new Set([...text.matchAll(re)].map(m=>m[0]))].sort();

function findingSection(path,id){
  const text=read(path),start=text.indexOf(id);
  assert.ok(start>=0,`${id} missing from ${path}`);
  const tail=text.slice(start+id.length);
  const next=tail.search(/\n#{1,2}\s+A\d+-M\d+/);
  return text.slice(start,next<0?text.length:start+id.length+next);
}

const findings=[
  ["A7-M01","research/audit-7-finding-001-production-authority-boundary-2026-08-27.md"],
  ["A7-M02","research/audit-7-live-findings-2026-08-27.md"],
  ["A7-M03","research/audit-7-live-findings-2026-08-27.md"],
  ["A7-M04","research/audit-7-finding-004-append-only-internal-integrity-2026-08-27.md"],
  ["A7-M05","research/audit-7-finding-005-multi-quarter-health-recovery-2026-08-27.md"],
  ["A7-M06","research/audit-7-finding-006-forward-generation-skew-2026-08-27.md"],
  ["A7-M07","research/audit-7-finding-007-append-only-chronology-integrity-2026-08-27.md"],
  ["A8-M01","research/audit-8-findings-wave1-2026-08-27.md"],
  ["A8-M02","research/audit-8-findings-wave1-2026-08-27.md"],
  ["A8-M03","research/audit-8-findings-wave1-2026-08-27.md"],
  ["A8-M04","research/audit-8-findings-wave2-2026-08-27.md"],
  ["A8-M05","research/audit-8-findings-wave2-2026-08-27.md"],
  ["A8-M06","research/audit-8-findings-wave2-2026-08-27.md"],
  ["A8-M07","research/audit-8-findings-wave2-2026-08-27.md"],
  ["A8-M08","research/audit-8-findings-wave2-2026-08-27.md"],
  ["A8-M09","research/audit-8-findings-wave2-2026-08-27.md"],
  ["A8-M10","research/audit-8-finding-010-production-authority-chronology-2026-08-28.md"],
  ["A9-M01","research/audit-9-findings-wave2-2026-08-29.md"],
  ["A9-M02","research/audit-9-findings-wave2-2026-08-29.md"],
  ["A9-M03","research/audit-9-finding-003-health-recurrence-after-late-recovery-2026-08-29.md"],
];

const permanentFamilies=[
  "tests/audit7-state-space.test.ts",
  "tests/audit7-authority-bundle.test.ts",
  "tests/audit7-ledger-integrity.test.ts",
  "tests/audit7-interactions.test.ts",
  "tests/audit7-corporate-action-interactions.test.ts",
  "tests/audit7-episode-annual-review.test.ts",
  "tests/audit7-boundary-closure.test.ts",
  "tests/audit8-independent-blackbox.test.ts",
  "tests/audit8-wave2-blackbox.test.ts",
  "tests/audit8-m10-production-authority-chronology.test.ts",
  "tests/audit8-ui-differential.test.ts",
  "tests/audit8-ledger-evidence-blackbox.test.ts",
  "tests/audit8-pwa-cache-differential.test.ts",
  "tests/audit9-wave1-temporal-chaos.test.ts",
  "tests/audit9-wave2-persistence-chaos.test.ts",
  "tests/audit9-wave3-integrated-chaos.test.ts",
];

test("A10 Wave1 MTA-01: frozen invariant/fault/discontinuity inventory is complete",()=>{
  assert.deepEqual(ids(/\bI-\d{2}\b/g,protocol),expected("I",18));
  assert.deepEqual(ids(/\bFC-\d{2}\b/g,protocol),expected("FC",16));
  assert.deepEqual(ids(/\bD\d{2}\b/g,protocol),expected("D",22,false));
});

test("A10 Wave1 MTA-02/MTA-09: every A7-A9 material finding has persisted F1-F5 traceability",()=>{
  assert.equal(findings.length,20,"expected 7 + 10 + 3 material findings");
  for(const [id,path] of findings){
    assert.ok(fs.existsSync(path),`${id} finding evidence file missing: ${path}`);
    const section=findingSection(path,id);
    assert.match(section,/MATERIAL/i,`${id} is not explicitly classified material`);
    for(const f of ["F1","F2","F3","F4","F5"])assert.match(section,new RegExp(`\\b${f}\\b`),`${id} missing ${f}`);
  }
});

test("A10 Wave1 MTA-07: permanent A7-A9 audit families are registered in both standard suites",()=>{
  for(const file of permanentFamilies){
    assert.ok(fs.existsSync(file),`permanent regression missing: ${file}`);
    assert.ok(core.includes(file),`${file} is not registered in test:core`);
    assert.ok(ops.includes(file),`${file} is not registered in test:ops`);
  }
});

test("A10 Wave1 MTA-04/MTA-05: prior audit mechanisms and oracle restrictions remain distinct",()=>{
  const p7=read("research/audit-7-close-2026-08-27.md"),p8=read("research/audit-8-charter-2026-08-27.md"),p9=read("research/audit-9-charter-2026-08-29.md"),p10=read("research/audit-10-charter-2026-08-29.md");
  assert.match(p7,/white-box|state-space/i);
  assert.match(p8,/black-box|adversarial|differential/i);
  assert.match(p9,/500 market sessions|temporal \/ recovery \/ chaos|sequence/i);
  assert.match(p10,/meta-audit|coverage closure/i);
  assert.match(protocol,/another code-level regression pass/i);

  const a8=["tests/audit8-independent-blackbox.test.ts","tests/audit8-wave2-blackbox.test.ts","tests/audit8-m10-production-authority-chronology.test.ts"].map(read).join("\n");
  const a8Imports=a8.split("\n").filter(x=>x.startsWith("import ")).join("\n");
  for(const forbidden of ["market-calendar","operational-authority","execution-integrity","lifecycle-review","production-health-review"])
    assert.doesNotMatch(a8Imports,new RegExp(forbidden),`Audit 8 expected-value oracle imports ${forbidden}`);

  const a9=["tests/audit9-wave1-temporal-chaos.test.ts","tests/audit9-wave2-persistence-chaos.test.ts","tests/audit9-wave3-integrated-chaos.test.ts"].map(read).join("\n");
  const a9Imports=a9.split("\n").filter(x=>x.startsWith("import ")).join("\n");
  assert.doesNotMatch(a9Imports,/market-calendar/,"Audit 9 sequence expectations must not import product market calendar");
});

test("A10 Wave1 MTA-10/MTA-12: NOT-CLEAN accounting and soak remain separate prerequisites",()=>{
  const a8=read("research/audit-8-close-2026-08-29.md"),a9=read("research/audit-9-close-2026-08-29.md"),a10=read("research/audit-10-charter-2026-08-29.md");
  assert.match(a8,/PERMANENTLY NOT CLEAN|permanently NOT CLEAN/i);
  assert.match(a9,/PERMANENTLY NOT CLEAN/i);
  assert.match(a9,/0\/2/);
  assert.match(a10,/0-of-2 CLEAN/);
  assert.match(a10,/1\/2 CLEAN/);
  assert.match(a10,/10 consecutive NYSE-session|unattended soak/i);
});

test("A10 Wave1 MTA-08 inherited A9-M02: append-only ledgers reject nested evidence later than artifact generation symmetrically",()=>{
  const forward=JSON.parse(read("github-pages/public/data/forward-ledger.json"));
  assert.ok(forward.records.length>0,"Forward fixture needs historical evidence");
  forward.records[0].recordedAt="2030-01-02T21:00:00.000Z";
  forward.updatedAt="2026-08-29T00:00:00.000Z";
  assert.throws(()=>assertForwardLedgerInternalIntegrity(forward),/chronology|generation/i,"Forward must reject future nested evidence");

  const phase5=JSON.parse(read("github-pages/public/data/phase-5-forward-ledger.json"));
  assert.ok(phase5.records.length>0,"Phase5 fixture needs historical evidence");
  phase5.records[0].recordedAt="2030-01-02T21:00:00.000Z";
  phase5.updatedAt="2026-08-29T00:00:00.000Z";
  assert.throws(()=>assertPhase5LedgerInternalIntegrity(phase5),/chronology|generation/i,"Phase5 must reject future nested evidence");

  const lifecycle=emptyLifecycleLedger({interim:"2027-02-25",formal:"2027-08-25",stronger:"2028-08-25"},"2026-08-29T00:00:00.000Z");
  lifecycle.events.push({key:"INTERIM|2027-02-25",stage:"INTERIM",reviewDate:"2027-02-25",recordedAt:"2030-01-02T21:00:00.000Z",systemDecision:"fixture",userAction:"NONE",candidateReviews:[]});
  assert.throws(()=>assertLifecycleLedgerInternalIntegrity(lifecycle),/chronology|generation/i,"Lifecycle must reject evidence later than its ledger generation");

  const health=emptyProductionHealthLedger("2026-08-29T00:00:00.000Z");
  health.events.push({key:"VS13-v1.0|2027-11-25",dueDate:"2027-11-25",recordedAt:"2030-01-02T21:00:00.000Z",version:"VS13-v1.0",state:"Healthy",timing:"ON_TIME",reasons:["fixture"]});
  assert.throws(()=>assertProductionHealthLedgerInternalIntegrity(health),/chronology|generation/i,"Production Health must reject evidence later than its ledger generation");
});
