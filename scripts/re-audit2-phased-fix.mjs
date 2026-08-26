import fs from "node:fs";

function patch(path,replacements){
  let s=fs.readFileSync(path,"utf8");
  for(const [from,to,label] of replacements){
    if(s.includes(to))continue;
    const n=s.split(from).length-1;
    if(n!==1)throw new Error(`${path} ${label}: expected 1 anchor, got ${n}`);
    s=s.replace(from,to);
  }
  fs.writeFileSync(path,s);
}

patch("app/page.tsx",[
  [
    '  const assumption=bt?.assumption||EXECUTION_ASSUMPTION;\n  const changed=Math.abs(signal.target-signal.previousTarget)>.001,',
    '  const assumption=bt?.assumption||EXECUTION_ASSUMPTION;\n  const activeProduction=humanApproved&&platformMode!=="RESEARCH";\n  const decisionPending=activeProduction&&platformMode==="DECISION";\n  const changed=Math.abs(signal.target-signal.previousTarget)>.001,',
    "derive active Production UI state"
  ],
  [
    '<Status kind={signalUnsafe?"bad":platformMode==="PRODUCTION"&&humanApproved?"ok":"warn"}>{signalUnsafe?"データ安全確認待ち・売買禁止":platformMode==="PRODUCTION"&&humanApproved?"正式Production · Human Approved":"Operational Baseline · Research"}</Status>',
    '<Status kind={signalUnsafe?"bad":activeProduction?"ok":"warn"}>{signalUnsafe?"データ安全確認待ち・売買禁止":decisionPending?"正式Production継続中 · Decision Review Pending":activeProduction?"正式Production · Human Approved":"Operational Baseline · Research"}</Status>',
    "signal Production badge"
  ]
]);

patch("app/phase5-ui.tsx",[
  [
    '  const formalProduction = platformMode === "PRODUCTION" && humanApproved === true;\n',
    '  const activeProduction = humanApproved === true && platformMode !== "RESEARCH";\n  const decisionPending = activeProduction && platformMode === "DECISION";\n  const productionStateLabel = decisionPending ? "FORMAL PRODUCTION CONTINUES · DECISION REVIEW PENDING" : activeProduction ? "FORMAL PRODUCTION · HUMAN APPROVED" : "OPERATIONAL BASELINE · NOT FORMAL PRODUCTION";\n',
    "integrated active Production state"
  ],
  ['formalProduction ? "FORMAL PRODUCTION · HUMAN APPROVED" : "OPERATIONAL BASELINE · NOT FORMAL PRODUCTION"','productionStateLabel',"dashboard state label"],
  ['formalProduction ? "現在の正式運用" : "現在の日次運用基準"','activeProduction ? "現在の正式運用" : "現在の日次運用基準"',"dashboard heading"],
  ['formalProduction ? "ok" : "warn"','activeProduction ? "ok" : "warn"',"dashboard chip tone"],
  ['formalProduction ? "PRODUCTION" : "BASELINE"','activeProduction ? "PRODUCTION" : "BASELINE"',"dashboard chip label"],
  ['{formalProduction ? "正式ProductionはHuman Approval済みです。" : "このカードはOperational Baselineであり、正式Production承認状態ではありません。"}','{decisionPending ? "Human Decision review中も既存の正式Productionは継続しています。" : activeProduction ? "正式ProductionはHuman Approval済みです。" : "このカードはOperational Baselineであり、正式Production承認状態ではありません。"}',"dashboard explanatory note"],
  ['{formalProduction ? "正式Productionだけが実運用判断。" : "現在はOperational Baselineが日次判断基準。"}','{decisionPending ? "Decision review中も既存Productionが実運用判断を継続。" : activeProduction ? "正式Productionだけが実運用判断。" : "現在はOperational Baselineが日次判断基準。"}',"control board note"],
  ['<Chip key="p" tone={formalProduction?"ok":"warn"}>{formalProduction?"PRODUCTION":"BASELINE"}</Chip>','<Chip key="p" tone={activeProduction?"ok":"warn"}>{activeProduction?"PRODUCTION":"BASELINE"}</Chip>',"control board state chip"]
]);

console.log("Phase D Decision-pending UI semantics patch applied");
