import fs from "node:fs";
import path from "node:path";
import { fetchOfficialData } from "../lib/official-data.ts";
import { phase3Bundle, type Phase3Group } from "../lib/phase3.ts";

const arg=(process.argv[2]||"").toUpperCase();
if(!["NASDAQ","SP500"].includes(arg))throw new Error("usage: generate-phase3.ts NASDAQ|SP500");
const group=arg as Phase3Group;
const payload=await fetchOfficialData(true);
const bundle=phase3Bundle(payload as any,group);
const outDir=path.join(process.cwd(),"github-pages/public/data");
fs.mkdirSync(outDir,{recursive:true});
const file=group==="NASDAQ"?"phase-3-nasdaq.json":"phase-3-sp500.json";
fs.writeFileSync(path.join(outDir,file),JSON.stringify(bundle,null,2)+"\n");
console.log(JSON.stringify({group,decisions:bundle.decisions},null,2));
