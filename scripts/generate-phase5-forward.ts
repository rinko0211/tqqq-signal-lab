import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fetchPhase5ForwardData } from "../lib/official-data.ts";
import { emptyPhase5Ledger, summarizePhase5, updatePhase5Ledger, type Phase5Ledger } from "../lib/phase5-forward.ts";

const root=new URL("../github-pages/public/data/",import.meta.url);await mkdir(root,{recursive:true});
const generatedAt=new Date().toISOString();
let prior:Phase5Ledger;try{prior=JSON.parse(await readFile(new URL("phase-5-forward-ledger.json",root),"utf8"))}catch{prior=emptyPhase5Ledger(generatedAt)}

function nyParts(iso:string){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(iso));const x=Object.fromEntries(p.map(v=>[v.type,v.value]));return{date:`${x.year}-${x.month}-${x.day}`,minutes:Number(x.hour)*60+Number(x.minute)}}
function removeIncompleteCurrentBar<T extends {date:string}>(rows:T[],now:string){const ny=nyParts(now);return rows.filter(r=>!(r.date===ny.date&&ny.minutes<16*60+15))}

try{
  const payload=await fetchPhase5ForwardData();
  const safe={...payload,series:Object.fromEntries(Object.entries(payload.series).map(([k,v])=>[k,removeIncompleteCurrentBar(v,generatedAt)]))};
  const ledger=updatePhase5Ledger(safe,prior,generatedAt),summary=summarizePhase5(ledger);
  const latestDates=Object.fromEntries(Object.entries(safe.series).map(([k,v])=>[k,v.at(-1)?.date??null]));
  await Promise.all([
    writeFile(new URL("phase-5-forward-ledger.json",root),`${JSON.stringify(ledger,null,2)}\n`),
    writeFile(new URL("phase-5-forward-status.json",root),`${JSON.stringify({generatedAt,status:"success",forwardStart:"2026-08-25",latestDates,summary,records:ledger.records.length,buildVersion:process.env.GITHUB_SHA?.slice(0,12)||"phase5-forward-1.0.0",errors:[]},null,2)}\n`),
  ]);
}catch(error){
  await writeFile(new URL("phase-5-forward-status.json",root),`${JSON.stringify({generatedAt,status:"failed",forwardStart:"2026-08-25",records:prior.records.length,summary:summarizePhase5(prior),buildVersion:process.env.GITHUB_SHA?.slice(0,12)||"phase5-forward-1.0.0",errors:[error instanceof Error?error.message:String(error)]},null,2)}\n`);
  throw error;
}
