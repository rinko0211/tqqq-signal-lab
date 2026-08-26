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

export function assertPlausibleTransition(adjustedPriorClose:number,currentOpen:number,continuity:CorporateActionContinuity){
  if(!Number.isFinite(currentOpen)||currentOpen<=0)throw new Error("CORP-003: invalid current open");
  const ratio=currentOpen/adjustedPriorClose;
  // If the provider did not back-adjust the prior bar, a forward/reverse split can
  // otherwise masquerade as a catastrophic overnight return. Do not guess a factor
  // from the gap alone; fail closed for manual/provider verification.
  if(continuity.kind==="NONE"&&(ratio<.60||ratio>1.70))throw new Error(`CORP-004: unexplained split-like transition ratio ${ratio.toFixed(4)}; ledger left unchanged`);
  if(continuity.kind==="UNEXPLAINED_RESTATEMENT")throw new Error(`CORP-005: provider restated prior close by ${(continuity.relativeDifference*100).toFixed(2)}% without a recognized split factor`);
  return ratio;
}

export function applyShareFactor(shares:number,avgPrice:number,factor:number){
  if(!Number.isFinite(factor)||factor<=0)throw new Error("CORP-002: invalid share factor");
  return{shares:shares*factor,avgPrice:avgPrice/factor};
}
