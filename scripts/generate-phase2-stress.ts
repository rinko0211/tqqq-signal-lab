import {mkdir,writeFile} from "node:fs/promises";
import {fetchOfficialData} from "../lib/official-data.ts";
import {phase2StressBundle} from "../lib/phase2-stress.ts";
const root=new URL("../github-pages/public/data/",import.meta.url);await mkdir(root,{recursive:true});
const b=phase2StressBundle(await fetchOfficialData(true));
await writeFile(new URL("phase-2b-stress.json",root),JSON.stringify(b,null,2)+"\n");
console.log(`Phase 2B generated: ${b.rows.length} rows`);
