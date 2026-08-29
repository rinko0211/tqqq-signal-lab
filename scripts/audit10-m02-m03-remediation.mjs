import fs from "node:fs";

function replaceOnce(path,from,to){
  const text=fs.readFileSync(path,"utf8");
  if(!text.includes(from))throw new Error(`Audit10 remediation anchor missing in ${path}`);
  if(text.indexOf(from)!==text.lastIndexOf(from))throw new Error(`Audit10 remediation anchor ambiguous in ${path}`);
  fs.writeFileSync(path,text.replace(from,to));
}

const lifecycle="lib/lifecycle-review.ts";
replaceOnce(
  lifecycle,
  'if(recordedAt>generation)throw Error(`Lifecycle integrity: event chronology exceeds ledger generation ${e.key}`);if(recordedAt<previousRecordedAt)',
  'if(marketDate(e.recordedAt)<e.reviewDate)throw Error(`Lifecycle integrity: review evidence predates claimed review date ${e.key}`);if(recordedAt>generation)throw Error(`Lifecycle integrity: event chronology exceeds ledger generation ${e.key}`);if(recordedAt<previousRecordedAt)'
);
replaceOnce(
  lifecycle,
  'previousRecordedAt=recordedAt;keys.add(e.key);}\n}',
  'previousRecordedAt=recordedAt;keys.add(e.key);}\n  const cycleDate=ledger.current.reviewCycleDate??null,cycle=cycleDate?ledger.events.filter(e=>e.reviewDate===cycleDate).at(-1):undefined;\n  if(cycleDate&&!cycle)throw Error("Lifecycle integrity: current review cycle lacks append-only event evidence");\n  const authorityCurrent=ledger.current.systemDecision==="PHASE6_HUMAN_DECISION_REQUIRED"||ledger.current.userAction==="RUN_PHASE6_HUMAN_REVIEW";\n  if(authorityCurrent){\n    if(!cycle||cycle.userAction!=="RUN_PHASE6_HUMAN_REVIEW")throw Error("Lifecycle integrity: human-review authority lacks matching cycle evidence");\n    const frozenSelectable=new Set(cycle.candidateReviews.filter(x=>x.promotionSelectable).map(x=>x.version));\n    const currentSelectable=ledger.current.candidateReviews.filter(x=>x.promotionSelectable).map(x=>x.version);\n    if(!currentSelectable.length||currentSelectable.some(v=>!frozenSelectable.has(v)))throw Error("Lifecycle integrity: current selectable authority is not backed by frozen cycle evidence");\n  }\n  if((ledger.current.reviewResolved||ledger.current.reviewResolvedAt)&&!cycle)throw Error("Lifecycle integrity: resolved review current lacks cycle evidence");\n}'
);
replaceOnce(
  lifecycle,
  'export function productionEligibleVersions(lifecycle:LifecycleLedger):string[]{if(lifecycle.current.systemDecision!=="PHASE6_HUMAN_DECISION_REQUIRED")return[];',
  'export function productionEligibleVersions(lifecycle:LifecycleLedger):string[]{assertLifecycleLedgerInternalIntegrity(lifecycle);if(lifecycle.current.systemDecision!=="PHASE6_HUMAN_DECISION_REQUIRED")return[];'
);

const health="lib/production-health-review.ts";
replaceOnce(
  health,
  'const recordedAt=Date.parse(e.recordedAt);if(recordedAt>generation)',
  'const recordedAt=Date.parse(e.recordedAt);if(marketDate(e.recordedAt)<e.dueDate)throw Error(`Production Health integrity: review evidence predates claimed due date ${e.key}`);if(recordedAt>generation)'
);
replaceOnce(
  health,
  'previousRecordedAt=recordedAt;keys.add(e.key);logical.add(id);}\n}',
  'previousRecordedAt=recordedAt;keys.add(e.key);logical.add(id);}\n  if(ledger.current.active&&!ledger.current.version)throw Error("Production Health integrity: active current requires version identity");\n  if(!ledger.current.active&&ledger.current.version!==null)throw Error("Production Health integrity: inactive current cannot carry active version identity");\n  if(ledger.current.lastReview!==null){\n    if(!isValidIsoMarketDate(ledger.current.lastReview))throw Error("Production Health integrity: current lastReview date is invalid");\n    const backed=ledger.current.active&&ledger.current.version?ledger.events.some(e=>e.version===ledger.current.version&&e.dueDate===ledger.current.lastReview):ledger.events.some(e=>e.dueDate===ledger.current.lastReview);\n    if(!backed)throw Error("Production Health integrity: current lastReview lacks append-only event evidence");\n  }\n}'
);

const approve="scripts/approve-production.ts";
replaceOnce(
  approve,
  'import{productionEligibleVersions,type LifecycleLedger}from"../lib/lifecycle-review.ts";',
  'import{assertLifecycleLedgerInternalIntegrity,productionEligibleVersions,type LifecycleLedger}from"../lib/lifecycle-review.ts";'
);
replaceOnce(
  approve,
  'try{runtimeStatus=JSON.parse(await readFile(new URL("status.json",root),"utf8"));phase5Status=JSON.parse(await readFile(new URL("phase-5-forward-status.json",root),"utf8"))}catch{throw Error("LIFECYCLE-006: authoritative upstream status is missing; refresh Daily/Phase5/Lifecycle before Production approval")}\n  if(!lifecycleReviewIsFresh(lifecycle))',
  'try{runtimeStatus=JSON.parse(await readFile(new URL("status.json",root),"utf8"));phase5Status=JSON.parse(await readFile(new URL("phase-5-forward-status.json",root),"utf8"))}catch{throw Error("LIFECYCLE-006: authoritative upstream status is missing; refresh Daily/Phase5/Lifecycle before Production approval")}\n  assertLifecycleLedgerInternalIntegrity(lifecycle);\n  if(!lifecycleReviewIsFresh(lifecycle))'
);

const wave2="tests/audit10-wave2-independence-symmetry.test.mjs";
replaceOnce(
  wave2,
  'assert.deepEqual(productionEligibleVersions(ledger),["VS13-v1.0"],"approval selector consumes forged current authority");',
  'assert.throws(()=>productionEligibleVersions(ledger),/current|history|review|evidence|coherence/i,"approval selector must fail closed on unsupported current authority");'
);
replaceOnce(
  wave2,
  'assert.doesNotMatch(approve,/assertLifecycleLedgerInternalIntegrity/);',
  'assert.ok(approve.includes("assertLifecycleLedgerInternalIntegrity(lifecycle)"),"Production approval must validate Lifecycle provenance before consuming current authority");'
);

// A10-M01 made nested event <= ledger generation mandatory. This older Audit 8
// fixture predates that invariant and had a 21:01 event inside a 21:00 artifact.
// Move only the synthetic artifact generation forward; event semantics are unchanged.
const a8="tests/audit8-ledger-evidence-blackbox.test.ts";
replaceOnce(a8,'updatedAt:"2028-04-10T21:00:00.000Z"','updatedAt:"2028-04-10T22:00:00.000Z"');

const pkgPath="package.json";
const pkg=JSON.parse(fs.readFileSync(pkgPath,"utf8"));
for(const key of ["test:core","test:ops"]){
  const needle="tests/audit10-wave2-independence-symmetry.test.mjs";
  if(!pkg.scripts[key].includes(needle))pkg.scripts[key]+=` ${needle}`;
}
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+"\n");
