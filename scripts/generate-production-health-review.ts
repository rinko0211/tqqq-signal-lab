import{readFile,writeFile}from"node:fs/promises";
import{DEFAULT_PRODUCTION_CONFIG,type ProductionConfig}from"../lib/production.ts";
import{type LifecycleLedger}from"../lib/lifecycle-review.ts";
import{emptyProductionHealthLedger,updateProductionHealthLedger,type ProductionHealthLedger}from"../lib/production-health-review.ts";
const root=new URL("../github-pages/public/data/",import.meta.url);const read=async<T>(n:string,f:T)=>{try{return JSON.parse(await readFile(new URL(n,root),"utf8")) as T}catch{return f}};
const production=await read<ProductionConfig>("production-config.json",DEFAULT_PRODUCTION_CONFIG),lifecycle=await read<LifecycleLedger|null>("lifecycle-review.json",null);if(!lifecycle)throw Error("HEALTH-003: lifecycle-review.json missing");const prior=await read<ProductionHealthLedger>("production-health-review.json",emptyProductionHealthLedger());const next=updateProductionHealthLedger({production,lifecycle,prior,now:new Date().toISOString()});await writeFile(new URL("production-health-review.json",root),JSON.stringify(next,null,2)+"\n");console.log(`${next.current.state} / next ${next.current.nextReview||"n/a"}`);
