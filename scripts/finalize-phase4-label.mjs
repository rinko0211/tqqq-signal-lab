import fs from "node:fs";
const path="app/phase5-ui.tsx";let s=fs.readFileSync(path,"utf8");
const changes=[
['<div className="panelHead"><div><em>DAILY CONTROL BOARD</em><h2>ProductionとChallengerを混同しない</h2></div><span>Productionだけが実運用判断。Challengerは比較観測。</span></div>','<div className="panelHead"><div><em>DAILY CONTROL BOARD</em><h2>運用基準とChallengerを混同しない</h2></div><span>{formalProduction ? "正式Productionだけが実運用判断。" : "現在はOperational Baselineが日次判断基準。"} Challengerは比較観測。</span></div>'],
['[<Chip key="p" tone="ok">PRODUCTION</Chip>, `${production?.ticker || "TQQQ"} / ${production?.version || production?.strategy || "VS13"}`','[<Chip key="p" tone={formalProduction?"ok":"warn"}>{formalProduction?"PRODUCTION":"BASELINE"}</Chip>, `${production?.ticker || "TQQQ"} / ${production?.version || production?.strategy || "VS13"}`']
];
for(const[from,to]of changes){const n=s.split(from).length-1;if(n!==1)throw new Error(`expected one anchor, got ${n}`);s=s.replace(from,to)}
fs.writeFileSync(path,s);console.log("Final Phase 4 label patched");
