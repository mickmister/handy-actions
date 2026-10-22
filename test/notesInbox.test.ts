import assert from 'node:assert/strict';
import test from 'node:test';
import { createNoteRepository } from '../src/core/noteRepository.ts';
import { createNoteInboxImporter } from '../src/core/noteInboxImporter.ts';
import type { HandyAction } from '../src/core/handyModel.ts';

const agent:HandyAction={id:'agent',name:'Project intake',payload:{type:'vd-agent',originId:'origin',prefix:'new project',session:{id:'s',workspaceId:'w',executor:'CLAUDE_CODE',label:'Intake · CLAUDE_CODE'}}};
function fixture() {
  const data=new Map<string,string>();
  const storage={async getItem(key:string){return data.get(key)??null;},async setItem(key:string,value:string){data.set(key,value);},async removeItem(key:string){data.delete(key);},async getAllKeys(){return [...data.keys()];}};
  return {data,storage};
}
test('legacy notes default to unaddressed and edits/status survive restart and native import replays',async()=>{
  const {data,storage}=fixture();
  const captured={id:'local-capture',text:'Original 日本語\nidea',createdAt:'2026-10-22T10:00:00Z'};
  data.set('handy-actions/notes/v1',JSON.stringify([captured]));
  const notes=createNoteRepository(storage);
  assert.equal((await notes.loadNotes())[0].status??'unaddressed','unaddressed');
  await notes.editNote(captured.id,'Edited idea');await notes.setNoteStatus(captured.id,'completed');
  const restarted=createNoteRepository(storage);
  await createNoteInboxImporter({async read(){return [captured];},async acknowledge(){}},restarted)();
  const [saved]=await restarted.loadNotes();
  assert.equal(saved.text,'Edited idea');assert.equal(saved.createdAt,captured.createdAt);assert.equal(saved.status,'completed');
  await restarted.setNoteStatus(saved.id,'unaddressed');
  assert.equal((await restarted.loadNotes())[0].completedAt,undefined);
  await assert.rejects(restarted.editNote(saved.id,' \n'),/Enter a note/);
});

test('capture delivery receipts do not complete notes; confirmed agent send and queue do',async()=>{
  for(const kind of ['started','queued'] as const) {
    const notes=createNoteRepository(fixture().storage);
    await notes.saveNote('Idea','source');await notes.completeNote('source');
    assert.equal((await notes.loadNotes())[0].status??'unaddressed','unaddressed');
    const pending=await notes.queueNote(agent,'Refined idea','agent-submission',undefined,'source');
    assert.equal(pending?.sourceNoteId,'source');
    await notes.markNoteAttempt('agent-submission');
    assert.equal((await notes.loadNotes())[0].status??'unaddressed','unaddressed');
    await notes.confirmAgentHandoff('agent-submission','source',agent,kind);
    const [saved]=await notes.loadNotes();
    assert.equal(saved.status,'completed');assert.equal(saved.handoff?.kind,kind);assert.equal(saved.handoff?.sessionLabel,'Intake · CLAUDE_CODE');
    assert.deepEqual(await notes.pendingNotes(),[]);
    assert.equal(await notes.queueNote(agent,'retry','agent-submission',undefined,'source'),undefined);
  }
});

test('a durable successful handoff reconciles after storage failure without another send',async()=>{
  const {storage}=fixture();let fail=false;
  const broken=createNoteRepository({...storage,async setItem(key,value){if(fail&&key==='handy-actions/notes/v1')throw new Error('disk full');await storage.setItem(key,value);}});
  await broken.saveNote('Idea','source');await broken.queueNote(agent,'Prompt','send',undefined,'source');
  fail=true;
  await assert.rejects(broken.confirmAgentHandoff('send','source',agent,'queued'),/disk full/);
  const restarted=createNoteRepository(storage);
  // queueNote checks a confirmation receipt before it permits another request.
  assert.equal(await restarted.queueNote(agent,'Prompt','send',undefined,'source'),undefined);
  assert.equal((await restarted.loadNotes())[0].status,'completed');
  assert.deepEqual(await restarted.pendingNotes(),[]);
});

test('reconciliation preserves reopening even when receipt acknowledgement was interrupted',async()=>{
  const {storage}=fixture();let fail=true;
  const notes=createNoteRepository({...storage,async setItem(key,value){
    if(fail&&key.startsWith('handy-actions/agent-handoff/')&&JSON.parse(value).applied)throw new Error('interrupted');
    await storage.setItem(key,value);
  }});
  await notes.saveNote('Idea','source');
  await assert.rejects(notes.confirmAgentHandoff('send','source',agent,'started'),/interrupted/);
  await notes.setNoteStatus('source','unaddressed');
  fail=false;await notes.reconcileHandoffs();
  assert.equal((await notes.loadNotes())[0].status,'unaddressed');
  await notes.confirmAgentHandoff('send','source',agent,'started');
  assert.equal((await notes.loadNotes())[0].status,'unaddressed');
});

test('uncertain handoffs retain edited source and linked pending destination after restart',async()=>{
  const {storage}=fixture();const notes=createNoteRepository(storage);
  await notes.saveNote('Idea','source');await notes.editNote('source','Refined 日本語\nprompt');
  await notes.queueNote(agent,'Refined 日本語\nprompt','send','preset','source');await notes.markNoteAttempt('send');
  const restarted=createNoteRepository(storage);const [pending]=await restarted.pendingNotes();
  assert.equal(pending.sourceNoteId,'source');assert.equal(pending.presetId,'preset');assert.equal(pending.attempted,true);
  assert.deepEqual(pending.action,agent);assert.equal((await restarted.loadNotes())[0].status??'unaddressed','unaddressed');
});

test('an older interrupted receipt cannot overwrite a newer handoff or reopen decision',async()=>{
  const {storage}=fixture();let interrupted=true;
  const notes=createNoteRepository({...storage,async setItem(key,value){
    if(interrupted&&key==='handy-actions/agent-handoff/first'&&JSON.parse(value).applied)throw new Error('interrupted');
    await storage.setItem(key,value);
  }});
  await notes.saveNote('Idea','source');
  await assert.rejects(notes.confirmAgentHandoff('first','source',agent,'started'),/interrupted/);
  await notes.confirmAgentHandoff('second','source',agent,'queued');
  await notes.setNoteStatus('source','unaddressed');interrupted=false;
  await notes.reconcileHandoffs();
  const [saved]=await notes.loadNotes();
  assert.equal(saved.status,'unaddressed');assert.equal(saved.handoff?.submissionId,'second');
});
