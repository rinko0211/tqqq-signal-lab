import fs from "node:fs";

function read(path){return fs.readFileSync(path,"utf8")}
function write(path,text){fs.writeFileSync(path,text)}
function replace(path,from,to){
  const text=read(path);
  if(!text.includes(from))throw new Error(`Pattern not found in ${path}: ${from.slice(0,120)}`);
  write(path,text.replace(from,to));
}

replace("lib/lifecycle-review.ts",
`  const version=production.strategyVersion,p5=summarizePhase5(phase5).find(x=>x.version===version),legacy=summarizeForward(forward).find(x=>x.version===version),row=p5||legacy;\n  if(!row)return{state:"Critical",version,reasons:["Selected Production version has no matching Forward ledger"],nextHealthReview:production.nextHealthReview};\n  const quality=p5?phase5StatusQuality(phase5Status,now,false):runtimeStatusQuality(runtimeStatus,now,false),historicalDd=HIST_DD[version]??-.40,dd=(row as any).metrics?.maxDd??(row as any).currentDd??0,live=(row as any).liveObservations??(row as any).observations??0,actionDays=(row as any).actionDays??(row as any).orders??0,apy=actionDays/yearsObserved(live);`,
`  const version=production.strategyVersion,p5=summarizePhase5(phase5).find(x=>x.version===version),legacy=summarizeForward(forward).find(x=>x.version===version);\n  if(!p5&&!legacy)return{state:"Critical",version,reasons:["Selected Production version has no matching Forward ledger"],nextHealthReview:production.nextHealthReview};\n  const quality=p5?phase5StatusQuality(phase5Status,now,false):runtimeStatusQuality(runtimeStatus,now,false),historicalDd=HIST_DD[version]??-.40;\n  const dd=p5?p5.metrics.maxDd:legacy!.metrics.maxDd,live=p5?p5.liveObservations:legacy!.observations,actionDays=p5?p5.actionDays:legacy!.orders,apy=actionDays/yearsObserved(live);`);

replace("lib/phase2.ts",
`type SeriesRun = {\n  metrics: Phase2Metrics;\n  daily: { date: string; dailyReturn: number; position: number }[];\n};\n\nconst leverageNumber`,
`type SeriesRun = {\n  metrics: Phase2Metrics;\n  daily: { date: string; dailyReturn: number; position: number }[];\n};\ntype Phase2Year={year:number;metrics:Phase2Metrics};\ntype Phase2Row={\n  ticker:CrossTicker;underlying:ScreeningRow["underlying"];leverage:ScreeningRow["leverage"];family:Phase15Family;\n  full:Phase2Metrics;oos:Phase2Metrics;walkForwardYears:Phase2Year[];\n  costStress:{costBps:number;metrics:Phase2Metrics}[];delayStress:{delay:number;metrics:Phase2Metrics}[];\n  regime:{id:string;label:string;start:string;end:string;metrics:Phase2Metrics}[];\n  parameterNeighborhood:{label:string;metrics:Phase2Metrics}[];stabilityFloor:number;robust:boolean;operationalCapPassed:boolean;\n};\n\nconst leverageNumber`);
replace("lib/phase2.ts","  const rows=[] as any[];","  const rows:Phase2Row[]=[];");
replace("lib/phase2.ts","      const years=[] as any[];","      const years:Phase2Year[]=[];");

replace("lib/phase3.ts",
`type FamilyDef={id:Phase3Family;name:string;hypothesis:string;complexity:number;config:(row:ScreeningRow)=>StrategyConfig;neighbors:(row:ScreeningRow)=>StrategyConfig[]};\n\nconst OOS_START`,
`type FamilyDef={id:Phase3Family;name:string;hypothesis:string;complexity:number;config:(row:ScreeningRow)=>StrategyConfig;neighbors:(row:ScreeningRow)=>StrategyConfig[]};\ntype Phase3Year={year:number;metrics:M};\ntype Phase3Row={\n  ticker:CrossTicker;underlying:ScreeningRow["underlying"];leverage:ScreeningRow["leverage"];family:Phase3Family;name:string;hypothesis:string;complexity:number;incumbent:boolean;\n  oos:M;stress25:M;delay2:M;parameterNeighborhood:{label:string;metrics:M}[];stabilityFloor:number;yearly:Phase3Year[];maxYearActionDays:number;\n  regimes:{id:string;start:string;end:string;metrics:M}[];absoluteRobustness:boolean;noSevereRegression:boolean;materialValue:boolean;gatePassed:boolean;score:number;\n};\n\nconst OOS_START`);
replace("lib/phase3.ts","  const defs=familyDefs(group),rows:any[]=[];","  const defs=familyDefs(group),rows:Phase3Row[]=[];");
replace("lib/phase3.ts","      const yearly=[] as any[];","      const yearly:Phase3Year[]=[];");

replace("lib/phase4.ts","const yearly=[] as any[];","const yearly:{year:number;metrics:M;actionDays:number}[]=[];");

replace("tests/executive-controls.test.ts",
`const rec=(version:string,date:string,r:number,dd=0,position=.75,execution:any=null):any=>`,
`const rec=(version:string,date:string,r:number,dd=0,position=.75,execution:Phase5Record["execution"]|ForwardRecord["execution"]=null)=>`);
replace("tests/executive-controls.test.ts","delete (x as any).ticker;","Reflect.deleteProperty(x as object,\"ticker\");");
replace("tests/executive-controls.test.ts","delete (x as any).ticker;","Reflect.deleteProperty(x as object,\"ticker\");");

replace("scripts/approve-production.ts",",type ProductionConfig,type PlatformMode}",",type ProductionConfig}");
replace("tests/final-control-plane.test.mjs","const phase5=workflow(\"phase5-forward.yml\");\n","");
replace("tests/final-control-plane.test.mjs","const lifecycle=workflow(\"lifecycle-review.yml\");\n","");
replace("tests/phase2.test.ts","  const out:Bar[]=[];let p=100*mult,u=100*underMult;","  const out:Bar[]=[];let p=100*mult;");
replace("tests/phase2.test.ts","    u*=1+r;p*=1+r*mult/underMult;","    p*=1+r*mult/underMult;");
replace("app/page.tsx","  operationalCandidate,\n","");
{
  const path="app/page.tsx",text=read(path),marker="\nfunction RoadmapView(){",idx=text.indexOf(marker);
  if(idx<0)throw new Error("Legacy RoadmapView marker not found");
  write(path,text.slice(0,idx).trimEnd()+"\n");
}

console.log("Re-Audit 4 lint remediation applied");
