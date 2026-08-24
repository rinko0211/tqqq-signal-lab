import{readFile,mkdir,writeFile}from"node:fs/promises";
import{DEFAULT_PRODUCTION_CONFIG,transitionMode,type ProductionConfig,type PlatformMode}from"../lib/production.ts";
const mode=(process.env.MODE||"DECISION") as PlatformMode,confirmation=process.env.CONFIRMATION||"";
const path=new URL("../github-pages/public/data/production-config.json",import.meta.url);let current:ProductionConfig=DEFAULT_PRODUCTION_CONFIG;
try{current=JSON.parse(await readFile(path,"utf8"))}catch{}
let next:ProductionConfig;
if(mode==="PRODUCTION"){
  if(confirmation!=="APPROVE PRODUCTION")throw Error("Type APPROVE PRODUCTION exactly. Human approval was not recorded.");
  const ticker=process.env.TICKER||"",system=process.env.STRATEGY||"",version=process.env.VERSION||"";
  if(!ticker||!system||!version)throw Error("Ticker, strategy and version are required");
  next=transitionMode(current,"PRODUCTION",{ticker,system,version,date:new Date().toISOString().slice(0,10)});
}else next=transitionMode(current,mode);
await mkdir(new URL("../github-pages/public/data/",import.meta.url),{recursive:true});await writeFile(path,JSON.stringify(next,null,2)+"\n");
console.log(`Platform mode: ${current.mode} -> ${next.mode}`);
