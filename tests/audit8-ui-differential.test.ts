import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {derivePrimaryAction,type PrimaryActionCode,type PrimaryActionResult} from "../lib/primary-action.ts";

/* Audit 8 UI differential discovery.
 * Expected action codes are fixture-local literals. This file imports no
 * authority validator, market calendar, freshness helper, or ledger validator.
 * The UI projection below is not an oracle: it only models the direct field
 * mapping that app/page.tsx is required to use from derivePrimaryAction().
 */
type Fx={signal:any;status:any;forward:any;production:any;now:string;holdings:{ratio?:string;ticker?:string;version?:string}};
const G="2026-08-26T21:10:00.000Z";
const ID={ticker:"TQQQ",strategy:"Volatility Shield 13%",version:"VS13-v1.0"};
const authoritativeForward=JSON.parse(fs.readFileSync("public/data/forward-ledger.json","utf8"));
const clone=<T>(x:T):T=>structuredClone(x);
const base=():Fx=>({
  signal:{generatedAt:G,dataDate:"2026-08-26",platformMode:"RESEARCH",assetTicker:ID.ticker,strategy:ID.strategy,strategyVersion:ID.version,state:"latest",signal:{date:"2026-08-26",target:.75,previousTarget:.5,executionDate:"2026-08-27"}},
  status:{generatedAt:G,actionStatus:"success",marketDataDate:"2026-08-26",signalDate:"2026-08-26",state:"latest",errors:[]},
  forward:{...clone(authoritativeForward),updatedAt:G},
  production:{schemaVersion:1,mode:"RESEARCH",selectedTicker:null,selectedStrategy:null,strategyVersion:null,approvedByHuman:false,approvalDate:null,effectiveDate:null,lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-24T00:00:00.000Z"},
  now:"2026-08-27T12:00:00.000Z",holdings:{ratio:"50"}
});
const act=(f:Fx)=>derivePrimaryAction(f);
const uiProjection=(r:PrimaryActionResult)=>({code:r.code,action:r.message,target:r.target,currentTicker:r.currentTicker,currentVersion:r.currentVersion,actual:r.actual,holdingsMatch:r.holdingsMatch,executionDate:r.executionDate,signalUnsafe:r.signalUnsafe});

function setMode(f:Fx,mode:"RESEARCH"|"DECISION"|"PRODUCTION",identity?:{ticker:string;strategy:string;version:string}){
  f.production.mode=mode;f.signal.platformMode=mode;
  if(identity){
    f.production.selectedTicker=identity.ticker;f.production.selectedStrategy=identity.strategy;f.production.strategyVersion=identity.version;
    f.production.approvedByHuman=true;f.production.approvalDate="2026-08-25";f.production.effectiveDate="2026-08-25";f.production.updatedAt="2026-08-25T21:00:00.000Z";
    f.signal.assetTicker=identity.ticker;f.signal.strategy=identity.strategy;f.signal.strategyVersion=identity.version;
  }
}

test("A8 UI differential: actual page consumes the product entrypoint without a second action decision tree",()=>{
  const page=fs.readFileSync("app/page.tsx","utf8");
  assert.match(page,/import\s*\{\s*derivePrimaryAction\s*\}\s*from\s*"\.\.\/lib\/primary-action"/);
  assert.equal((page.match(/derivePrimaryAction\s*\(/g)||[]).length,1,"UI must have exactly one product action entrypoint call");
  const deriveCall=page.match(/primaryAction\s*=\s*derivePrimaryAction\s*\(\s*\{[\s\S]*?\}\s*\)/)?.[0]||"";
  assert.ok(deriveCall,"UI must assign derivePrimaryAction() to primaryAction");
  for(const [key,value] of [["signal","dailySignal"],["status","runtimeStatus"],["forward","forwardLedger"],["production","productionConfig"],["now","now\\.toISOString\\(\\)"]])
    assert.match(deriveCall,new RegExp(`${key}\\s*:\\s*${value}`));
  assert.match(deriveCall,/\bholdings\b/);
  for(const [lhs,rhs] of [["target","target"],["currentTicker","currentTicker"],["currentVersion","currentVersion"],["actual","actual"],["executionDate","executionDate"],["signalUnsafe","signalUnsafe"]])
    assert.match(page,new RegExp(`\\b${lhs}\\s*=\\s*primaryAction\\.${rhs}\\b`));
  assert.match(page,/\baction\s*=\s*primaryAction\.message\b/);
  const signalViewCall=page.match(/<SignalView[\s\S]*?\/>/)?.[0]||"";
  assert.match(signalViewCall,/\baction\s*=\s*\{\s*action\s*\}/);
  assert.match(signalViewCall,/\bactual\s*=\s*\{\s*actual\s*\}/);
});

test("A8 UI differential: literal oracle and UI projection agree over the reachable action surface",()=>{
  const cases:{name:string;fx:Fx;expected:PrimaryActionCode}[]=[];
  let f=base();cases.push({name:"increase",fx:f,expected:"INCREASE"});
  f=base();f.holdings.ratio="90";cases.push({name:"reduce",fx:f,expected:"REDUCE"});
  f=base();f.holdings.ratio="75";cases.push({name:"at-target hold",fx:f,expected:"HOLD"});
  f=base();f.signal.signal.previousTarget=.75;cases.push({name:"no-change hold",fx:f,expected:"HOLD"});
  f=base();f.holdings.ratio="";cases.push({name:"target only",fx:f,expected:"TARGET_ONLY"});
  f=base();f.holdings={ratio:"50",ticker:"UPRO",version:"UPRO-SPBT-v1.0"};cases.push({name:"re-enter",fx:f,expected:"REENTER_HOLDINGS"});
  f=base();f.now="2026-08-27T14:00:00.000Z";cases.push({name:"expired",fx:f,expected:"NO_ACTION_EXPIRED"});
  f=base();f.status.generatedAt="2026-08-26T21:09:59.000Z";cases.push({name:"check data",fx:f,expected:"CHECK_DATA"});
  for(const c of cases){
    const product=act(c.fx),ui=uiProjection(product);
    assert.equal(product.code,c.expected,c.name);
    assert.equal(ui.code,c.expected,c.name);
    assert.equal(ui.action,product.message,c.name);
    assert.equal(ui.target,product.target,c.name);
    assert.equal(ui.currentTicker,product.currentTicker,c.name);
    assert.equal(ui.currentVersion,product.currentVersion,c.name);
    assert.equal(ui.actual,product.actual,c.name);
  }
});

test("A8 UI differential: the finite UI mapping preserves every normalized action code including WAIT",()=>{
  const seed=act(base());
  const domain:PrimaryActionCode[]=["INCREASE","REDUCE","HOLD","TARGET_ONLY","REENTER_HOLDINGS","WAIT","NO_ACTION_EXPIRED","CHECK_DATA"];
  for(const code of domain){
    const synthetic={...seed,code,message:`ui-${code}`} as PrimaryActionResult;
    const ui=uiProjection(synthetic);
    assert.equal(ui.code,code);assert.equal(ui.action,`ui-${code}`);
  }
});

test("A8 UI differential: equivalent supported mode paths cannot alter the observable action",()=>{
  const research=base();
  const decision=base();setMode(decision,"DECISION");
  assert.equal(act(research).code,"INCREASE");assert.equal(act(decision).code,"INCREASE");
  assert.equal(uiProjection(act(research)).code,uiProjection(act(decision)).code);

  const vs12={ticker:"TQQQ",strategy:"Volatility Shield 12%",version:"VS12-v1.0"};
  const prod=base();setMode(prod,"PRODUCTION",vs12);prod.holdings={ratio:"50",ticker:"TQQQ",version:"VS12-v1.0"};
  const pending=clone(prod);pending.production.mode="DECISION";pending.signal.platformMode="DECISION";
  assert.equal(act(prod).code,"INCREASE");assert.equal(act(pending).code,"INCREASE");
  assert.equal(uiProjection(act(prod)).code,uiProjection(act(pending)).code);
});

test("A8 UI differential: one-field generation mutation and after-open observation change only to safe outcomes",()=>{
  const fresh=base();assert.equal(act(fresh).code,"INCREASE");
  const skew=base();skew.forward.updatedAt="2026-08-26T21:09:59.000Z";assert.equal(act(skew).code,"CHECK_DATA");
  const expired=base();expired.now="2026-08-27T14:00:00.000Z";assert.equal(act(expired).code,"NO_ACTION_EXPIRED");
  for(const x of [skew,expired])assert.notEqual(uiProjection(act(x)).code,"INCREASE");
});

test("A8 UI differential: authority corruption dominates expired-open and stale-holdings branches",()=>{
  const f=base();
  f.now="2026-08-27T14:00:00.000Z";
  f.holdings={ratio:"50",ticker:"UPRO",version:"UPRO-SPBT-v1.0"};
  f.status.generatedAt="2026-08-26T21:09:59.000Z";
  const product=act(f),ui=uiProjection(product);
  assert.equal(product.code,"CHECK_DATA");assert.equal(ui.code,"CHECK_DATA");
  assert.match(ui.action,/安全確認できません/);
});
