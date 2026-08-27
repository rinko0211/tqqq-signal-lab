import fs from "node:fs";

const replace=(path,from,to)=>{
  let s=fs.readFileSync(path,"utf8");
  if(s.includes(to))return;
  if(!s.includes(from))throw Error(`Audit 8 wave2 patch guard failed: ${path}`);
  s=s.replace(from,to);fs.writeFileSync(path,s);
};

replace("lib/primary-action.ts",
'import {freshness,nextExecutionDate} from "./engine.ts";\nimport {assertForwardLedgerInternalIntegrity,type ForwardLedger} from "./forward.ts";',
'import {freshness} from "./engine.ts";\nimport {earliestLegalExecutionDate} from "./execution-integrity.ts";\nimport {assertForwardLedgerInternalIntegrity,type ForwardLedger} from "./forward.ts";');
replace("lib/primary-action.ts",
'import type {ProductionConfig} from "./production.ts";',
'import {hasActiveProduction,type ProductionConfig} from "./production.ts";');
replace("lib/primary-action.ts",
'  const holdingsMatch=args.holdings.ticker\n    ?args.holdings.ticker===currentTicker&&(!args.holdings.version||args.holdings.version===currentVersion)\n    :currentTicker==="TQQQ";',
'  const approvedIncumbent=Boolean(args.production&&hasActiveProduction(args.production));\n  const holdingsMatch=approvedIncumbent\n    ?args.holdings.ticker===currentTicker&&args.holdings.version===currentVersion\n    :args.holdings.ticker\n      ?args.holdings.ticker===currentTicker&&(!args.holdings.version||args.holdings.version===currentVersion)\n      :currentTicker==="TQQQ";');
replace("lib/primary-action.ts",
'  const signalNumericUnsafe=Boolean(signal&&(\n    signal.date!==args.signal?.dataDate||\n    !Number.isFinite(signal.target)||!Number.isFinite(signal.previousTarget)||\n    signal.target<0||signal.target>1||signal.previousTarget<0||signal.previousTarget>1\n  ));\n  const executionDate=signal?.executionDate||(signal?nextExecutionDate(signal.date):undefined);',
'  const signalPayloadUnsafe=!signal;\n  const signalNumericUnsafe=Boolean(signal&&(\n    signal.date!==args.signal?.dataDate||\n    !Number.isFinite(signal.target)||!Number.isFinite(signal.previousTarget)||\n    signal.target<0||signal.target>1||signal.previousTarget<0||signal.previousTarget>1\n  ));\n  const nowMs=Date.parse(args.now);\n  const generationTimes=[args.signal?.generatedAt,args.status?.generatedAt,args.forward?.updatedAt].map(x=>typeof x==="string"?Date.parse(x):NaN);\n  const futureGenerationUnsafe=!Number.isFinite(nowMs)||generationTimes.some(t=>Number.isFinite(t)&&t>nowMs);\n  let expectedExecutionDate:string|undefined,executionContractUnsafe=false;\n  if(signal&&args.signal?.generatedAt){\n    try{expectedExecutionDate=earliestLegalExecutionDate(signal.date,args.signal.generatedAt);if(signal.executionDate&&signal.executionDate!==expectedExecutionDate)executionContractUnsafe=true}\n    catch{executionContractUnsafe=true}\n  }\n  const executionDate=signal?.executionDate||expectedExecutionDate;');
replace("lib/primary-action.ts",
'  const signalUnsafe=Boolean(authorityUnsafe||forwardIntegrityUnsafe||signalNumericUnsafe||holdingsNumericUnsafe||args.status?.state==="failed"||fresh?.stale);',
'  const signalUnsafe=Boolean(authorityUnsafe||forwardIntegrityUnsafe||signalPayloadUnsafe||signalNumericUnsafe||holdingsNumericUnsafe||futureGenerationUnsafe||executionContractUnsafe||args.status?.state==="failed"||fresh?.stale);');

replace("lib/forward.ts",
'    if(!Number.isFinite(Date.parse(r.recordedAt)))throw Error(`Forward integrity: invalid recordedAt ${r.key}`);',
'    if(!Number.isFinite(Date.parse(r.recordedAt)))throw Error(`Forward integrity: invalid recordedAt ${r.key}`);\n    if(!Number.isFinite(Date.parse(ledger.updatedAt))||Date.parse(r.recordedAt)>Date.parse(ledger.updatedAt))throw Error(`Forward integrity: record chronology exceeds ledger generation ${r.key}`);');
replace("lib/forward.ts",
'    if(keys.has(r.key)||logical.has(expected))throw Error(`Forward integrity: duplicate record ${r.key}`);keys.add(r.key);logical.add(expected);\n  }\n}',
'    if(keys.has(r.key)||logical.has(expected))throw Error(`Forward integrity: duplicate record ${r.key}`);keys.add(r.key);logical.add(expected);\n  }\n  for(const freeze of ledger.freezes){\n    const rows=ledger.records.filter(r=>r.strategyVersion===freeze.version);\n    if(!rows.length)continue;\n    const last=rows.at(-1)!;\n    const expectedSessions=countNyseSessions(freeze.startDate,last.marketDataDate);\n    if(rows.length!==expectedSessions)throw Error(`Forward integrity: incomplete session history ${freeze.version}`);\n  }\n}');

replace("tests/executive-ui-semantics.test.mjs",
'  assert.match(primary,/signalUnsafe=Boolean\\(authorityUnsafe\\|\\|forwardIntegrityUnsafe\\|\\|signalNumericUnsafe\\|\\|holdingsNumericUnsafe\\|\\|args\\.status\\?\\.state===\"failed\"\\|\\|fresh\\?\\.stale\\)/);',
'  assert.match(primary,/signalPayloadUnsafe/);\n  assert.match(primary,/futureGenerationUnsafe/);\n  assert.match(primary,/executionContractUnsafe/);\n  assert.match(primary,/approvedIncumbent/);\n  assert.match(primary,/signalUnsafe=Boolean\\(authorityUnsafe\\|\\|forwardIntegrityUnsafe\\|\\|signalPayloadUnsafe\\|\\|signalNumericUnsafe\\|\\|holdingsNumericUnsafe\\|\\|futureGenerationUnsafe\\|\\|executionContractUnsafe\\|\\|args\\.status\\?\\.state===\"failed\"\\|\\|fresh\\?\\.stale\\)/);');

const pkgPath="package.json",pkg=JSON.parse(fs.readFileSync(pkgPath,"utf8"));
for(const key of ["test:core","test:ops"]){
  if(typeof pkg.scripts?.[key]!=="string")throw Error(`Missing ${key}`);
  if(!pkg.scripts[key].includes("tests/audit8-wave2-blackbox.test.ts"))pkg.scripts[key]+=" tests/audit8-wave2-blackbox.test.ts";
}
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+"\n");
