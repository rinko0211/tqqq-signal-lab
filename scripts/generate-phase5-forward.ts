import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fetchPhase5ForwardData } from "../lib/official-data.ts";
import { PHASE5_FREEZES, summarizePhase5, updatePhase5LedgerSubset, type Phase5Ledger } from "../lib/phase5-forward.ts";
import {dailyBarIsComplete} from "../lib/market-calendar.ts";

const root=new URL("../github-pages/public/data/",import.meta.url);await mkdir(root,{recursive:true});
const generatedAt=new Date().toISOString();
let prior:Phase5Ledger;try{prior=JSON.parse(await readFile(new URL("phase-5-forward-ledger.json",root),"utf8")) as Phase5Ledger}catch(error){throw Error(`STATE-004: phase-5-forward-ledger.json missing/corrupt; refusing append-only reset (${error instanceof Error?error.message:String(error)})`)}if(prior.schemaVersion!==1||prior.appendOnly!==true)throw Error("STATE-005: Phase 5 ledger authority is invalid")
const keepCompletedNyseBars=<T extends {date:string}>(rows:T[],now:string)=>rows.filter(r=>dailyBarIsComplete(r.date,now));

try{
  const payload=await fetchPhase5ForwardData();
  const safe={...payload,series:Object.fromEntries(Object.entries(payload.series).map(([k,v])=>[k,keepCompletedNyseBars(v,generatedAt)]))};
  let ledger=prior;const systems:Record<string,{status:"success"|"failed";latestDate:string|null;errors:string[]}>= {};
  for(const freeze of PHASE5_FREEZES){
    const required=[...new Set([freeze.ticker,freeze.proxy,"SPY","VIX"])],missing=required.filter(k=>!safe.series[k]?.length),feedErrors=required.flatMap(k=>payload.errors?.[k]??[]);
    if(missing.length){systems[freeze.version]={status:"failed",latestDate:ledger.records.filter(r=>r.strategyVersion===freeze.version&&r.dataStatus==="VALID").at(-1)?.marketDataDate??null,errors:[...feedErrors,...missing.filter(k=>!(payload.errors?.[k]?.length)).map(k=>`missing completed series: ${k}`)]};continue}
    try{ledger=updatePhase5LedgerSubset(safe,ledger,[freeze.version],generatedAt);systems[freeze.version]={status:"success",latestDate:ledger.records.filter(r=>r.strategyVersion===freeze.version&&r.dataStatus==="VALID").sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)).at(-1)?.marketDataDate??null,errors:[]}}
    catch(error){systems[freeze.version]={status:"failed",latestDate:ledger.records.filter(r=>r.strategyVersion===freeze.version&&r.dataStatus==="VALID").at(-1)?.marketDataDate??null,errors:[error instanceof Error?error.message:String(error)]}}
  }
  const summary=summarizePhase5(ledger),latestDates=Object.fromEntries(Object.entries(safe.series).map(([k,v])=>[k,v.at(-1)?.date??null])),failed=Object.entries(systems).filter(([,s])=>s.status==="failed"),status=failed.length===0?"success":failed.length===PHASE5_FREEZES.length?"failed":"partial",errors=failed.flatMap(([version,s])=>s.errors.map(e=>`${version}: ${e}`));
  await Promise.all([writeFile(new URL("phase-5-forward-ledger.json",root),`${JSON.stringify(ledger,null,2)}\n`),writeFile(new URL("phase-5-forward-status.json",root),`${JSON.stringify({generatedAt,status,forwardStart:"2026-08-25",latestDates,systems,summary,records:ledger.records.length,buildVersion:process.env.GITHUB_SHA?.slice(0,12)||"phase5-forward-1.0.0",errors},null,2)}\n`)]);
  if(failed.length)throw new Error(`Phase 5 partial/failed systems: ${failed.map(([v])=>v).join(", ")}`);
}catch(error){
  let existing:{generatedAt?:string}|null=null;try{existing=JSON.parse(await readFile(new URL("phase-5-forward-status.json",root),"utf8")) as {generatedAt?:string}}catch{}
  if(!existing?.generatedAt||existing.generatedAt!==generatedAt)await writeFile(new URL("phase-5-forward-status.json",root),`${JSON.stringify({generatedAt,status:"failed",forwardStart:"2026-08-25",records:prior.records.length,summary:summarizePhase5(prior),buildVersion:process.env.GITHUB_SHA?.slice(0,12)||"phase5-forward-1.0.0",errors:[error instanceof Error?error.message:String(error)]},null,2)}\n`);
  throw error;
}
