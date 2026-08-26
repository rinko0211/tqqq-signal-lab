import fs from "node:fs";
function replaceOnce(text,from,to,label){const n=text.split(from).length-1;if(n!==1)throw new Error(`${label}: expected exactly one anchor, got ${n}`);return text.replace(from,to)}
let p=fs.readFileSync("app/page.tsx","utf8");
p=replaceOnce(p,'import {IntegratedDashboard,Phase5ForwardPanel,Phase5PaperPanel,Phase5SystemStatus,type Phase5StatusFile} from "./phase5-ui";','import {IntegratedDashboard,Phase5ForwardPanel,Phase5PaperPanel,Phase5SystemStatus,type Phase5StatusFile} from "./phase5-ui";\nimport {LifecycleActionCenter,LifecycleGlobalBanner} from "./lifecycle-ui";','lifecycle import');
p=replaceOnce(p,'  ["dashboard", "運用ダッシュボード"],\n  ["forward", "Forward Test"],','  ["dashboard", "運用ダッシュボード"],\n  ["lifecycle", "Review / 次のAction"],\n  ["forward", "Forward Test"],','lifecycle tab');
p=replaceOnce(p,'        </section>\n        <div className="context">','        </section>\n        <LifecycleGlobalBanner/>\n        <div className="context">','global lifecycle banner');
p=replaceOnce(p,'        {tab==="forward" && <>','        {tab==="lifecycle" && <LifecycleActionCenter/>}\n        {tab==="forward" && <>','lifecycle panel');
fs.writeFileSync("app/page.tsx",p);
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
for(const t of ["tests/lifecycle-review.test.ts","tests/operations-regimes.test.ts","tests/production-lifecycle.test.ts"]){if(!pkg.scripts["test:core"].includes(t))pkg.scripts["test:core"]+=` ${t}`}
pkg.scripts["generate:lifecycle-review"]="node --experimental-strip-types scripts/generate-lifecycle-review.ts";
fs.writeFileSync("package.json",JSON.stringify(pkg,null,2)+"\n");
console.log("Final operations UI/package wiring applied");
