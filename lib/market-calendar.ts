const NY_ZONE="America/New_York";
const OPEN_MINUTES=9*60+30;
const CLOSE_MINUTES=16*60;
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;

const nthWeekday=(year:number,month:number,weekday:number,n:number)=>{const d=new Date(Date.UTC(year,month,1));while(d.getUTCDay()!==weekday)d.setUTCDate(d.getUTCDate()+1);d.setUTCDate(d.getUTCDate()+7*(n-1));return d.toISOString().slice(0,10)};
const lastWeekday=(year:number,month:number,weekday:number)=>{const d=new Date(Date.UTC(year,month+1,0));while(d.getUTCDay()!==weekday)d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)};
const observed=(year:number,month:number,day:number)=>{const d=new Date(Date.UTC(year,month,day)),w=d.getUTCDay();if(w===6)d.setUTCDate(d.getUTCDate()-1);if(w===0)d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)};
const easter=(year:number)=>{const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31)-1,day=(h+l-7*m+114)%31+1;return new Date(Date.UTC(year,month,day))};

export function isNyseHoliday(date:string){
  const y=+date.slice(0,4),goodFriday=easter(y);goodFriday.setUTCDate(goodFriday.getUTCDate()-2);
  const holidays=[observed(y,0,1),nthWeekday(y,0,1,3),nthWeekday(y,1,1,3),goodFriday.toISOString().slice(0,10),lastWeekday(y,4,1),observed(y,6,4),nthWeekday(y,8,1,1),nthWeekday(y,10,4,4),observed(y,11,25)];
  if(y>=2022)holidays.push(observed(y,5,19));
  return new Set(holidays).has(date);
}
export function isNyseSession(date:string){const d=new Date(`${date}T12:00:00Z`);return DATE_RE.test(date)&&Number.isFinite(d.getTime())&&![0,6].includes(d.getUTCDay())&&!isNyseHoliday(date)}
export function nextNyseSession(date:string,delay=1){const d=new Date(`${date}T12:00:00Z`);for(let n=0;n<delay;n++){do d.setUTCDate(d.getUTCDate()+1);while(!isNyseSession(d.toISOString().slice(0,10)))}return d.toISOString().slice(0,10)}
export function countNyseSessions(startDate:string,endDate:string){
  if(!DATE_RE.test(startDate)||!DATE_RE.test(endDate)||endDate<startDate)return 0;
  let count=0,guard=0;const d=new Date(`${startDate}T12:00:00Z`);
  while(d.toISOString().slice(0,10)<=endDate&&guard++<10000){if(isNyseSession(d.toISOString().slice(0,10)))count++;d.setUTCDate(d.getUTCDate()+1)}
  return count;
}

export function nyClock(isoTimestamp:string){
  const date=new Date(isoTimestamp);if(!Number.isFinite(date.getTime()))throw new Error(`Invalid timestamp: ${isoTimestamp}`);
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:NY_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const get=(t:Intl.DateTimeFormatPartTypes)=>parts.find(p=>p.type===t)?.value||"";
  return{localDate:`${get("year")}-${get("month")}-${get("day")}`,minutes:Number(get("hour"))*60+Number(get("minute"))};
}

export function marketDate(now=new Date().toISOString()){return nyClock(now).localDate}

/**
 * Formal lifecycle review dates are US-market dates, not UTC dates. A named
 * NYSE session is not review-complete until its core close has passed.
 * Early-close days are deliberately treated as incomplete until 16:00 ET;
 * this is conservative (late), never an early gate.
 */
export function nyseReviewBoundaryReached(reviewDate:string,now=new Date().toISOString()){
  if(!DATE_RE.test(reviewDate))return false;
  const clock=nyClock(now);
  if(clock.localDate>reviewDate)return true;
  if(clock.localDate<reviewDate)return false;
  return !isNyseSession(reviewDate)||clock.minutes>=CLOSE_MINUTES;
}

export type NyseExecutionWindow="UPCOMING_OPEN"|"OPEN_PASSED"|"INVALID_SESSION";
export function nyseExecutionWindow(executionDate:string,now=new Date().toISOString()):NyseExecutionWindow{
  if(!DATE_RE.test(executionDate)||!isNyseSession(executionDate))return"INVALID_SESSION";
  const clock=nyClock(now);
  if(clock.localDate<executionDate)return"UPCOMING_OPEN";
  if(clock.localDate>executionDate)return"OPEN_PASSED";
  return clock.minutes<OPEN_MINUTES?"UPCOMING_OPEN":"OPEN_PASSED";
}

/**
 * Daily OHLC bars may be returned by a provider while the current session is
 * still trading. Current/future New York dates are rejected until 16:15 ET.
 * The 15-minute grace is intentionally conservative and also makes scheduled
 * early-close days safe even though their exact 13:00 close is not modeled.
 */
export function dailyBarIsComplete(barDate:string,now=new Date().toISOString(),graceMinutes=15){
  if(!DATE_RE.test(barDate)||graceMinutes<0)return false;
  const clock=nyClock(now);
  if(barDate<clock.localDate)return true;
  if(barDate>clock.localDate)return false;
  if(!isNyseSession(barDate))return false;
  return clock.minutes>=CLOSE_MINUTES+graceMinutes;
}

export function earliestLegalNyseOpen(signalDate:string,recordedAt:string){
  const theoretical=nextNyseSession(signalDate),{localDate,minutes}=nyClock(recordedAt);
  if(localDate<theoretical)return theoretical;
  if(localDate===theoretical)return minutes<OPEN_MINUTES&&isNyseSession(localDate)?theoretical:nextNyseSession(theoretical);
  if(isNyseSession(localDate)&&minutes<OPEN_MINUTES)return localDate;
  return nextNyseSession(localDate);
}

export function completedNyseSessionsSince(generatedAt:string,now=new Date().toISOString()){
  const start=nyClock(generatedAt),end=nyClock(now);if(end.localDate<start.localDate||Date.parse(now)<Date.parse(generatedAt))return Number.POSITIVE_INFINITY;
  let count=0,guard=0;const d=new Date(`${start.localDate}T12:00:00Z`);
  while(d.toISOString().slice(0,10)<=end.localDate&&guard++<4000){
    const date=d.toISOString().slice(0,10);
    if(isNyseSession(date)){
      const afterGeneration=date>start.localDate||(date===start.localDate&&start.minutes<CLOSE_MINUTES);
      const completedByNow=date<end.localDate||(date===end.localDate&&end.minutes>=CLOSE_MINUTES);
      if(afterGeneration&&completedByNow)count++;
    }
    d.setUTCDate(d.getUTCDate()+1);
  }
  return count;
}

export function upstreamWorkflowFresh(generatedAt:string|undefined,now=new Date().toISOString()){
  if(!generatedAt)return false;
  try{return completedNyseSessionsSince(generatedAt,now)===0}catch{return false}
}

export function marketDataLagSessions(marketDataDate:string|undefined,now=new Date().toISOString()){
  if(!marketDataDate)return Number.POSITIVE_INFINITY;
  const end=nyClock(now);let latest=end.localDate;
  if(end.minutes<CLOSE_MINUTES||!isNyseSession(latest)){const d=new Date(`${latest}T12:00:00Z`);do d.setUTCDate(d.getUTCDate()-1);while(!isNyseSession(d.toISOString().slice(0,10)));latest=d.toISOString().slice(0,10)}
  if(marketDataDate>=latest)return 0;
  let count=0,guard=0;const d=new Date(`${marketDataDate}T12:00:00Z`);
  while(d.toISOString().slice(0,10)<latest&&guard++<4000){d.setUTCDate(d.getUTCDate()+1);if(isNyseSession(d.toISOString().slice(0,10)))count++}
  return count;
}
