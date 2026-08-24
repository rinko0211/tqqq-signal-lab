import{mkdir,readFile,writeFile}from"node:fs/promises";
import{datasetFromPayload}from"../lib/engine.ts";
import{deepResearchBundle}from"../lib/research.ts";

const roots=[new URL("../github-pages/public/data/",import.meta.url),new URL("../public/data/",import.meta.url)];
await Promise.all(roots.map(x=>mkdir(x,{recursive:true})));
const payload=JSON.parse(await readFile(new URL("market-data.json",roots[0]),"utf8")),dataset=datasetFromPayload(payload),errors=dataset.issues.filter(x=>x.severity==="error");
if(errors.length)throw Error(errors.map(x=>x.message).join("; "));
const report=deepResearchBundle(dataset);
await Promise.all(roots.map(x=>writeFile(new URL("deep-research.json",x),JSON.stringify(report,null,2)+"\n")));
console.log(`Deep research generated: ${report.dataStart} to ${report.dataEnd}`);
