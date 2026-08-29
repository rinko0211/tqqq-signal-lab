import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/* Audit 10 final meta-oracle.
 * This checker audits the assurance graph itself. It does not import product
 * decision/calendar/ledger helpers. Synthetic mutations prove that the checker
 * fails when required evidence, registration, symmetry, traceability, or the
 * RESEARCH authority baseline is deliberately corrupted.
 */

const MANIFEST_PATH="research/audit-10-coverage-manifest-v1.json";
const manifest=JSON.parse(fs.readFileSync(MANIFEST_PATH,"utf8"));
const pad=n=>String(n).padStart(2,"0");
const EXPECTED={
  invariants:Array.from({length:18},(_,i)=>`I-${pad(i+1)}`),
  faultClasses:Array.from({length:16},(_,i)=>`FC-${pad(i+1)}`),
  discontinuities:Array.from({length:22},(_,i)=>`D${pad(i+1)}`),
  materialFindings:[...Array.from({length:7},(_,i)=>`A7-M${pad(i+1)}`),...Array.from({length:10},(_,i)=>`A8-M${pad(i+1)}`),...Array.from({length:3},(_,i)=>`A9-M${pad(i+1)}`),...Array.from({length:3},(_,i)=>`A10-M${pad(i+1)}`)],
};
const REQUIRED_REGISTRATIONS=[
  "tests/audit7-state-space.test.ts","tests/audit7-authority-bundle.test.ts","tests/audit7-ledger-integrity.test.ts","tests/audit7-interactions.test.ts","tests/audit7-corporate-action-interactions.test.ts","tests/audit7-episode-annual-review.test.ts","tests/audit7-boundary-closure.test.ts",
  "tests/audit8-independent-blackbox.test.ts","tests/audit8-wave2-blackbox.test.ts","tests/audit8-m10-production-authority-chronology.test.ts","tests/audit8-ui-differential.test.ts","tests/audit8-ledger-evidence-blackbox.test.ts","tests/audit8-pwa-cache-differential.test.ts",
  "tests/audit9-wave1-temporal-chaos.test.ts","tests/audit9-wave2-persistence-chaos.test.ts","tests/audit9-wave3-integrated-chaos.test.ts",
  "tests/audit10-m01-ledger-generation-chronology.test.ts","tests/audit10-wave2-independence-symmetry.test.mjs","tests/audit10-coverage-closure.test.mjs",
];
const SYMMETRY={
  "forward-phase5-completeness":["Forward","Phase5"],
  "append-only-generation-chronology":["Forward","Phase5","Lifecycle","ProductionHealth"],
  "review-causal-chronology":["Lifecycle","ProductionHealth"],
  "current-provenance":["Lifecycle","ProductionHealth","Approval"],
  "action-authority":["Product","UI","Cache","Temporal"],
  "persistence-deployment":["Persistence","SourceHead","Deployment","Recovery"],
};
const EXPECTED_AUDIT_MECHANISMS={Audit7:"audit7-whitebox",Audit8:"audit8-blackbox",Audit9:"audit9-temporal",Audit10:"audit10-meta"};
const clone=x=>structuredClone(x);
const sorted=x=>[...x].sort();
const same=(a,b)=>JSON.stringify(sorted(a))===JSON.stringify(sorted(b));

function sectionFor(id,text){
  const start=text.indexOf(id);if(start<0)return"";
  const tail=text.slice(start+id.length),next=tail.search(/\n#{1,2}\s+A\d+-M\d+/);
  return text.slice(start,next<0?text.length:start+id.length+next);
}
function realContext(){
  const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
  return{
    core:pkg.scripts?.["test:core"]??"",
    ops:pkg.scripts?.["test:ops"]??"",
    exists:p=>fs.existsSync(p),
    read:p=>fs.readFileSync(p,"utf8"),
    production:Object.fromEntries(manifest.productionBaseline.paths.map(p=>[p,JSON.parse(fs.readFileSync(p,"utf8"))])),
  };
}
function overlay(base,{core,ops,texts={},missing=[],production={}}={}){
  return{
    core:core??base.core,ops:ops??base.ops,
    exists:p=>missing.includes(p)?false:base.exists(p),
    read:p=>Object.prototype.hasOwnProperty.call(texts,p)?texts[p]:base.read(p),
    production:{...base.production,...production},
  };
}
function validate(m,ctx){
  const errors=[];const err=(code,msg)=>errors.push(`${code}: ${msg}`);
  if(m.schemaVersion!==1)err("MTA-01","manifest schemaVersion must be 1");
  for(const [key,expected] of Object.entries(EXPECTED)){
    if(!same(m.expectedIds?.[key]??[],expected))err("MTA-01",`${key} inventory is not exact`);
  }
  for(const [id,edges] of Object.entries(m.invariants??{})){
    if(!EXPECTED.invariants.includes(id))err("MTA-01",`unexpected invariant ${id}`);
    if(!Array.isArray(edges)||edges.length===0)err("MTA-01",`${id} has no executable evidence`);
    for(const e of edges??[])if(!ctx.exists(e.path))err("MTA-01",`${id} evidence missing ${e.path}`);
  }
  for(const id of EXPECTED.invariants)if(!(id in (m.invariants??{})))err("MTA-01",`${id} absent from invariant graph`);

  for(const id of EXPECTED.faultClasses){
    const row=m.faultClasses?.[id];if(!row){err("MTA-02",`${id} absent from fault graph`);continue}
    const edges=row.evidence??[];if(!edges.length)err("MTA-02",`${id} has no negative/fail-closed evidence`);
    if(!edges.some(e=>e.kind==="negative"||e.kind==="recovery"))err("MTA-02",`${id} lacks negative/recovery semantics`);
    for(const e of edges)if(!ctx.exists(e.path))err("MTA-02",`${id} evidence missing ${e.path}`);
    if(row.diversityRequired&&new Set(edges.map(e=>e.mechanism)).size<2)err("MTA-02",`${id} evidence is only correlated duplicate mechanism`);
  }
  for(const id of Object.keys(m.faultClasses??{}))if(!EXPECTED.faultClasses.includes(id))err("MTA-02",`unexpected fault class ${id}`);

  for(const id of EXPECTED.discontinuities){
    const row=m.discontinuities?.[id];if(!row){err("MTA-03",`${id} absent from discontinuity graph`);continue}
    const edges=row.evidence??[];if(!edges.length)err("MTA-03",`${id} has no executable evidence`);
    for(const e of edges)if(!ctx.exists(e.path))err("MTA-03",`${id} evidence missing ${e.path}`);
    if(row.highRisk&&new Set(edges.map(e=>e.mechanism)).size<2)err("MTA-03",`${id} high-risk coverage lacks independent mechanisms`);
  }
  for(const id of Object.keys(m.discontinuities??{}))if(!EXPECTED.discontinuities.includes(id))err("MTA-03",`unexpected discontinuity ${id}`);

  if(!same(Object.keys(m.findings??{}),EXPECTED.materialFindings))err("MTA-04","material finding registry is incomplete or contains unknown IDs");
  for(const id of EXPECTED.materialFindings){
    const row=m.findings?.[id];if(!row)continue;
    if(!ctx.exists(row.file)){err("MTA-04",`${id} finding file missing ${row.file}`);continue}
    const section=sectionFor(id,ctx.read(row.file));
    if(!section)err("MTA-04",`${id} marker absent from finding evidence`);
    if(!/MATERIAL/i.test(section))err("MTA-04",`${id} material classification absent`);
    for(const f of ["F1","F2","F3","F4","F5"])if(!new RegExp(`\\b${f}\\b`).test(section))err("MTA-07",`${id} missing ${f}`);
    if(!Array.isArray(row.regressions)||!row.regressions.length)err("MTA-04",`${id} has no permanent regression edge`);
    for(const p of row.regressions??[]){
      if(!ctx.exists(p))err("MTA-04",`${id} regression missing ${p}`);
      if(!ctx.core.includes(p)||!ctx.ops.includes(p))err("MTA-05",`${id} regression not permanent in core+ops: ${p}`);
    }
  }

  if(!same(m.requiredRegistrations??[],REQUIRED_REGISTRATIONS))err("MTA-05","required registration inventory is not exact");
  for(const p of REQUIRED_REGISTRATIONS){
    if(!ctx.exists(p))err("MTA-05",`required test file missing ${p}`);
    if(!ctx.core.includes(p))err("MTA-06",`required test removed from test:core ${p}`);
    if(!ctx.ops.includes(p))err("MTA-06",`required test removed from test:ops ${p}`);
  }

  for(const [name,surfaces] of Object.entries(SYMMETRY)){
    const row=m.symmetryEdges?.[name];if(!row){err("MTA-08",`symmetry edge absent ${name}`);continue}
    if(!same(row.requiredSurfaces??[],surfaces))err("MTA-08",`${name} required-surface declaration changed`);
    const observed=new Set((row.evidence??[]).map(e=>e.surface));
    for(const s of surfaces)if(!observed.has(s))err("MTA-08",`${name} lacks ${s} evidence`);
    for(const e of row.evidence??[])if(!ctx.exists(e.path))err("MTA-08",`${name} evidence missing ${e.path}`);
  }

  for(const [audit,mechanism] of Object.entries(EXPECTED_AUDIT_MECHANISMS)){
    const row=m.auditMechanismEvidence?.[audit];if(row?.mechanism!==mechanism)err("MTA-14",`${audit} discovery mechanism changed or missing`);
    if(!row?.document||!ctx.exists(row.document))err("MTA-14",`${audit} mechanism evidence document missing`);
  }
  if(new Set(Object.values(EXPECTED_AUDIT_MECHANISMS)).size!==4)err("MTA-14","audit mechanisms are not distinct");

  for(const p of m.productionBaseline?.paths??[]){
    const actual=ctx.production[p];if(!actual){err("MTA-13",`Production baseline unavailable ${p}`);continue}
    for(const [k,v] of Object.entries(m.productionBaseline.expected??{}))if(actual[k]!==v)err("MTA-13",`${p} Production baseline ${k}=${JSON.stringify(actual[k])} expected ${JSON.stringify(v)}`);
  }
  if(!String(m.separateCertificationPrerequisites?.unattendedSoak??"").includes("10 consecutive NYSE sessions"))err("MTA-12","unattended soak is not explicit and separate");
  if(!String(m.separateCertificationPrerequisites?.cleanStreakAfterAudit10??"").includes("0/2"))err("MTA-10","Audit10 NOT-CLEAN accounting is not explicit");
  return errors;
}

const base=realContext();

test("A10 closure MTA-01..15: live assurance manifest closes without gaps",()=>{
  assert.deepEqual(validate(manifest,base),[]);
});

test("A10 closure MTA-16: checker detects removal from core",()=>{
  const p="tests/audit9-wave3-integrated-chaos.test.ts",ctx=overlay(base,{core:base.core.replace(p,"")});
  assert.ok(validate(manifest,ctx).some(x=>x.includes("MTA-06")&&x.includes(p)));
});

test("A10 closure MTA-16: checker detects removal from ops",()=>{
  const p="tests/audit9-wave3-integrated-chaos.test.ts",ctx=overlay(base,{ops:base.ops.replace(p,"")});
  assert.ok(validate(manifest,ctx).some(x=>x.includes("MTA-06")&&x.includes(p)));
});

test("A10 closure MTA-16: checker detects omitted material finding",()=>{
  const m=clone(manifest);delete m.findings["A10-M03"];
  assert.ok(validate(m,base).some(x=>x.includes("MTA-04")));
});

test("A10 closure MTA-16: checker detects incomplete F1-F5",()=>{
  const p=manifest.findings["A10-M03"].file,text=base.read(p).replace(/## F5[\s\S]*?(?=\n## |$)/,"## Next-audit mutation\nremoved marker\n");
  const ctx=overlay(base,{texts:{[p]:text}});
  assert.ok(validate(manifest,ctx).some(x=>x.includes("A10-M03 missing F5")));
});

test("A10 closure MTA-16: checker detects D-row without executable evidence",()=>{
  const m=clone(manifest);m.discontinuities.D01.evidence=[];
  assert.ok(validate(m,base).some(x=>x.includes("D01 has no executable evidence")));
});

test("A10 closure MTA-16: checker detects fault class covered only by correlated duplicate mechanism",()=>{
  const m=clone(manifest);m.faultClasses["FC-01"].evidence=m.faultClasses["FC-01"].evidence.map(e=>({...e,mechanism:"audit7-whitebox"}));
  assert.ok(validate(m,base).some(x=>x.includes("FC-01 evidence is only correlated")));
});

test("A10 closure MTA-16: checker detects Forward-only completeness symmetry",()=>{
  const m=clone(manifest);m.symmetryEdges["forward-phase5-completeness"].evidence=m.symmetryEdges["forward-phase5-completeness"].evidence.filter(e=>e.surface!=="Phase5");
  assert.ok(validate(m,base).some(x=>x.includes("forward-phase5-completeness lacks Phase5")));
});

test("A10 closure MTA-16: checker detects chronology present on only a subset of append-only ledgers",()=>{
  const m=clone(manifest);m.symmetryEdges["append-only-generation-chronology"].evidence=m.symmetryEdges["append-only-generation-chronology"].evidence.filter(e=>e.surface!=="Lifecycle");
  assert.ok(validate(m,base).some(x=>x.includes("append-only-generation-chronology lacks Lifecycle")));
});

test("A10 closure MTA-16: checker detects Wave3 unregistration",()=>{
  const p="tests/audit9-wave3-integrated-chaos.test.ts",ctx=overlay(base,{core:base.core.replace(p,""),ops:base.ops.replace(p,"")});
  const errors=validate(manifest,ctx);assert.ok(errors.some(x=>x.includes(p)&&x.includes("test:core")));assert.ok(errors.some(x=>x.includes(p)&&x.includes("test:ops")));
});

test("A10 closure MTA-16: checker detects Production authority moved away from RESEARCH",()=>{
  const p=manifest.productionBaseline.paths[0],production={...base.production[p],mode:"PRODUCTION",approvedByHuman:true,selectedTicker:"TQQQ",selectedStrategy:"Volatility Shield 13%",strategyVersion:"VS13-v1.0"};
  const ctx=overlay(base,{production:{[p]:production}});
  assert.ok(validate(manifest,ctx).some(x=>x.includes("MTA-13")&&x.includes(p)));
});
