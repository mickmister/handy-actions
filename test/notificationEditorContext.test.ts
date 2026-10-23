import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationEditorContext } from '../src/core/notificationEditorContext.ts';

const action={id:'note',title:'Original note',payload:{type:'text-input',urlTemplate:'app://original?text={text}'}};
test('notification body taps recover the original action snapshot and received draft without an editor button',()=>{
  const configured=structuredClone(action);
  const data={captureActionId:'note',presetId:'preset',actions:JSON.stringify([configured]),localNoteRecoveryText:'Retained 日本語\nnote'};
  configured.payload.urlTemplate='app://edited?text={text}';
  const context=notificationEditorContext(data)!;
  assert.equal(context.action.payload.type==='text-input'&&context.action.payload.urlTemplate,'app://original?text={text}');
  assert.equal(context.presetId,'preset');assert.equal(context.text,'Retained 日本語\nnote');
});
test('body-tap network recovery preserves the uncertain submission and explicit blank drafts',()=>{
  const data={captureActionId:'note',actions:JSON.stringify([action]),editorText:'Prompt',recoverySubmissionId:'submission'};
  assert.equal(notificationEditorContext(data)?.submissionId,'submission');
  assert.equal(notificationEditorContext({...data,editorText:'',localNoteRecoveryText:'older text'})?.text,'');
  assert.equal(notificationEditorContext({...data,editorText:undefined,localNoteRecoveryText:undefined})?.text,'');
});
test('malformed or unrelated notifications do not become editor actions',()=>{
  for(const data of [undefined,{}, {captureActionId:'note',actions:'not-json'}, {captureActionId:'other',actions:JSON.stringify([action])}])assert.equal(notificationEditorContext(data),undefined);
});
