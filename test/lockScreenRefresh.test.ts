import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileActivities } from '../src/core/activityLifecycle.ts';
import { isRefreshPress, REFRESH_NOTIFICATION_ID, REFRESH_PRESS_ID } from '../src/core/lockScreenRefresh.ts';

test('refresh body/control routing is scoped and cannot intercept capture or preset taps',()=>{
  assert.equal(isRefreshPress(REFRESH_PRESS_ID,{}),true);
  assert.equal(isRefreshPress('default',{refreshLockScreen:'1'},REFRESH_NOTIFICATION_ID),true);
  assert.equal(isRefreshPress('default',{refreshLockScreen:'1'},'handy-input-capture'),false);
  assert.equal(isRefreshPress('handy-input-submit',{captureActionId:'note'},'handy-input-capture'),false);
  assert.equal(isRefreshPress(undefined,undefined),false);
});
test('normal refresh updates in place; explicit renewal ends then starts fresh; expired/disabled activities reconcile',async()=>{
  const events:string[]=[];let serial=0;
  const instance=(id:string)=>({getId:()=>id,async update(){events.push('update:'+id);},async end(){events.push('end:'+id);}});
  const existing=instance('old');const desired=[{presetId:'p',props:{name:'Current'},openUrl:'app://preset'}];
  const options={renew:false,endedProps:{name:'Ended'},staleDate:new Date(),start(){const id='new'+(++serial);events.push('start:'+id);return instance(id);}};
  assert.deepEqual(await reconcileActivities([existing],{p:'old'},desired,options),{p:'old'});
  assert.deepEqual(events,['update:old']);events.length=0;
  const renewed=await reconcileActivities([existing],{p:'old'},desired,{...options,renew:true});
  assert.deepEqual(renewed,{p:'new1'});assert.deepEqual(events,['end:old','start:new1']);events.length=0;
  assert.deepEqual(await reconcileActivities([],{p:'old'},desired,options),{p:'new2'});
  assert.deepEqual(events,['start:new2']);events.length=0;
  assert.deepEqual(await reconcileActivities([existing],{p:'old'},[],options),{});
  assert.deepEqual(events,['end:old']);
});
test('failed renewal never starts a duplicate live activity',async()=>{
  let starts=0;
  await assert.rejects(reconcileActivities([{getId:()=> 'old',async update(){},async end(){throw new Error('failed end');}}],{p:'old'},[{presetId:'p',props:{},openUrl:''}],{
    renew:true,endedProps:{},staleDate:new Date(),start(){starts++;throw new Error('should not start');},
  }),/failed end/);
  assert.equal(starts,0);
});
