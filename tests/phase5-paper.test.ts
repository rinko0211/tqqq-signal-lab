import test from "node:test";
import assert from "node:assert/strict";
import { emptyPhase5Ledger, updatePhase5Ledger } from "../lib/phase5-forward.ts";
import { phase5PaperAccounts } from "../lib/phase5-paper.ts";

const weekdays=(start:string,count:number)=>{const out:string[]=[];const d=new Date(`${start}T00:00:00Z`);while(out.length<count){const day=d.getUTCDay();if(day!==0&&day!==6)out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}return out};
const dates=weekdays("2025-01-02",430);
const bar=(date:string,close:number)=>({date,open:close*.999,high:close*1.01,low:close*.99,close,adjClose:close,volume:1_000_000});
const series=(base:number,growth:number)=>dates.map((d,i)=>bar(d,base*Math.pow(1+growth,i)));
const payload={source:"test",retrievedAt:"2026-08-26T21:00:00.000Z",series:{UPRO:series(40,.0012),SSO:series(50,.0008),QLD:series(60,.0009),SPY:series(100,.0004),QQQ:series(120,.0006),VIX:dates.map(d=>bar(d,18))}} satisfies Parameters<typeof updatePhase5Ledger>[0];

test("phase5 paper accounts preserve frozen true-forward start and scale capital linearly",()=>{
  const ledger=updatePhase5Ledger(payload,emptyPhase5Ledger("2026-08-25T15:15:00.000Z"),"2026-08-26T21:00:00.000Z");
  const one=phase5PaperAccounts(ledger,1_000_000,150);
  const two=phase5PaperAccounts(ledger,2_000_000,150);
  assert.equal(one.length,3);
  assert.ok(one.every(x=>x.startDate==="2026-08-25"));
  for(let i=0;i<one.length;i++){
    assert.ok(Math.abs(two[i].equityJpy-one[i].equityJpy*2)<1e-6);
    assert.ok(Math.abs(two[i].totalReturn-one[i].totalReturn)<1e-12);
    assert.equal(two[i].observations,one[i].observations);
  }
});

test("empty Phase 5 ledger produces three awaiting paper accounts without fake history",()=>{
  const accounts=phase5PaperAccounts(emptyPhase5Ledger(),1_000_000,150);
  assert.equal(accounts.length,3);
  assert.ok(accounts.every(x=>x.observations===0&&x.equityJpy===1_000_000&&x.actions===0));
});
