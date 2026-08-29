import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {derivePrimaryAction,type PrimaryActionCode} from "../lib/primary-action.ts";

/* Audit 11 MR-01..MR-04. The oracle is relational: transformations must
 * preserve/strengthen safety. No product calendar/authority/ledger validator
 * is imported to calculate an expected answer. */

const SEED=0xA1120261;
const CASES={monotonic:2000,partialRepair:1500,translation:750,mode:750};
const TOTAL=Object.values(CASES).reduce((a,b)=>a+b,0);
const clone=<T>(x:T):T=>structuredClone(x);
const forward0=JSON.parse(fs.readFileSync("public/data/forward-ledger.json","utf8"));
const market=JSON.parse(fs.readFileSync("github-pages/public/data/market-data.json","utf8"));
const storedDates=(market.series.QQQ as any[]).map(x=>x.date as string).filter(d=>d>="2026-08-25"&&d<="2026-08-28");
const pairs=storedDates.slice(0,-1).map((d,i)=>[d,storedDates[i+1]] as const);
assert.ok(pairs.length>=3,"Audit 11 requires stored 2026-08-25..28 market sessions");
const researchProduction={schemaVersion:1,mode:"RESEARCH",selectedTicker:null,selectedStrategy:null,strategyVersion:null,approvedByHuman:false,approvalDate:null,effectiveDate:null,lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-24T00:00:00.000Z"};
const ID={ticker:"TQQQ",strategy:"Volatility Shield 13%",version:"VS13-v1.0"};
const ALT={ticker:"TQQQ",strategy:"Volatility Shield 12%",version:"VS12-v1.0"};
const risk=(x:PrimaryActionCode)=>x==="INCREASE"||x==="REDUCE";
function rng(seed:number){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s}}
const rnd=rng(SEED);
const choose=<T>(a:T[])=>a[rnd()%a.length];

function fx(pair:readonly[string,string],up:boolean,production=false){
  const [date,next]=pair,target=up?.75:.25,previous=.5,g=`${date}T22:10:00.000Z`;
  const out:any={
    signal:{generatedAt:g,dataDate:date,platformMode:production?"PRODUCTION":"RESEARCH",assetTicker:ID.ticker,strategy:ID.strategy,strategyVersion:ID.version,state:"latest",signal:{date,target,previousTarget:previous,executionDate:next}},
    status:{generatedAt:g,actionStatus:"success",marketDataDate:date,signalDate:date,state:"latest",errors:[]},
    forward:{...clone(forward0),updatedAt:g},
    production:clone(researchProduction),
    now:`${next}T12:00:00.000Z`,holdings:{ratio:"50"},freshnessDate:"2099-01-01"
  };
  if(production){out.production={schemaVersion:1,mode:"PRODUCTION",selectedTicker:ID.ticker,selectedStrategy:ID.strategy,strategyVersion:ID.version,approvedByHuman:true,approvalDate:"2026-08-25",effectiveDate:"2026-08-25",lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-25T21:00:00.000Z"};out.holdings={ratio:"50",ticker:ID.ticker,version:ID.version}}
  return out;
}
const act=(x:any)=>derivePrimaryAction(x).code;

type Mut={name:string;apply:(x:any)=>void};
function mutations(pair:readonly[string,string],production:boolean):Mut[]{const [,next]=pair;const base:Mut[]=[
  {name:"generation-skew",apply:x=>{x.status.generatedAt=x.status.generatedAt.replace("10:00.000Z","10:01.000Z")}},
  {name:"forward-anchor-loss",apply:x=>{x.forward.records=x.forward.records.slice(1)}},
  {name:"holdings-nonnumeric",apply:x=>{x.holdings.ratio="not-a-number"}},
  {name:"missed-open",apply:x=>{x.now=`${next}T16:00:00.000Z`}},
  {name:"execution-mismatch",apply:x=>{x.signal.signal.executionDate="2099-01-02"}},
  {name:"status-date-contradiction",apply:x=>{x.status.marketDataDate="2026-08-24"}},
  {name:"signal-date-contradiction",apply:x=>{x.signal.signal.date="2026-08-24"}},
  {name:"status-signal-date-contradiction",apply:x=>{x.status.signalDate="2026-08-24"}},
];
if(production)base.push(
  {name:"future-production-authority",apply:x=>{x.production.approvalDate="2026-09-01";x.production.effectiveDate="2026-09-01";x.production.updatedAt="2026-09-01T21:00:00.000Z"}},
  {name:"unregistered-production-identity",apply:x=>{x.production.strategyVersion="BOGUS-v1"}},
  {name:"stale-holdings-version",apply:x=>{x.holdings.version=ALT.version}},
);
return base}

function cleanRisk(pair:readonly[string,string],production:boolean){const x=fx(pair,Boolean(rnd()&1),production),c=act(x);assert.equal(risk(c),true,`seed=${SEED} coherent fixture must be risk-changing, got ${c}`);return{x,c}}

test(`Audit 11 mechanism independence and volume seed=${SEED}`,()=>{const src=fs.readFileSync("tests/audit11-primary-action-metamorphic.test.ts","utf8"),imports=src.split("\n").filter(x=>x.startsWith("import ")).join("\n");assert.match(imports,/primary-action\.ts/);for(const forbidden of ["market-calendar","production.ts","operational-authority","execution-integrity","forward.ts","production-lifecycle","production-health-review"])assert.doesNotMatch(imports,new RegExp(`from [\\"'].*${forbidden}`));assert.equal(TOTAL,5000)});

test(`MR-01 fault monotonicity ${CASES.monotonic} cases seed=${SEED}`,()=>{for(let i=0;i<CASES.monotonic;i++){const pair=choose(pairs),prod=Boolean(rnd()&1),{x}=cleanRisk(pair,prod),ms=mutations(pair,prod);const chosen=[...ms].sort(()=>Number(rnd()&1)-.5).slice(0,2+(rnd()%Math.min(3,ms.length-1)));let y=clone(x);for(const m of chosen){m.apply(y);const c=act(y);assert.equal(risk(c),false,`seed=${SEED} case=${i} after=${m.name} faults=${chosen.map(z=>z.name).join(",")} code=${c}`)}}});

test(`MR-02 partial repair / repair-order closure ${CASES.partialRepair} cases seed=${SEED}`,()=>{for(let i=0;i<CASES.partialRepair;i++){const pair=choose(pairs),prod=Boolean(rnd()&1),{x,c:baseline}=cleanRisk(pair,prod),ms=mutations(pair,prod);const a=ms[rnd()%ms.length];let b=ms[rnd()%ms.length];while(b===a)b=ms[rnd()%ms.length];const onlyA=clone(x);a.apply(onlyA);const onlyB=clone(x);b.apply(onlyB);const bothAB=clone(x);a.apply(bothAB);b.apply(bothAB);const bothBA=clone(x);b.apply(bothBA);a.apply(bothBA);for(const [label,z] of [[a.name,onlyA],[b.name,onlyB],[`${a.name}+${b.name}`,bothAB],[`${b.name}+${a.name}`,bothBA]] as const){const c=act(z);assert.equal(risk(c),false,`seed=${SEED} case=${i} partial=${label} code=${c}`)}assert.equal(act(clone(x)),baseline,`seed=${SEED} case=${i} fully repaired state must converge`)}});

test(`MR-03 stored-session translation ${CASES.translation} cases seed=${SEED}`,()=>{for(let i=0;i<CASES.translation;i++){const p1=choose(pairs),p2=choose(pairs),prod=Boolean(rnd()&1),up=Boolean(rnd()&1);const a=act(fx(p1,up,prod)),b=act(fx(p2,up,prod));assert.equal(risk(a),true,`seed=${SEED} case=${i} source translated fixture not actionable: ${a}`);assert.equal(b,a,`seed=${SEED} case=${i} ${p1.join("→")} vs ${p2.join("→")}`)}});

test(`MR-04 mode/incumbent equivalence ${CASES.mode} cases seed=${SEED}`,()=>{for(let i=0;i<CASES.mode;i++){const pair=choose(pairs),up=Boolean(rnd()&1);const r=fx(pair,up,false),d=clone(r);d.production={...clone(researchProduction),mode:"DECISION",updatedAt:r.production.updatedAt};d.signal.platformMode="DECISION";assert.equal(act(d),act(r),`seed=${SEED} case=${i} RESEARCH vs no-incumbent DECISION`);
  const p=fx(pair,up,true),di=clone(p);di.production.mode="DECISION";di.signal.platformMode="DECISION";assert.equal(act(di),act(p),`seed=${SEED} case=${i} PRODUCTION vs DECISION incumbent`);
  const m=choose(mutations(pair,true));const pm=clone(p),dm=clone(di);m.apply(pm);m.apply(dm);const pc=act(pm),dc=act(dm);assert.equal(risk(pc),false,`seed=${SEED} case=${i} production mutation=${m.name}`);assert.equal(risk(dc),false,`seed=${SEED} case=${i} decision mutation=${m.name}`);assert.equal(dc,pc,`seed=${SEED} case=${i} symmetric mutation=${m.name}`)}});
