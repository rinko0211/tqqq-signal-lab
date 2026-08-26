import type {LifecycleLedger} from "./lifecycle-review.ts";

export const LIFECYCLE_APPROVAL_MAX_AGE_HOURS=48;

export function lifecycleReviewIsFresh(lifecycle:LifecycleLedger,now=new Date().toISOString(),maxAgeHours=LIFECYCLE_APPROVAL_MAX_AGE_HOURS):boolean{
  const reviewed=Date.parse(lifecycle.updatedAt),current=Date.parse(now);
  if(!Number.isFinite(reviewed)||!Number.isFinite(current)||maxAgeHours<=0)return false;
  const age=current-reviewed;
  return age>=0&&age<=maxAgeHours*60*60*1000;
}

/**
 * A lifecycle decision must not be used after one of its authoritative input
 * status files has been regenerated. The workflow refreshes Lifecycle just
 * before Production approval; this helper also protects direct/manual script
 * execution from approving against an older review snapshot.
 */
export function lifecycleReviewCoversUpstreams(lifecycle:LifecycleLedger,generatedAts:(string|undefined|null)[]):boolean{
  const reviewed=Date.parse(lifecycle.updatedAt);if(!Number.isFinite(reviewed))return false;
  for(const generatedAt of generatedAts){
    if(!generatedAt)return false;
    const t=Date.parse(generatedAt);if(!Number.isFinite(t)||t>reviewed)return false;
  }
  return true;
}
