import test from "node:test";
import assert from "node:assert/strict";
import { phase3Bundle } from "../lib/phase3.ts";
import type { Bar } from "../lib/engine.ts";

const make=(mult:number):Bar[]=>{const out:Bar[]=[];let p=100;const d=new Date("2016-01-01T00:00:00Z");for(let i=0;i<1900;i++){const x=new Date(d);x.setUTCDate(x.getUTCDate()+i);if([0,6].includes(x.getUTCDay()))continue;const r=.00035+.003*Math.sin(i/31);p*=1+r*mult;const date=x.toISOString().slice(0,10);out.push({date,open:p*.999,high:p*1.006,low:p*.994,close:p,adjClose:p,volume:1_000_000});}return out;};
const q=make(1),s=make(1),v=q.map(b=>({...b,open:18,high:18,low:18,close:18,adjClose:18,volume:0}));
const payload={crossSeries:{TQQQ:make(3),QLD:make(2),UPRO:make(3),SSO:make(2),QQQ:q,SPY:s,VIX:v}};

test("phase3 keeps Nasdaq research bounded",()=>{const b=phase3Bundle(payload,"NASDAQ");assert.equal(b.rows.length,8);assert.deepEqual(b.decisions.map(x=>x.ticker),["TQQQ","QLD"]);assert.equal(b.families.length,4);assert.ok(b.rows.every(x=>x.oos.actionDaysPerYear<=40||x.absoluteRobustness===false));assert.match(b.policy,/max one Native candidate/i);});
test("phase3 keeps S&P research bounded and does not promote",()=>{const b=phase3Bundle(payload,"SP500");assert.equal(b.rows.length,8);assert.deepEqual(b.decisions.map(x=>x.ticker),["UPRO","SSO"]);assert.equal(b.families.length,4);assert.ok(b.limitations.some(x=>/automatic promotion/i.test(x)));assert.ok(b.decisions.every(x=>x.candidate===null||typeof x.candidate==="string"));});
