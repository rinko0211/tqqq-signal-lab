import fs from "node:fs";

function patch(path,from,to){
  const src=fs.readFileSync(path,"utf8");
  if(!src.includes(from))throw new Error(`Audit10 M01 patch anchor missing: ${path}`);
  if(src.includes(to))return;
  fs.writeFileSync(path,src.replace(from,to));
}

patch(
  "lib/lifecycle-review.ts",
  'if(ledger.schemaVersion!==1||ledger.appendOnly!==true)throw Error("Lifecycle prior ledger is invalid; refusing append-only reset");const keys=new Set<string>();let previousRecordedAt=-Infinity;for(const e of ledger.events){if(!e.key||keys.has(e.key))throw Error(`Lifecycle integrity: duplicate/invalid event key ${e.key}`);if(!isValidIsoMarketDate(e.reviewDate)||!Number.isFinite(Date.parse(e.recordedAt)))throw Error(`Lifecycle integrity: invalid event chronology ${e.key}`);const recordedAt=Date.parse(e.recordedAt);if(recordedAt<previousRecordedAt)throw Error(`Lifecycle integrity: out-of-order event chronology ${e.key}`);previousRecordedAt=recordedAt;keys.add(e.key);}',
  'if(ledger.schemaVersion!==1||ledger.appendOnly!==true)throw Error("Lifecycle prior ledger is invalid; refusing append-only reset");const generation=Date.parse(ledger.updatedAt);if(!Number.isFinite(generation))throw Error("Lifecycle integrity: invalid ledger generation updatedAt");const keys=new Set<string>();let previousRecordedAt=-Infinity;for(const e of ledger.events){if(!e.key||keys.has(e.key))throw Error(`Lifecycle integrity: duplicate/invalid event key ${e.key}`);if(!isValidIsoMarketDate(e.reviewDate)||!Number.isFinite(Date.parse(e.recordedAt)))throw Error(`Lifecycle integrity: invalid event chronology ${e.key}`);const recordedAt=Date.parse(e.recordedAt);if(recordedAt>generation)throw Error(`Lifecycle integrity: event chronology exceeds ledger generation ${e.key}`);if(recordedAt<previousRecordedAt)throw Error(`Lifecycle integrity: out-of-order event chronology ${e.key}`);previousRecordedAt=recordedAt;keys.add(e.key);}'
);

patch(
  "lib/production-health-review.ts",
  'if(ledger.schemaVersion!==1||ledger.appendOnly!==true)throw Error("Production Health prior ledger is invalid; refusing append-only reset");const keys=new Set<string>(),logical=new Set<string>();let previousRecordedAt=-Infinity;for(const e of ledger.events){const id=`${e.version}|${e.dueDate}`;if(!e.key||e.key!==id||keys.has(e.key)||logical.has(id))throw Error(`Production Health integrity: duplicate/invalid event ${e.key}`);if(!isValidIsoMarketDate(e.dueDate)||!Number.isFinite(Date.parse(e.recordedAt)))throw Error(`Production Health integrity: invalid event date/timestamp ${e.key}`);const recordedAt=Date.parse(e.recordedAt);if(recordedAt<previousRecordedAt)throw Error(`Production Health integrity: out-of-order event chronology ${e.key}`);previousRecordedAt=recordedAt;keys.add(e.key);logical.add(id);}',
  'if(ledger.schemaVersion!==1||ledger.appendOnly!==true)throw Error("Production Health prior ledger is invalid; refusing append-only reset");const generation=Date.parse(ledger.updatedAt);if(!Number.isFinite(generation))throw Error("Production Health integrity: invalid ledger generation updatedAt");const keys=new Set<string>(),logical=new Set<string>();let previousRecordedAt=-Infinity;for(const e of ledger.events){const id=`${e.version}|${e.dueDate}`;if(!e.key||e.key!==id||keys.has(e.key)||logical.has(id))throw Error(`Production Health integrity: duplicate/invalid event ${e.key}`);if(!isValidIsoMarketDate(e.dueDate)||!Number.isFinite(Date.parse(e.recordedAt)))throw Error(`Production Health integrity: invalid event date/timestamp ${e.key}`);const recordedAt=Date.parse(e.recordedAt);if(recordedAt>generation)throw Error(`Production Health integrity: event chronology exceeds ledger generation ${e.key}`);if(recordedAt<previousRecordedAt)throw Error(`Production Health integrity: out-of-order event chronology ${e.key}`);previousRecordedAt=recordedAt;keys.add(e.key);logical.add(id);}'
);

const pkgPath="package.json";
const pkg=JSON.parse(fs.readFileSync(pkgPath,"utf8"));
for(const script of ["test:core","test:ops"]){
  const token="tests/audit10-m01-ledger-generation-chronology.test.ts";
  if(!pkg.scripts[script].includes(token))pkg.scripts[script]+=` ${token}`;
}
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+"\n");
