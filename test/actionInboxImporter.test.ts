import assert from 'node:assert/strict';
import test from 'node:test';
import { createActionInboxImporter } from '../src/core/actionInboxImporter.ts';
import { createNoteRepository } from '../src/core/noteRepository.ts';

const action={id:'a',name:'HTTP',payload:{type:'http' as const,originId:'origin',path:'/api',method:'POST' as const,bodyFormat:'json' as const,body:'{"text":"{text}"}',captureText:true}};
const record={id:'submission-a',action,text:'original 日本語\ntext',completed:false,attempted:true,presetId:'original-preset'};
function fixture() {
  const values=new Map<string,string>();const files=new Map<string,unknown>([[record.id,record]]);
  const storage={async getItem(key:string){return values.get(key)??null;},async setItem(key:string,value:string){values.set(key,value);},async removeItem(key:string){values.delete(key);},async getAllKeys(){return [...values.keys()];}};
  const inbox={async read(){return [...files.values()];},async acknowledge(id:string){files.delete(id);}};
  return {storage,inbox,files};
}

test('uncertain background sends recover as attempted drafts and completed receipts cannot resurrect',async()=>{
  const {storage,inbox,files}=fixture();const repository=createNoteRepository(storage);
  const importer=createActionInboxImporter(inbox,repository,async()=>{});
  await importer();assert.equal(files.size,0);
  const [pending]=await repository.pendingNotes();
  assert.deepEqual(pending.action,action);assert.equal(pending.text,record.text);assert.equal(pending.attempted,true);
  assert.equal(pending.presetId,'original-preset');
  // Editing/requeueing must not reset the durable uncertainty marker.
  await repository.queueNote(action,'edited',record.id);
  assert.equal((await repository.pendingNotes())[0].attempted,true);
  files.set(record.id,{...record,completed:true});await importer();
  assert.equal(await repository.noteCompleted(record.id),true);assert.deepEqual(await repository.pendingNotes(),[]);
  files.set(record.id,record);await importer();assert.deepEqual(await repository.pendingNotes(),[]);
});

test('failed import retains the native copy; recovery and acknowledgement replay are idempotent',async()=>{
  const {storage,inbox,files}=fixture();const repository=createNoteRepository(storage);
  const broken={...repository,async markNoteAttempt(){throw new Error('disk full');}};
  await assert.rejects(createActionInboxImporter(inbox,broken,async()=>{})(),/disk full/);assert.equal(files.size,1);
  await createActionInboxImporter(inbox,repository,async()=>{})();assert.equal(files.size,0);
  assert.equal((await repository.pendingNotes())[0].attempted,true);
  files.set(record.id,{...record,completed:true});
  await assert.rejects(createActionInboxImporter({...inbox,async acknowledge(){throw new Error('interrupted');}},repository,async()=>{})(),/interrupted/);
  await createActionInboxImporter(inbox,createNoteRepository(storage),async()=>{})();
  assert.equal(files.size,0);assert.deepEqual(await repository.pendingNotes(),[]);
});

test('blank native replies become editor drafts and invalid snapshots are never acknowledged',async()=>{
  const {storage,inbox,files}=fixture();const repository=createNoteRepository(storage);const drafts:string[]=[];
  files.set(record.id,{...record,text:' \n '});
  const importer=createActionInboxImporter(inbox,repository,async(saved,id)=>{assert.deepEqual(saved,action);drafts.push(id);});
  await importer();assert.deepEqual(drafts,[record.id]);assert.deepEqual(await repository.pendingNotes(),[]);
  files.set(record.id,{...record,action:{...action,payload:{type:'unknown'}}});
  await assert.rejects(importer(),/retained/);assert.equal(files.size,1);
});
