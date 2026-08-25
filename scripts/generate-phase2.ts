import { mkdir, writeFile } from "node:fs/promises";
import { fetchOfficialData } from "../lib/official-data.ts";
import { phase2Bundle } from "../lib/phase2.ts";

const root=new URL("../github-pages/public/data/",import.meta.url);
await mkdir(root,{recursive:true});
const payload=await fetchOfficialData(true);
const bundle=phase2Bundle(payload);
await writeFile(new URL("phase-2-robustness.json",root),JSON.stringify(bundle,null,2)+"\n");
console.log(`Phase 2 generated: ${bundle.rows.length} rows, ${bundle.summary.length} tickers`);
