import { mkdir, readFile, writeFile } from "node:fs/promises";
import { datasetFromPayload } from "../lib/engine.ts";
import { emptyForwardLedger, summarizeForward, updateForwardLedger, type ForwardLedger } from "../lib/forward.ts";

const roots=[new URL("../github-pages/public/data/",import.meta.url),new URL("../public/data/",import.meta.url)];
await Promise.all(roots.map(x=>mkdir(x,{recursive:true})));
const payload=JSON.parse(await readFile(new URL("market-data.json",roots[0]),"utf8"));
let prior:ForwardLedger;
try{prior=JSON.parse(await readFile(new URL("forward-ledger.json",roots[0]),"utf8"))}catch{prior=emptyForwardLedger()}
const dataset=datasetFromPayload(payload),errors=dataset.issues.filter(x=>x.severity==="error");
if(errors.length)throw Error(errors.map(x=>x.message).join("; "));
const ledger=updateForwardLedger(dataset,prior,payload.source||"stored official data");
let status:Record<string,unknown>={};
try{status=JSON.parse(await readFile(new URL("status.json",roots[0]),"utf8"))}catch{}
const lastForwardRecord=ledger.records.at(-1)?.marketDataDate||null;
await Promise.all(roots.flatMap(root=>[
  writeFile(new URL("forward-ledger.json",root),JSON.stringify(ledger,null,2)+"\n"),
  writeFile(new URL("forward-summary.json",root),JSON.stringify(summarizeForward(ledger),null,2)+"\n"),
  writeFile(new URL("status.json",root),JSON.stringify({...status,lastForwardRecord,forwardRecords:ledger.records.length,forwardPersistent:true,buildVersion:"forward-1.0.0",dataSource:payload.source||"stored official data"},null,2)+"\n"),
]));
console.log(`Forward initialized: ${ledger.records.length} immutable records through ${ledger.records.at(-1)?.marketDataDate}`);
