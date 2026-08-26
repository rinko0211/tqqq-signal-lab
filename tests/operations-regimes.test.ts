import test from "node:test";
import assert from "node:assert/strict";
import { signals, STRATEGIES, type Dataset } from "../lib/engine.ts";
import { earliestLegalExecutionDate } from "../lib/execution-integrity.ts";

const weekdays=(start:string,count:number)=>{const out:string[]=[];const d=new Date(`${start}T00:00:00Z`);while(out.length<count){if(![0,6].includes(d.getUTCDay()))out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}return out};
const mk=(mode:"bull"|"bear"|"sideways"|"crash"|"recovery"|"highvol"|"lowvol"):Dataset=>{
  const dates=weekdays("2025-01-02",320);let q=100,s=100,t=100;
  const days=dates.map((date,i)=>{
    let r=.0003;
    if(mode==="bull")r=.001;
    if(mode==="bear")r=-.0008;
    if(mode==="sideways")r=.003*Math.sin(i/7);
    if(mode==="crash")r=i>270&&i<285?-.035:.0004;
    if(mode==="recovery")r=i<270?-.0005:i<285?-.025:.012;
    if(mode==="highvol")r=.015*Math.sin(i*.8);
    if(mode==="lowvol")r=.00045+.0005*Math.sin(i/20);
    q*=1+r;s*=1+r*.8;t*=1+r*3;
    const v=mode==="highvol"||mode==="crash"?38:mode==="lowvol"?12:18;
    const bar=(p:number)=>({date,open:p*(1-r*.2),high:p*1.01,low:p*.99,close:p,adjClose:p,volume:1_000_000});
    return{date,tqqq:bar(t),qqq:bar(q),spy:bar(s),vix:{...bar(v),open:v,high:v,low:v,close:v,adjClose:v,volume:0}};
  });
  return{days,issues:[],source:"test",precision:"next-open",tickers:{} as any};
};

for(const mode of ["bull","bear","sideways","crash","recovery","highvol","lowvol"] as const){
  test(`signal remains finite and bounded in ${mode} regime`,()=>{
    const out=signals(mk(mode).days,STRATEGIES.defensive);
    assert.ok(out.length>200);
    for(const s of out.slice(-40)){
      assert.ok(Number.isFinite(s.score));assert.ok(s.score>=0&&s.score<=100);
      assert.ok(Number.isFinite(s.target));assert.ok(s.target>=0&&s.target<=1);
      assert.ok(typeof s.regime==="string"&&s.regime.length>0);
    }
  });
}

test("delayed close cannot retroactively fill an already-passed open",()=>{
  assert.equal(earliestLegalExecutionDate("2026-08-25","2026-08-26T14:00:00Z"),"2026-08-27"); // 10:00 ET
  assert.equal(earliestLegalExecutionDate("2026-08-25","2026-08-26T12:00:00Z"),"2026-08-26"); // 08:00 ET
});

test("execution guard respects New York DST clock rather than fixed UTC",()=>{
  // 13:00 UTC = 09:00 EDT in July, before open. 14:00 UTC = 09:00 EST in January, before open.
  assert.equal(earliestLegalExecutionDate("2026-07-14","2026-07-15T13:00:00Z"),"2026-07-15");
  assert.equal(earliestLegalExecutionDate("2026-01-13","2026-01-14T14:00:00Z"),"2026-01-14");
});

test("weekend recording never creates a weekend execution date",()=>{
  const d=earliestLegalExecutionDate("2026-08-28","2026-08-29T16:00:00Z");
  assert.equal(new Date(`${d}T12:00:00Z`).getUTCDay(),1);
});
