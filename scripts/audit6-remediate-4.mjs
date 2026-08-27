import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8"),write=(p,s)=>fs.writeFileSync(p,s);

function replaceOnce(p,from,to,label){
  const s=read(p);
  if(!s.includes(from))throw Error(`Audit6-4 target missing ${p}: ${label}`);
  if(s.indexOf(from)!==s.lastIndexOf(from))throw Error(`Audit6-4 target ambiguous ${p}: ${label}`);
  write(p,s.replace(from,to));
}

// The validator is intentionally ordered so RESEARCH+selection fails at the
// stronger RESEARCH-authority guard. Exercise CONFIG-007 from DECISION instead.
replaceOnce(
  "tests/audit6-final-failclosed.test.mjs",
  'assert.throws(()=>assertProductionConfigIntegrity({...DEFAULT_PRODUCTION_CONFIG,selectedTicker:"TQQQ",selectedStrategy:"Volatility Shield 13%",strategyVersion:"VS13-v1.0"}),/CONFIG-007/);',
  'assert.throws(()=>assertProductionConfigIntegrity({...DEFAULT_PRODUCTION_CONFIG,mode:"DECISION",selectedTicker:"TQQQ",selectedStrategy:"Volatility Shield 13%",strategyVersion:"VS13-v1.0"}),/CONFIG-007/);',
  "exercise unapproved-selection branch from DECISION",
);

// Avoid fragile regex escaping for exact source-contract checks.
{
  const p="tests/audit6-final-failclosed.test.mjs";
  let s=read(p);
  const start=s.indexOf('test("primary action requires authority plus a new signal change before its legal open"');
  if(start<0)throw Error("Audit6-4 missing primary-action test");
  const end=s.indexOf('\n});',start);
  if(end<0)throw Error("Audit6-4 malformed primary-action test");
  const replacement=`test("primary action requires authority plus a new signal change before its legal open",()=>{\n const ui=r("app/page.tsx");\n assert.ok(ui.includes('authorityUnsafe=Boolean(!dailySignal||!runtimeStatus||!productionConfigIsValid(productionConfig)||!forwardLedger)'));\n assert.ok(ui.includes('executionActionable=Boolean(signalChange&&executionWindow==="UPCOMING_OPEN")'));\n assert.match(ui,/!signalChange[\\s\\S]*現在Signalに新規売買指示はありません/);\n assert.match(ui,/!executionActionable[\\s\\S]*有効な次回始値の実行ウィンドウ/);\n});`;
  s=s.slice(0,start)+replacement+s.slice(end+4);
  write(p,s);
}

// Audit6's first missed-open regression predates the stronger signalChange
// abstraction. Preserve its semantic purpose while checking the new contract.
{
  const p="tests/audit6-recurring-failures.test.ts";
  let s=read(p);
  const needle='assert.match(line,/signal&&Math\\.abs\\(signal\\.target-signal\\.previousTarget\\)/);';
  if(!s.includes(needle))throw Error("Audit6-4 missing old missed-open assertion");
  s=s.replace(needle,'assert.ok(p.includes(\'signalChange=Boolean(signal&&Math.abs(signal.target-signal.previousTarget)>=.001)\'));\n  assert.ok(line.includes(\'signalChange&&executionWindow==="OPEN_PASSED"\'));');
  write(p,s);
}

console.log("Audit 6 regression contracts aligned with strengthened implementation");
