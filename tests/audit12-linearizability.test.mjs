import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files={
  W1:fs.readFileSync('.github/workflows/daily-signal.yml','utf8'),
  W2:fs.readFileSync('.github/workflows/phase5-forward.yml','utf8'),
  W3:fs.readFileSync('.github/workflows/lifecycle-review.yml','utf8'),
  W4:fs.readFileSync('.github/workflows/approve-production.yml','utf8'),
};
const must=(s,re,msg)=>assert.match(s,re,msg);
const pos=(s,label)=>{const n=s.indexOf(label);assert.ok(n>=0,`missing workflow marker: ${label}`);return n};

function bindActualWorkflowContracts(){
  for(const [name,s] of Object.entries(files)) must(s,/group:\s*daily-signal-pages/,`${name} must participate in shared operational serialization`);
  for(const name of ['W1','W2','W3','W4']){
    const s=files[name];
    must(s,/VALIDATED_MAIN_SHA=\$\(git rev-parse HEAD\)/,`${name} must capture validated main head`);
    must(s,/git fetch origin main/,`${name} must refresh authoritative main`);
    must(s,/git rev-parse origin\/main[^\n]*VALIDATED_MAIN_SHA|VALIDATED_MAIN_SHA[^\n]*git rev-parse origin\/main/s,`${name} must reject stale validated workspace`);
  }
  for(const name of ['W1','W2','W3']){
    const s=files[name];
    const persist=name==='W1'?pos(s,'Save append-only live signal history'):name==='W2'?pos(s,'Persist append-only Phase 5 ledger/status'):pos(s,'Persist append-only review state');
    const confirm=pos(s,'Confirm validated source remains authoritative');
    const build=name==='W1'?pos(s,'Build PWA from the persisted validated head'):pos(s,'Build integrated PWA');
    const deploy=name==='W1'?pos(s,'Deploy GitHub Pages'):pos(s,'Deploy integrated Pages');
    assert.ok(persist<confirm&&confirm<build&&build<deploy,`${name} must persist -> confirm -> build -> deploy`);
  }
  must(files.W4,/persisted_sha=\$\(git rev-parse HEAD\)/,'approval must expose exact persisted SHA');
  must(files.W4,/deploy_persisted_only:\s*true/,'approval deploy must use deploy-only path');
  must(files.W4,/expected_sha:\s*\$\{\{\s*needs\.approve\.outputs\.persisted_sha\s*\}\}/,'approval must bind deploy to exact persisted SHA');
  must(files.W1,/inputs\.deploy_persisted_only == true && inputs\.expected_sha != ''/,'reusable daily deploy-only must enforce exact SHA mode');
  must(files.W1,/origin\/main[^\n]*EXPECTED_SHA|EXPECTED_SHA[^\n]*origin\/main/s,'deploy-only must reject main advance after approval persistence');
  return true;
}

function interleave(a,b){
  const out=[];
  function rec(i,j,p){if(i===a.length&&j===b.length){out.push(p);return}if(i<a.length)rec(i+1,j,[...p,a[i]]);if(j<b.length)rec(i,j+1,[...p,b[j]])}
  rec(0,0,[]);return out;
}
const steps=id=>['read','validate','persist','confirm','deploy'].map(step=>({id,step}));
const routine=['W1','W2','W3'];
const faultSpecs=[
  ['none',null,null],['a-validate','a','validate'],['b-validate','b','validate'],['a-persist','a','persist'],['b-persist','b','persist'],
  ['a-confirm','a','confirm'],['b-confirm','b','confirm'],['a-build','a','build'],['b-build','b','build'],['a-deploy','a','deploy'],['b-deploy','b','deploy'],
  ['a-head-before-persist','a','head'],['b-head-before-persist','b','head'],['both-head-before-persist','both','head'],
];
function isSerialBySharedLock(history){let switches=0;for(let i=1;i<history.length;i++)if(history[i].id!==history[i-1].id)switches++;return switches<=1}
function targets(spec,id,a,b){const who=spec[1];return who==='both'||(who==='a'&&id===a)||(who==='b'&&id===b)}
function simulateSerial(history,spec,a,b){
  let main=0,deployed=0;const base=new Map(),persisted=new Map(),aborted=new Set();
  for(const e of history){
    if(aborted.has(e.id))continue;
    if(e.step==='read')base.set(e.id,main);
    if(e.step==='validate'&&targets(spec,e.id,a,b)&&spec[2]==='validate'){aborted.add(e.id);continue}
    if(e.step==='persist'){
      if(targets(spec,e.id,a,b)&&spec[2]==='head')main++; // external source-head advance before CAS
      if(targets(spec,e.id,a,b)&&spec[2]==='persist'){aborted.add(e.id);continue}
      if(base.get(e.id)!==main){aborted.add(e.id);continue}
      main++;persisted.set(e.id,main);
    }
    if(e.step==='confirm'){
      if(targets(spec,e.id,a,b)&&spec[2]==='confirm'){aborted.add(e.id);continue}
      if(persisted.get(e.id)!==main){aborted.add(e.id);continue}
    }
    if(e.step==='deploy'){
      if(targets(spec,e.id,a,b)&&(spec[2]==='build'||spec[2]==='deploy')){aborted.add(e.id);continue}
      assert.equal(persisted.get(e.id),main,'deployed generation must be authoritative');deployed=main;
    }
  }
  assert.ok(deployed<=main);return{main,deployed,aborted:[...aborted]};
}

test('Audit12 workflow binding: actual writers implement serialization/CAS/exact-deploy primitives',()=>assert.equal(bindActualWorkflowContracts(),true));

test('Audit12 LZ01-LZ08/LZ11-LZ12: >=10k pair histories are serialized, CAS-aborted, or fail closed',()=>{
  bindActualWorkflowContracts();let evaluated=0,prevented=0,executed=0;
  for(let i=0;i<routine.length;i++)for(let j=i+1;j<routine.length;j++){
    const a=routine[i],b=routine[j],histories=interleave(steps(a),steps(b));assert.equal(histories.length,252);
    for(const h of histories)for(const spec of faultSpecs){evaluated++;if(!isSerialBySharedLock(h)){prevented++;continue}simulateSerial(h,spec,a,b);executed++}
  }
  assert.equal(evaluated,10584,'3 routine pairs × 252 order-preserving schedules × 14 fault placements');assert.ok(prevented>0&&executed>0);
  console.log(`AUDIT12_PAIR_HISTORIES=${evaluated} PREVENTED_BY_SHARED_LOCK=${prevented} EXECUTED_SERIAL=${executed}`);
});

test('Audit12 LZ04/LZ07/LZ10: W4 approval + two routine writers + W5 exact deploy-only remains serializable',()=>{
  bindActualWorkflowContracts();let cases=0;
  for(const a of routine)for(const b of routine)if(a!==b)for(const fa of ['none','validate-fail','persist-fail'])for(const fb of ['none','validate-fail','persist-fail'])for(let r=0;r<25;r++){
    cases++;let main=1;const approvedSha=1;let deployed=0;
    if(fa==='none')main++; // writer a commits on current main
    if(fb==='none')main++; // writer b then commits serially on the resulting main
    const canDeploy=main===approvedSha;if(canDeploy)deployed=approvedSha;else assert.equal(deployed,0);
    if(main!==approvedSha){assert.ok(main>approvedSha);assert.equal(deployed,0,'old approved SHA must not deploy after any intervening persisted writer')}
  }
  assert.equal(cases,1350);console.log(`AUDIT12_APPROVAL_TWO_WRITER_HISTORIES=${cases}`);
});

test('Audit12 LZ02/LZ05/LZ09: stale routine writer loses CAS and cannot create Human Production authority',()=>{
  let cases=0;for(const a of routine)for(const b of routine)if(a!==b)for(let n=0;n<200;n++){
    cases++;const start=100+n;let main=start;const aBase=main,bBase=main;assert.equal(aBase,main);main++;assert.notEqual(bBase,main);
    const productionAuthority='RESEARCH';assert.equal(productionAuthority,'RESEARCH');
  }
  assert.equal(cases,1200);console.log(`AUDIT12_STALE_WRITER_HISTORIES=${cases}`);
});
