import test from "node:test";
import assert from "node:assert/strict";
import { phase2CoreBundle } from "../lib/phase2-core.ts";
import { phase2StressBundle } from "../lib/phase2-stress.ts";
import { type Bar } from "../lib/engine.ts";

const mk=(ticker:string,mult:number,underMult=1):Bar[]=>{
  const out:Bar[]=[];let p=100*mult,u=100*underMult;
  const start=new Date("2016-08-22T00:00:00Z");
  // Keep the synthetic fixture intentionally small while still long enough
  // for 200DMA and the 2020+ OOS partition. This is a structure/invariant
  // test, not a performance backtest.
  for(let i=0;i<1700;i++){
    const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);
    if([0,6].includes(d.getUTCDay()))continue;
    const r=.0004+.004*Math.sin(i/23);
    u*=1+r;p*=1+r*mult/underMult;
    const date=d.toISOString().slice(0,10);
    out.push({date,open:p*.999,high:p*1.01,low:p*.99,close:p,adjClose:p,volume:1_000_000});
  }
  return out;
};

const payload=()=>{
  const q=mk("QQQ",1),s=mk("SPY",1),v=q.map(b=>({...b,open:20,high:20,low:20,close:20,adjClose:20,volume:0}));
  return{crossSeries:{TQQQ:mk("TQQQ",3),QLD:mk("QLD",2),UPRO:mk("UPRO",3),SSO:mk("SSO",2),QQQ:q,SPY:s,VIX:v}};
};

test("phase2A stays bounded to four tickers and four frozen families",()=>{
  const b=phase2CoreBundle(payload());
  assert.equal(b.rows.length,16);
  assert.deepEqual(b.summary.map(x=>x.ticker),["TQQQ","QLD","UPRO","SSO"]);
  assert.ok(b.rows.every(x=>x.operationalCapPassed));
  const primary=b.rows.filter(x=>["VS13_FIXED","VS13_LEVERAGE_SCALED_STOP"].includes(x.family));
  assert.equal(primary.length,8);
  assert.ok(primary.every(x=>x.parameterNeighborhood.length===3));
  assert.ok(b.limitations.some(x=>/not pristine holdout/i.test(x)));
});

test("phase2B limits stress testing to two production-oriented families",()=>{
  const b=phase2StressBundle(payload());
  assert.equal(b.rows.length,8);
  assert.deepEqual(b.summary.map(x=>x.ticker),["TQQQ","QLD","UPRO","SSO"]);
  assert.ok(b.rows.every(x=>x.costStress.length===4));
  assert.ok(b.rows.every(x=>x.delayStress.length===3));
  assert.ok(b.rows.every(x=>["VS13_FIXED","VS13_LEVERAGE_SCALED_STOP"].includes(x.family)));
  assert.ok(b.limitations.some(x=>/Forward remains decisive/i.test(x)));
});

test("phase2 never contains automatic promotion semantics",()=>{
  const a=phase2CoreBundle(payload());
  const b=phase2StressBundle(payload());
  assert.ok(a.limitations.some(x=>/No Forward or Production promotion/i.test(x)));
  assert.ok(b.limitations.some(x=>/No parameter selection or promotion/i.test(x)));
});
