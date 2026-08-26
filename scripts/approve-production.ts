import{readFile,mkdir,writeFile}from"node:fs/promises";
import{DEFAULT_PRODUCTION_CONFIG,cancelDecision,hasActiveProduction,transitionMode,type ProductionConfig,type PlatformMode}from"../lib/production.ts";
import{productionEligibleVersions,type LifecycleLedger}from"../lib/lifecycle-review.ts";
import{lifecycleReviewIsFresh}from"../lib/lifecycle-approval.ts";
const action=process.env.MODE||"DECISION",confirmation=process.env.CONFIRMATION||"";
const root=new URL("../github-pages/public/data/",import.meta.url),path=new URL("production-config.json",root);let current:ProductionConfig=DEFAULT_PRODUCTION_CONFIG;
try{current=JSON.parse(await readFile(path,"utf8"))}catch{}
let next:ProductionConfig;
if(action==="CANCEL_DECISION"){
  next=cancelDecision(current);
}else if(action==="RESEARCH"){
  if(hasActiveProduction(current)&&confirmation!=="EXIT PRODUCTION")throw Error("Type EXIT PRODUCTION exactly to leave an active Formal Production system and return to the TQQQ Operational Baseline.");
  next=transitionMode(current,"RESEARCH");
}else if(action==="PRODUCTION"){
  if(confirmation!=="APPROVE PRODUCTION")throw Error("Type APPROVE PRODUCTION exactly. Human approval was not recorded.");
  const ticker=process.env.TICKER||"",system=process.env.STRATEGY||"",version=process.env.VERSION||"";
  if(!ticker||!system||!version)throw Error("Ticker, strategy and version are required");
  let lifecycle:LifecycleLedger;
  try{lifecycle=JSON.parse(await readFile(new URL("lifecycle-review.json",root),"utf8"))}catch{throw Error("LIFECYCLE-001: autonomous lifecycle review is missing")}
  if(!lifecycleReviewIsFresh(lifecycle))throw Error("LIFECYCLE-005: autonomous lifecycle review is stale or has an invalid timestamp; run a current review before Production approval");
  if(lifecycle.current.stage!=="FORMAL"&&lifecycle.current.stage!=="STRONGER")throw Error("LIFECYCLE-002: Production is blocked before the formal Forward review");
  if(lifecycle.current.systemDecision!=="PHASE6_HUMAN_DECISION_REQUIRED")throw Error(`LIFECYCLE-003: current review state is ${lifecycle.current.systemDecision}; Production approval is blocked`);
  const eligible=productionEligibleVersions(lifecycle);
  if(!eligible.includes(version))throw Error(`LIFECYCLE-004: ${version} is not eligible in the current Phase 6 review`);
  next=transitionMode(current,"PRODUCTION",{ticker,system,version,date:new Date().toISOString().slice(0,10),evidence:"Strong",finalReviewComplete:true});
}else if(action==="DECISION"){
  next=transitionMode(current,"DECISION");
}else{
  throw Error(`Unsupported approval action: ${action}`);
}
await mkdir(root,{recursive:true});await writeFile(path,JSON.stringify(next,null,2)+"\n");
console.log(`Platform mode: ${current.mode} -> ${next.mode}`);
