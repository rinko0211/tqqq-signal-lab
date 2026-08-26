import fs from "node:fs";
import path from "node:path";
import { fetchOfficialData } from "../lib/official-data.ts";
import { phase4Bundle } from "../lib/phase4.ts";

const payload=await fetchOfficialData(true);
const bundle=phase4Bundle(payload as Parameters<typeof phase4Bundle>[0]);
const outDir=path.join(process.cwd(),"github-pages/public/data");
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,"phase-4-hierarchical.json"),JSON.stringify(bundle,null,2)+"\n");
console.log(JSON.stringify({results:bundle.results.map(x=>({variant:x.variant,oos:x.oos,gatePassed:x.gatePassed})),attribution:bundle.attribution},null,2));
