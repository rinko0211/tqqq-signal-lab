import fs from "node:fs";

const pagePath="app/page.tsx",packagePath="package.json";
let page=fs.readFileSync(pagePath,"utf8");
const importAnchor='import {nyseExecutionWindow} from "../lib/market-calendar";';
const helperImport='import {operationalAuthorityBundleIsCoherent} from "../lib/operational-authority";';
const authorityAnchor='    authorityUnsafe=Boolean(!dailySignal||!runtimeStatus||!productionConfigIsValid(productionConfig)||!forwardLedger),';
const remediatedAuthority='    authorityBundle=operationalAuthorityBundleIsCoherent({signal:dailySignal,status:runtimeStatus,production:productionConfig,forward:forwardLedger}),\n    authorityUnsafe=!authorityBundle.ok,';
if(!page.includes(importAnchor))throw Error("M03 patch guard: market-calendar import anchor not found");
if(!page.includes(helperImport))page=page.replace(importAnchor,`${importAnchor}\n${helperImport}`);
if(page.includes(authorityAnchor))page=page.replace(authorityAnchor,remediatedAuthority);
else if(!page.includes(remediatedAuthority))throw Error("M03 patch guard: neither old nor remediated authority gate found");
fs.writeFileSync(pagePath,page);

const pkg=JSON.parse(fs.readFileSync(packagePath,"utf8"));
for(const key of ["test:core","test:ops"]){
  const marker="tests/audit6-final-failclosed.test.mjs";
  const addition="tests/audit7-state-space.test.ts tests/audit7-authority-bundle.test.ts";
  if(typeof pkg.scripts?.[key]!=="string"||!pkg.scripts[key].includes(marker))throw Error(`M03 patch guard: ${key} marker missing`);
  if(!pkg.scripts[key].includes("tests/audit7-state-space.test.ts"))pkg.scripts[key]=pkg.scripts[key].replace(marker,`${marker} ${addition}`);
}
fs.writeFileSync(packagePath,JSON.stringify(pkg,null,2)+"\n");
