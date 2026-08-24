import{mkdir,writeFile}from"node:fs/promises";
import{datasetFromPayload}from"../lib/engine.ts";
import{deepResearchBundle}from"../lib/research.ts";
import{crossTickerBundle}from"../lib/cross-ticker.ts";
import{nativeResearchBundle}from"../lib/native-research.ts";
import{fetchOfficialData}from"../lib/official-data.ts";

const pagesRoot=new URL("../github-pages/public/data/",import.meta.url);
const roots=process.env.GITHUB_ACTIONS==="true"?[pagesRoot]:[pagesRoot,new URL("../public/data/",import.meta.url)];
await Promise.all(roots.map(x=>mkdir(x,{recursive:true})));
const payload=await fetchOfficialData(true),dataset=datasetFromPayload(payload),errors=dataset.issues.filter(x=>x.severity==="error");
if(errors.length)throw Error(errors.map(x=>x.message).join("; "));
const report=deepResearchBundle(dataset);
const cross=crossTickerBundle(payload);
const native=nativeResearchBundle(payload);
await Promise.all(roots.flatMap(x=>[
  writeFile(new URL("deep-research.json",x),JSON.stringify(report,null,2)+"\n"),
  writeFile(new URL("cross-ticker.json",x),JSON.stringify(cross,null,2)+"\n"),
  writeFile(new URL("native-research.json",x),JSON.stringify(native,null,2)+"\n"),
]));
console.log(`Deep research generated: ${report.dataStart} to ${report.dataEnd}`);
console.log(`Cross-ticker research generated: ${cross.results.length} candidates, common start ${cross.commonStart||"n/a"}`);
console.log(`Native research generated: ${native.results.length} tickers, ${native.forwardCandidates.length} forward candidates`);
