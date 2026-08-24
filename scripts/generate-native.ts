import{mkdir,writeFile}from"node:fs/promises";
import{fetchOfficialData}from"../lib/official-data.ts";
import{nativeResearchBundle}from"../lib/native-research.ts";
const payload=await fetchOfficialData(true),report=nativeResearchBundle(payload);
const roots=process.env.GITHUB_ACTIONS==="true"?[new URL("../github-pages/public/data/",import.meta.url)]:[new URL("../github-pages/public/data/",import.meta.url),new URL("../public/data/",import.meta.url)];
await Promise.all(roots.map(async root=>{await mkdir(root,{recursive:true});await writeFile(new URL("native-research.json",root),JSON.stringify(report,null,2)+"\n")}));
console.log(`Native research generated: ${report.results.length} tickers; ${report.forwardCandidates.length} frozen Forward candidates`);
