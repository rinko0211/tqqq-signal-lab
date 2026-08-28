import fs from "node:fs";

const patchOnce=(text,from,to,label)=>{
  if(text.includes(to))return text;
  if(!text.includes(from))throw new Error(`Audit8 M10 patch anchor missing: ${label}`);
  return text.replace(from,to);
};

{
  const path="lib/primary-action.ts";
  let s=fs.readFileSync(path,"utf8");
  s=patchOnce(
    s,
    'import {nyseExecutionWindow,type NyseExecutionWindow} from "./market-calendar.ts";',
    'import {marketDate,nyseExecutionWindow,type NyseExecutionWindow} from "./market-calendar.ts";',
    "marketDate import"
  );
  s=patchOnce(
    s,
    '  const futureGenerationUnsafe=!Number.isFinite(nowMs)||generationTimes.some(t=>Number.isFinite(t)&&t>nowMs);\n',
    '  const futureGenerationUnsafe=!Number.isFinite(nowMs)||generationTimes.some(t=>Number.isFinite(t)&&t>nowMs);\n  let observationMarketDate:string|undefined;\n  try{observationMarketDate=marketDate(args.now)}catch{}\n  const productionUpdatedAtMs=args.production?Date.parse(args.production.updatedAt):NaN;\n  const productionAuthorityChronologyUnsafe=Boolean(approvedIncumbent&&args.production&&(\n    !observationMarketDate||\n    !args.production.approvalDate||!args.production.effectiveDate||\n    args.production.approvalDate>observationMarketDate||args.production.effectiveDate>observationMarketDate||\n    !Number.isFinite(productionUpdatedAtMs)||productionUpdatedAtMs>nowMs\n  ));\n',
    "Production authority chronology gate"
  );
  s=patchOnce(
    s,
    '  const signalUnsafe=Boolean(authorityUnsafe||forwardIntegrityUnsafe||signalPayloadUnsafe||signalNumericUnsafe||holdingsNumericUnsafe||futureGenerationUnsafe||executionContractUnsafe||args.status?.state==="failed"||fresh?.stale);',
    '  const signalUnsafe=Boolean(authorityUnsafe||forwardIntegrityUnsafe||signalPayloadUnsafe||signalNumericUnsafe||holdingsNumericUnsafe||futureGenerationUnsafe||productionAuthorityChronologyUnsafe||executionContractUnsafe||args.status?.state==="failed"||fresh?.stale);',
    "fail-closed aggregation"
  );
  fs.writeFileSync(path,s);
}

{
  const path="tests/executive-ui-semantics.test.mjs";
  let s=fs.readFileSync(path,"utf8");
  s=patchOnce(
    s,
    '  assert.match(primary,/futureGenerationUnsafe/);\n  assert.match(primary,/executionContractUnsafe/);',
    '  assert.match(primary,/futureGenerationUnsafe/);\n  assert.match(primary,/productionAuthorityChronologyUnsafe/);\n  assert.match(primary,/marketDate\\(args\\.now\\)/);\n  assert.match(primary,/executionContractUnsafe/);',
    "M10 source-shape assertions"
  );
  s=patchOnce(
    s,
    '  assert.match(primary,/signalUnsafe=Boolean\\(authorityUnsafe\\|\\|forwardIntegrityUnsafe\\|\\|signalPayloadUnsafe\\|\\|signalNumericUnsafe\\|\\|holdingsNumericUnsafe\\|\\|futureGenerationUnsafe\\|\\|executionContractUnsafe\\|\\|args\\.status\\?\\.state==="failed"\\|\\|fresh\\?\\.stale\\)/);',
    '  assert.match(primary,/signalUnsafe=Boolean\\(authorityUnsafe\\|\\|forwardIntegrityUnsafe\\|\\|signalPayloadUnsafe\\|\\|signalNumericUnsafe\\|\\|holdingsNumericUnsafe\\|\\|futureGenerationUnsafe\\|\\|productionAuthorityChronologyUnsafe\\|\\|executionContractUnsafe\\|\\|args\\.status\\?\\.state==="failed"\\|\\|fresh\\?\\.stale\\)/);',
    "M10 signalUnsafe source-shape guard"
  );
  fs.writeFileSync(path,s);
}

{
  const path="package.json";
  let s=fs.readFileSync(path,"utf8");
  const marker=" tests/audit8-wave2-blackbox.test.ts\"";
  const withM10=" tests/audit8-wave2-blackbox.test.ts tests/audit8-m10-production-authority-chronology.test.ts\"";
  if(!s.includes(withM10)){
    const count=s.split(marker).length-1;
    if(count!==2)throw new Error(`Expected two Audit8 Wave2 package anchors, found ${count}`);
    s=s.split(marker).join(withM10);
  }
  fs.writeFileSync(path,s);
}

console.log("Audit 8 M10 deterministic remediation applied");
