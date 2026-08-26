import fs from "node:fs";
const path="lib/lifecycle-review.ts";let s=fs.readFileSync(path,"utf8");
function one(from,to,label){if(s.includes(to))return;const n=s.split(from).length-1;if(n!==1)throw new Error(`${label}: expected 1 anchor, got ${n}`);s=s.replace(from,to)}
one('import { assessHealth, type ProductionConfig, type HealthState } from "./production.ts";','import { assessHealth, hasActiveProduction, type ProductionConfig, type HealthState } from "./production.ts";','import active helper');
one('if(production.mode!=="PRODUCTION"||!production.approvedByHuman||!production.strategyVersion)return{state:"NOT_IN_PRODUCTION",version:null,reasons:["No human-approved Production system is active"],nextHealthReview:production.nextHealthReview};','if(!hasActiveProduction(production)||!production.strategyVersion)return{state:"NOT_IN_PRODUCTION",version:null,reasons:["No human-approved Production system is active"],nextHealthReview:production.nextHealthReview};','health active during decision');
fs.writeFileSync(path,s);console.log("Phase C lifecycle Decision-state patch applied");
