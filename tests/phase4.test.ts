import test from "node:test";
import assert from "node:assert/strict";
import { phase4Bundle } from "../lib/phase4.ts";

const bar=(date:string,close:number)=>({date,open:close,high:close,low:close,close,adjClose:close,volume:1});
const dates=Array.from({length:500},(_,i)=>{const d=new Date(Date.UTC(2019,0,2));d.setUTCDate(d.getUTCDate()+i*1);return d}).filter(d=>![0,6].includes(d.getUTCDay())).slice(0,350).map(d=>d.toISOString().slice(0,10));
const series=(base:number,growth:number)=>dates.map((d,i)=>bar(d,base*Math.pow(1+growth,i)));
const payload:any={source:"test",crossSeries:{TQQQ:series(10,.002),QLD:series(20,.0015),QQQ:series(100,.001),UPRO:series(30,.0017),SSO:series(40,.0012),SPY:series(100,.0008),VIX:dates.map(d=>bar(d,18))}};

test("phase4 preserves one allocator across A/B and operational accounting",()=>{
  const b=phase4Bundle(payload);
  assert.equal(b.results.length,2);
  assert.deepEqual(b.results.map(x=>x.variant),["PHASE_4A_COMMON","PHASE_4B_NATIVE_ENHANCED"]);
  for(const r of b.results){
    assert.ok(Number.isFinite(r.oos.cagr));
    assert.ok(r.oos.actionDaysPerYear>=0);
    assert.ok(r.oos.brokerOrdersPerYear>=r.oos.actionDaysPerYear);
    assert.ok(r.maxYearActionDays>=0);
  }
  assert.equal(b.allocator.relativeMomentumDays,63);
  assert.equal(b.allocator.switchConfirm,3);
  assert.equal(b.allocator.reriskConfirm,3);
});
