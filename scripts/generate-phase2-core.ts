import {mkdir,writeFile} from "node:fs/promises";
import {fetchOfficialData} from "../lib/official-data.ts";
import {phase2CoreBundle} from "../lib/phase2-core.ts";
const root=new URL("../github-pages/public/data/",import.meta.url);await mkdir(root,{recursive:true});
const b=phase2CoreBundle(await fetchOfficialData(true));
await writeFile(new URL("phase-2a-core.json",root),JSON.stringify(b,null,2)+"\n");
console.log(`Phase 2A generated: ${b.rows.length} rows`);
