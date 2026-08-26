import type {LifecycleLedger} from "./lifecycle-review.ts";

export const LIFECYCLE_APPROVAL_MAX_AGE_HOURS=48;

export function lifecycleReviewIsFresh(lifecycle:LifecycleLedger,now=new Date().toISOString(),maxAgeHours=LIFECYCLE_APPROVAL_MAX_AGE_HOURS):boolean{
  const reviewed=Date.parse(lifecycle.updatedAt),current=Date.parse(now);
  if(!Number.isFinite(reviewed)||!Number.isFinite(current)||maxAgeHours<=0)return false;
  const age=current-reviewed;
  return age>=0&&age<=maxAgeHours*60*60*1000;
}
