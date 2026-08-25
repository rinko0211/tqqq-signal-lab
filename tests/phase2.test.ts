import test from "node:test";
import assert from "node:assert/strict";
import { phase2Bundle } from "../lib/phase2.ts";
import { type Bar } from "../lib/engine.ts";

const mk=(ticker:string,mult:number,underMult=1):Bar[]=>{
  const out:Bar[]=[];let p=100*mult,u=100*underMult;
  const start=new Date("2016-08-22T00:00:00Z");
  for(let i=0;i<2600;i++){
    const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);
    if([0,6].includes(d.getUTCDay()))continue;
    const r=.0004+.004*Math.sin(i/23);
    u*=1+r;p*=1+r*mult/underMult;
    const date=d.toISOString().slice(0,10);
    out.push({date,open:p*.999,high:p*1.01,low:p*.99,close:p,adjClose:p,volume:1_000_000});
  }
  return out;
};

test("phase2 stays bounded to four tickers and four families",()=>{
  const q=mk("QQQ",1),s=mk("SPY",1),v=q.map((b,i)=>({...b,open:20,high:20,low:20,close:20,adjClose:20,volume:0}));
  const payload={crossSeries:{TQQQ:mk("TQQQ",3),QLD:mk("QLD",2),UPRO:mk("UPRO",3),SSO:mk("SSO",2),QQQ:q,SPY:s,VIX:v}};
  const b=phase2Bundle(payload);
  assert.equal(b.rows.length,16);
  assert.deepEqual(b.summary.map(x=>x.ticker),["TQQQ","QLD","UPRO","SSO"]);
  assert.equal(b.families.length,4);
  assert.ok(b.rows.every(x=>x.costStress.length===4));
  assert.ok(b.rows.every(x=>x.delayStress.length===3));
  assert.ok(b.rows.every(x=>x.parameterNeighborhood.length===3));
});

test("phase2 never auto-promotes",()=>{
  const q=mk("QQQ",1),s=mk("SPY",1),v=q.map(b=>({...b,open:20,high:20,low:20,close:20,adjClose:20,volume:0}));
  const b=phase2Bundle({crossSeries:{TQQQ:mk("TQQQ",3),QLD:mk("QLD",2),UPRO:mk("UPRO",3),SSO:mk("SSO",2),QQQ:q,SPY:s,VIX:v}});
  assert.match(b.policy,/no Forward\/Production promotion/i);
  assert.ok(b.limitations.some(x=>/Forward evidence remains decisive/i.test(x)));
});
