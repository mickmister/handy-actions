import assert from 'node:assert/strict';
import test from 'node:test';
import { REMINDER_COMPLETE_PRESS, reminderIntervalLabel, reminderMinutes, reminderPress } from '../src/core/reminderModel.ts';

test('store-reminder default and custom intervals convert to exact OS scheduling minutes', () => {
  assert.equal(reminderMinutes('1', 'hours'), 60);
  assert.equal(reminderMinutes('90', 'minutes'), 90);
  assert.equal(reminderMinutes('2', 'days'), 2880);
  assert.equal(reminderMinutes(' 1 ', 'minutes'), 1);
  assert.equal(reminderIntervalLabel(60), '1 hour');
  assert.equal(reminderIntervalLabel(120), '2 hours');
  assert.equal(reminderIntervalLabel(90), '90 minutes');
  assert.equal(reminderIntervalLabel(1440), '1 day');
  for (const value of ['', '0', '-1', '1.5', 'Infinity', 'NaN', '1e3', '1 hour', '999999999999999999']) {
    assert.throws(() => reminderMinutes(value, 'minutes'));
  }
  assert.throws(() => reminderMinutes('366', 'days'));
});

test('reminder body opens its list, while Mark complete retains exact ID and revision for native completion', () => {
  const data = {reminderId:'reminder-123',reminderRevision:'revision-456'};
  assert.deepEqual(reminderPress('default', data), {id:'reminder-123',revision:'revision-456',complete:false});
  assert.deepEqual(reminderPress(undefined, data), {id:'reminder-123',revision:'revision-456',complete:false});
  assert.deepEqual(reminderPress(REMINDER_COMPLETE_PRESS, data), {id:'reminder-123',revision:'revision-456',complete:true});
  assert.equal(reminderPress('handy-input-submit', data, 'a note'), undefined);
  assert.equal(reminderPress('handy-action:123', data), undefined);
  assert.equal(reminderPress('default', {reminderId:'reminder-123'}), undefined);
  assert.equal(reminderPress('default', {reminderId:'../123',reminderRevision:'valid'}), undefined);
  assert.equal(reminderPress('default', {reminderId:123,reminderRevision:'valid'}), undefined);
  assert.equal(reminderPress('default', {presetId:'panel'}), undefined);
});
