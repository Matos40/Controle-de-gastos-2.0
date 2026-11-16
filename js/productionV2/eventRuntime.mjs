import {canPoll,nextDelay,LIMITS} from '../experimentalSync/session.mjs';
// Events are wake-up hints only; every operation goes through the existing verified session.
export function createEventRuntime({session,environment,setTimer,clearTimer,now=Date.now,onError=()=>{},delay=1500}){
 let timer=null,due=Infinity,closed=false,running=false,dirty=false,failures=0,backoffUntil=0;
 const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;due=Infinity;};
 const eligible=()=>!closed&&canPoll({...environment(),...session.state()});
 function schedule(ms){if(!eligible()||running)return;const at=Math.max(now()+ms,backoffUntil);if(timer!==null&&due<=at)return;cancel();due=at;timer=setTimer(async()=>{timer=null;due=Infinity;if(!eligible())return;running=true;const urgent=dirty;dirty=false;try{const r=await session.tick({manual:urgent,now:now()});if(r?.status==='idle'&&urgent)dirty=true;failures=0;backoffUntil=0;}catch(e){failures++;dirty=true;backoffUntil=now()+nextDelay(failures);onError(String(e.code??e.message).split(':')[0]);}finally{running=false;schedule(dirty?delay:LIMITS.minPollMs);}},Math.max(0,at-now()));}
 function changed(){if(!eligible()){cancel();return;}schedule(dirty?delay:LIMITS.minPollMs);}
 function signal(){if(closed)return;dirty=true;schedule(delay);}
 return {start:changed,changed,signal,pause:()=>{cancel();dirty=false;session.pause();},close:()=>{closed=true;cancel();},pending:()=>timer!==null};
}
