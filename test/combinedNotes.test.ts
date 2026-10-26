import assert from 'node:assert/strict';
import test from 'node:test';
import { combineNotes } from '../src/core/combinedNotes.ts';
import { createNoteRepository } from '../src/core/noteRepository.ts';
import { createAgentSendReceipts } from '../src/core/agentSendReceipts.ts';
import type { HandyAction } from '../src/core/handyModel.ts';

const agent:HandyAction={id:'agent',name:'Combined notes',payload:{type:'vd-agent',originId:'origin',prefix:'',session:{id:'s',workspaceId:'w',executor:'CLAUDE_CODE',label:'Selected session'}}};
function storage() {
  const data=new Map<string,string>();
  return {data,async getItem(key:string){return data.get(key)??null;},async setItem(key:string,value:string){data.set(key,value);},async removeItem(key:string){data.delete(key);},async getAllKeys(){return [...data.keys()];}};
}

test('combined prompt preserves multiline source text and explicit order without changing originals',async()=>{
  const repository=createNoteRepository(storage());
  await repository.saveNote('First 日本語\nline two','a');await repository.saveNote('Second idea','b');
  const notes=await repository.loadNotes();const original=JSON.stringify(notes);
  assert.equal(combineNotes(notes,['b','a','b']),'Second idea\n\nFirst 日本語\nline two');
  assert.equal(JSON.stringify(notes),original);
  assert.throws(()=>combineNotes(notes,['a']),/at least two/);
  await repository.setNoteStatus('b','completed');
  assert.throws(()=>combineNotes([{...notes[0],status:'completed'},notes[1]],['a','b']),/no longer pending/);
  assert.throws(()=>combineNotes(notes,['a','missing']),/no longer pending/);
});

test('uncertain combined sends preserve every source and recover ordered source links after restart',async()=>{
  const disk=storage();const repository=createNoteRepository(disk);
  await repository.saveNote('Original A','a');await repository.saveNote('Original B','b');
  await repository.queueNote(agent,'User edited combined text','send',undefined,undefined,['b','a']);
  await repository.markNoteAttempt('send');
  const restarted=createNoteRepository(disk);
  const [pending]=await restarted.pendingNotes();
  assert.deepEqual(pending.sourceNoteIds,['b','a']);assert.equal(pending.attempted,true);
  assert.equal(pending.text,'User edited combined text');
  assert.ok((await restarted.loadNotes()).every(note=>note.status!=='completed'));
});

test('one accepted combined send completes all sources atomically; replay cannot resend or re-complete a reopened note',async()=>{
  for(const kind of ['started','queued'] as const) {
    const disk=storage();let fail=true;
    const repository=createNoteRepository({...disk,async setItem(key,value){if(fail&&key==='handy-actions/notes/v1'&&JSON.parse(value).some((note:{status?:string})=>note.status==='completed'))throw new Error('disk full');await disk.setItem(key,value);}});
    await repository.saveNote('A','a');await repository.saveNote('B','b');
    await repository.queueNote(agent,'Edited message','send',undefined,undefined,['b','a']);
    await assert.rejects(repository.confirmAgentHandoff('send',['b','a'],agent,kind),/disk full/);
    assert.ok((await repository.loadNotes()).every(note=>note.status!=='completed'));
    fail=false;
    const restarted=createNoteRepository(disk);
    assert.equal(await restarted.queueNote(agent,'Retry must not send','send'),undefined);
    const completed=await restarted.loadNotes();
    assert.ok(completed.every(note=>note.status==='completed'&&note.handoff?.submissionId==='send'));
    assert.deepEqual(completed.map(note=>note.text).sort(),['A','B']);
    await restarted.setNoteStatus('a','unaddressed');
    await restarted.confirmAgentHandoff('send',['a','b'],agent,kind);
    assert.equal((await restarted.loadNotes()).find(note=>note.id==='a')?.status,'unaddressed');
  }
});

test('accepted send receipt survives reply-watch binding failure and reconciles local effects without a second network send',async()=>{
  const disk=storage();const repository=createNoteRepository(disk);
  await repository.saveNote('A','a');await repository.saveNote('B','b');
  let binds=0;
  const receipt={id:'send',action:agent,sources:['a','b'],result:{kind:'started' as const,processId:'process'},prompt:'A\n\nB'};
  const receipts=createAgentSendReceipts(disk,async saved=>{
    await repository.confirmAgentHandoff(saved.id,saved.sources,saved.action,saved.result.kind);
    binds++;throw new Error('native bridge interrupted');
  });
  await assert.rejects(receipts.record(receipt),/interrupted/);
  assert.ok((await repository.loadNotes()).every(note=>note.status==='completed'));
  await repository.setNoteStatus('a','unaddressed');
  const recovered=createAgentSendReceipts(disk,async saved=>{
    assert.deepEqual(saved,receipt);
    await repository.confirmAgentHandoff(saved.id,saved.sources,saved.action,saved.result.kind);binds++;
  });
  await recovered.reconcile();await recovered.reconcile();
  assert.equal(binds,2);
  assert.equal((await repository.loadNotes()).find(note=>note.id==='a')?.status,'unaddressed');
  assert.equal([...disk.data.keys()].filter(key=>key.startsWith('handy-actions/accepted-agent-send/')).length,0);
});

test('acceptance journal prevents a resend even if source completion has not run yet',async()=>{
  const disk=storage();const repository=createNoteRepository(disk);
  await repository.saveNote('A','a');await repository.saveNote('B','b');
  await repository.queueNote(agent,'combined','send',undefined,undefined,['a','b']);
  const receipts=createAgentSendReceipts(disk,async()=>{throw new Error('crash before local effects');});
  await assert.rejects(receipts.record({id:'send',action:agent,sources:['a','b'],result:{kind:'queued'},prompt:'combined'}),/crash/);
  assert.equal(await createNoteRepository(disk).queueNote(agent,'retry','send'),undefined);
  assert.ok((await repository.loadNotes()).every(note=>note.status!=='completed'));
});
