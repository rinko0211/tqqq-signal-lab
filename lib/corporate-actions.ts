export type CorporateActionContinuity={kind:"NONE"|"SPLIT"|"REVERSE_SPLIT"|"UNEXPLAINED_RESTATEMENT";factor:number;adjustedPriorClose:number;relativeDifference:number};
const CANDIDATES=[.1,.2,.25,1/3,.5,2,3,4,5,10];
export function corporateActionContinuity(storedPriorClose:number,currentProviderSameDateClose:number,tolerance=.035):CorporateActionContinuity{
  if(!Number.isFinite(storedPriorClose)||storedPriorClose<=0||!Number.isFinite(currentProviderSameDateClose)||currentProviderSameDateClose<=0)throw new Error("CORP-001: invalid close for corporate-action continuity");
  const ratio=storedPriorClose/currentProviderSameDateClose,relativeDifference=Math.abs(ratio-1);
  if(relativeDifference<=.02)return{kind:"NONE",factor:1,adjustedPriorClose:storedPriorClose,relativeDifference};
  const factor=CANDIDATES.find(x=>Math.abs(ratio-x)/x<=tolerance);
  if(!factor)return{kind:"UNEXPLAINED_RESTATEMENT",factor:ratio,adjustedPriorClose:storedPriorClose,relativeDifference};
  return{kind:factor>1?"SPLIT":"REVERSE_SPLIT",factor,adjustedPriorClose:currentProviderSameDateClose,relativeDifference};
}

export function applyShareFactor(shares:number,avgPrice:number,factor:number){
  if(!Number.isFinite(factor)||factor<=0)throw new Error("CORP-002: invalid share factor");
  return{shares:shares*factor,avgPrice:avgPrice/factor};
}
