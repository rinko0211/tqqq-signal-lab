import fs from "node:fs";
const p="tests/executive-ui-semantics.test.mjs",s=fs.readFileSync(p,"utf8");
const from='  assert.match(page,/signalUnsafe=Boolean\\(runtimeStatus\\?\\.state==="failed"\\|\\|fresh\\?\\.stale\\)/);';
const to='  assert.match(page,/authorityUnsafe=Boolean\\(!dailySignal\\|\\|!runtimeStatus\\|\\|!productionConfigIsValid\\(productionConfig\\)\\|\\|!forwardLedger\\)/);\n  assert.match(page,/signalUnsafe=Boolean\\(authorityUnsafe\\|\\|runtimeStatus\\?\\.state==="failed"\\|\\|fresh\\?\\.stale\\)/);';
if(!s.includes(from))throw Error("Audit6-5 stale executive UI assertion not found");
fs.writeFileSync(p,s.replace(from,to));
console.log("Audit 6 executive UI regression aligned with authority fail-closed contract");
