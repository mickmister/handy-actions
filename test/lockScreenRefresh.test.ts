import assert from 'node:assert/strict';
import test from 'node:test';
import { isRefreshPress, REFRESH_NOTIFICATION_ID, REFRESH_PRESS_ID } from '../src/core/lockScreenRefresh.ts';

test('refresh body/control routing is scoped and cannot intercept capture or preset taps',()=>{
  assert.equal(isRefreshPress(REFRESH_PRESS_ID,{}),true);
  assert.equal(isRefreshPress('default',{refreshLockScreen:'1'},REFRESH_NOTIFICATION_ID),true);
  assert.equal(isRefreshPress('default',{refreshLockScreen:'1'},'handy-input-capture'),false);
  assert.equal(isRefreshPress('handy-input-submit',{captureActionId:'note'},'handy-input-capture'),false);
  assert.equal(isRefreshPress(undefined,undefined),false);
});
