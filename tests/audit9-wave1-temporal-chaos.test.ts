import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {derivePrimaryAction,type PrimaryActionCode} from "../lib/primary-action.ts";

/*
 * Audit 9 Wave 1 — deterministic temporal/recovery/chaos sequence discovery.
 *
 * The expected sequence behavior is fixture-local. This file intentionally
 * imports no market calendar, freshness, Production validator, authority
 * helper, or ledger validator. Product code under test may use those modules.
 */

const SEED=0xA9202601;
const SESSION_COUNT=500;
const BASE_ID={ticker:"TQQQ",strategy:"Volatility Shield 13%",version:"VS13-v1.0"};
const ALT_ID={ticker:"TQQQ",strategy:"Volatility Shield 12%",version:"VS12-v1.0"};
const authoritativeForward=JSON.parse(fs.readFileSync("public/data/forward-ledger.json","utf8"));
const researchProduction={schemaVersion:1,mode:"RESEARCH",selectedTicker:null,selectedStrategy:null,strategyVersion:null,approvedByHuman:false,approvalDate:null,effectiveDate:null,lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-24T00:00:00.000Z"};
const clone=<T>(x:T):T=>structuredClone(x);

// Fixture-local NYSE full-day closures for the sequence window. The oracle does
// not import the product market calendar. The generated 500-session window runs
// from 2026-08-31 into 2028.
const CLOSED=new Set([
  "2026-09-07","2026-11-26","2026-12-25",
  "2027-01-01","2027-01-18","2027-02-15","2027-03-26","2027-05-31","2027-06-18","2027-07-05","2027-09-06","2027-11-25","2027-12-24",
  "2028-01-17","2028-02-21","2028-04-14","2028-05-29","2028-06-19","2028-07-04","2028-09-04",
]);
const iso=(d:Date)=>d.toISOString().slice(0,10);
function isFixtureSession(d:Date){const day=d.getUTCDay();return day!==0&&day!==6&&!CLOSED.has(iso(d))}
function buildSessions(start:string,count:number){
  const out:string[]=[];let d=new Date(`${start}T00:00:00.000Z`);
  while(out.length<count){if(isFixtureSession(d))out.push(iso(d));d=new Date(d.getTime()+86400000)}
  return out;
}
const sessions=buildSessions("2026-08-31",SESSION_COUNT+4);
const generationAt=(date:string)=>`${date}T22:10:00.000Z`;
const preOpen=(date:string)=>`${date}T12:00:00.000Z`;
const targetFor=(i:number)=>Math.floor(Math.max(i,0)/13)%2===0?.50:.75;
const previousTargetFor=(i:number)=>i<=0?.50:targetFor(i-1);
const expectedBaseline=(i:number):PrimaryActionCode=>{
  const target=targetFor(i),previous=previousTargetFor(i);
  if(Math.abs(target-previous)<.001)return "HOLD";
  return target>previous?"INCREASE":"REDUCE";
};
const isRiskChanging=(c:PrimaryActionCode)=>c==="INCREASE"||c==="REDUCE";

function researchFx(i:number){
  const date=sessions[i],next=sessions[i+1],g=generationAt(date);
  const target=targetFor(i),previousTarget=previousTargetFor(i);
  return{
    signal:{generatedAt:g,dataDate:date,platformMode:"RESEARCH",assetTicker:BASE_ID.ticker,strategy:BASE_ID.strategy,strategyVersion:BASE_ID.version,state:"latest",signal:{date,target,previousTarget,executionDate:next}},
    status:{generatedAt:g,actionStatus:"success",marketDataDate:date,signalDate:date,state:"latest",errors:[]},
    forward:{...clone(authoritativeForward),updatedAt:g},
    production:clone(researchProduction),
    now:preOpen(next),
    holdings:{ratio:String(previousTarget*100)},
    // Deliberately unrelated research/display freshness. Audit 9 verifies this
    // cannot influence the operational action across the full sequence.
    freshnessDate:i%2?"1999-01-01":"2099-01-01",
  } as any;
}

function productionFx(i:number,id=ALT_ID){
  const f=researchFx(i);
  f.signal.platformMode="PRODUCTION";
  f.signal.assetTicker=id.ticker;f.signal.strategy=id.strategy;f.signal.strategyVersion=id.version;
  f.production={schemaVersion:1,mode:"PRODUCTION",selectedTicker:id.ticker,selectedStrategy:id.strategy,strategyVersion:id.version,approvedByHuman:true,approvalDate:"2026-08-25",effectiveDate:"2026-08-25",lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-25T21:00:00.000Z"};
  f.holdings={ratio:String(previousTargetFor(i)*100),ticker:id.ticker,version:id.version};
  return f;
}
const act=(f:any)=>derivePrimaryAction(f).code;

function staleOperationalFx(i:number){
  // Prior market data is published only after the current session close. The
  // resulting explicit execution date is still the next legal open, but the
  // operational data itself is one completed session stale. A fresh display
  // date is supplied to ensure it cannot mask the stale authority.
  const f=researchFx(i);
  const staleDate=sessions[i-1],publicationDate=sessions[i],executionDate=sessions[i+1];
  const g=generationAt(publicationDate);
  f.signal.generatedAt=g;f.status.generatedAt=g;f.forward.updatedAt=g;
  f.signal.dataDate=staleDate;f.status.marketDataDate=staleDate;f.status.signalDate=staleDate;
  f.signal.signal.date=staleDate;f.signal.signal.executionDate=executionDate;
  f.now=preOpen(executionDate);f.freshnessDate=publicationDate;
  return f;
}

function lcg(seed:number){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s}}

test("Audit 9 Wave 1 mechanism is sequence-based and oracle-independent",()=>{
  const src=fs.readFileSync("tests/audit9-wave1-temporal-chaos.test.ts","utf8");
  const imports=src.split("\n").filter(x=>x.startsWith("import ")).join("\n");
  assert.match(imports,/primary-action\.ts/);
  for(const forbidden of ["market-calendar","engine.ts","operational-authority","production.ts","forward.ts","execution-integrity","lifecycle-review","production-health-review"])
    assert.doesNotMatch(imports,new RegExp(`from [\\"'].*${forbidden}`));
  assert.equal(SESSION_COUNT,500);
  assert.ok(sessions[SESSION_COUNT-1].slice(0,4)>sessions[0].slice(0,4),"sequence must span multiple calendar years");
});

test("Audit 9 Wave 1: 500-session fault→recovery action-authority chaos",()=>{
  const rnd=lcg(SEED);
  const counts=Array(8).fill(0) as number[];
  let riskBaselines=0,recoveries=0;

  for(let i=2;i<SESSION_COUNT+2;i++){
    const seq=i-2;
    const clean=researchFx(i);
    const cleanExpected=expectedBaseline(i);
    const cleanCode=act(clean);
    assert.equal(cleanCode,cleanExpected,`session ${seq} clean baseline ${sessions[i]}`);
    if(isRiskChanging(cleanCode))riskBaselines++;

    // Research/display freshness swings from decades stale to decades future on
    // every clean session; operational action must remain unchanged.
    const oppositeFreshness=clone(clean);oppositeFreshness.freshnessDate=i%2?"2099-01-01":"1999-01-01";
    assert.equal(act(oppositeFreshness),cleanCode,`session ${seq} display freshness independence`);

    const family=rnd()%8;counts[family]++;
    let broken:any;let expectedFault:PrimaryActionCode="CHECK_DATA";

    switch(family){
      case 0:{
        broken=clone(clean);broken.holdings.ratio=["oops","-1","101"][seq%3];
        break;
      }
      case 1:{
        broken=clone(clean);broken.signal.signal.target=seq%2?-0.25:1.25;
        break;
      }
      case 2:{
        broken=staleOperationalFx(i);
        break;
      }
      case 3:{
        broken=clone(clean);broken.now=`${sessions[i]}T19:00:00.000Z`;
        break;
      }
      case 4:{
        broken=clone(clean);broken.signal.signal.executionDate=sessions[i+2];
        break;
      }
      case 5:{
        broken=clone(clean);delete broken.signal.signal;
        break;
      }
      case 6:{
        const p=productionFx(i);broken=clone(p);broken.holdings={ratio:p.holdings.ratio};expectedFault="REENTER_HOLDINGS";
        break;
      }
      case 7:{
        broken=productionFx(i);broken.production.approvalDate=sessions[i+2];broken.production.effectiveDate=sessions[i+2];broken.production.updatedAt=generationAt(sessions[i+2]);
        break;
      }
      default:throw new Error("unreachable family");
    }

    const faultCode=act(broken);
    assert.equal(faultCode,expectedFault,`session ${seq} fault family ${family}`);
    assert.equal(isRiskChanging(faultCode),false,`T01: session ${seq} family ${family} must not change risk`);

    // Recovery is a new evaluation from coherent state, not reuse of the fault
    // result. Production-local-state fault recovers to tagged Production state;
    // all other families recover to the clean Research state.
    const recovery=family===6?productionFx(i):researchFx(i);
    const recoveredCode=act(recovery);
    assert.equal(recoveredCode,cleanExpected,`T02: session ${seq} family ${family} recovery must equal coherent sequence state`);
    recoveries++;
  }

  assert.equal(recoveries,SESSION_COUNT);
  assert.ok(riskBaselines>20,"long sequence must include many legitimate risk-changing baselines");
  for(const [family,count] of counts.entries())assert.ok(count>=40,`fault family ${family} must recur repeatedly; got ${count}`);
});

test("Audit 9 Wave 1: Production A→B→A stale local holdings do not bleed across episodes",()=>{
  const aStart=productionFx(80,BASE_ID);
  assert.equal(act(aStart),expectedBaseline(80));

  const b=productionFx(81,ALT_ID);
  b.holdings={ratio:String(previousTargetFor(81)*100),ticker:BASE_ID.ticker,version:BASE_ID.version};
  assert.equal(act(b),"REENTER_HOLDINGS","A holdings cannot be reused for B");
  const bRecovered=productionFx(81,ALT_ID);
  assert.equal(act(bRecovered),expectedBaseline(81));

  const aReturn=productionFx(320,BASE_ID);
  aReturn.holdings={ratio:String(previousTargetFor(320)*100),ticker:ALT_ID.ticker,version:ALT_ID.version};
  assert.equal(act(aReturn),"REENTER_HOLDINGS","old B holdings cannot bleed into later A re-entry");
  const aRecovered=productionFx(320,BASE_ID);
  assert.equal(act(aRecovered),expectedBaseline(320));
});

test("Audit 9 Wave 1: valid reaffirmation survives long time while future DECISION incumbent fails closed",()=>{
  const i=400;
  const reaffirm=productionFx(i,BASE_ID);
  reaffirm.production.approvalDate=sessions[i];
  reaffirm.production.effectiveDate="2026-08-25";
  reaffirm.production.updatedAt=generationAt(sessions[i]);
  assert.equal(act(reaffirm),expectedBaseline(i),"later valid approval may preserve earlier episode effectiveDate");

  const impossible=clone(reaffirm);
  impossible.production.mode="DECISION";impossible.signal.platformMode="DECISION";
  impossible.production.approvalDate=sessions[i+2];
  impossible.production.updatedAt=generationAt(sessions[i+2]);
  const code=act(impossible);
  assert.equal(code,"CHECK_DATA");
  assert.equal(isRiskChanging(code),false);

  const recovered=clone(reaffirm);recovered.production.mode="DECISION";recovered.signal.platformMode="DECISION";
  assert.equal(act(recovered),expectedBaseline(i),"DECISION-with-incumbent recovery must use current coherent authority");
});

test("Audit 9 Wave 1: missed-open state is not chased and a later clean signal is evaluated independently",()=>{
  const i=250;
  const changedIndex=Math.ceil(i/13)*13;
  const f=researchFx(changedIndex);
  assert.notEqual(targetFor(changedIndex),previousTargetFor(changedIndex),"fixture must be a target-change session");
  // 16:00Z is safely after the NYSE core open and before the close in both EDT
  // and EST, so this tests an expired open without simultaneously making the
  // prior-close operational data stale because a new close has completed.
  f.now=`${sessions[changedIndex+1]}T16:00:00.000Z`;
  assert.equal(act(f),"NO_ACTION_EXPIRED","expired legal open must not become a late chase");

  const later=researchFx(changedIndex+1);
  assert.equal(act(later),expectedBaseline(changedIndex+1),"later Daily state must be evaluated on its own signal, not stale missed action");
});
