import fs from "node:fs";
import {execFileSync} from "node:child_process";

execFileSync(process.execPath,["scripts/audit5-remediate.mjs"],{stdio:"inherit"});

const dailyPath="scripts/generate-daily.ts";
const daily=fs.readFileSync(dailyPath,"utf8").replace(/\/\* AUDIT5_BOOTSTRAP_START \*\/[\s\S]*?\/\* AUDIT5_BOOTSTRAP_END \*\/\n?/,"");
fs.writeFileSync(dailyPath,daily);

const originalRunner=execFileSync("git",["show","e2a601d47888cc6911c32965f2f184b7ee0d9af2^:.github/workflows/re-audit4-remediation.yml"],{encoding:"utf8"});
fs.writeFileSync(".github/workflows/re-audit4-remediation.yml",originalRunner);
for(const p of [".github/workflows/audit5-close.yml","scripts/audit5-remediate.mjs","scripts/re-audit4-lint-fix.mjs"]){if(fs.existsSync(p))fs.rmSync(p)}

execFileSync("git",["add","-A"],{stdio:"inherit"});
console.log("Audit 5 remediation applied, temporary helpers removed, full remediation staged.");
