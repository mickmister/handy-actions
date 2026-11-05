import assert from 'node:assert/strict';
import test from 'node:test';
import type { HandyState } from '../src/core/handyModel.ts';
import { createHandyStateRepository, HANDY_STATE_KEY, HANDY_STATE_RECOVERY_KEY } from '../src/core/handyStateRepository.ts';
import { createHandyStateSession as createSession } from '../src/core/handyStateSession.ts';
import { createThemeRepository } from '../src/core/themeRepository.ts';

function preferenceVault() {
  const values = new Map<string,string>();
  return {async getItem(key:string){return values.get(key) ?? null;},async setItem(key:string,value:string){values.set(key,value);}};
}
function createHandyStateSession(repository: Parameters<typeof createSession>[0], vault = preferenceVault()) {
  return createSession(repository, createThemeRepository(vault));
}

const saved: HandyState = {
  theme:'paper',
  recentWorkspaces:{enabled:true,originId:'vd-origin'},
  surfaces:{liveActivities:true,notifications:false,lockScreenWidgets:true,widgetPresetId:'tools'},
  presets:[{id:'tools',name:'My actions',enabled:true,actions:[
    {id:'agent',name:'Send to agent',payload:{type:'vd-agent',originId:'vd-origin',prefix:'Keep this prefix\n',session:{id:'session',workspaceId:'workspace',executor:'CLAUDE_CODE',label:'Existing session'}}},
    {id:'note',name:'Capture',payload:{type:'text-input',urlTemplate:'handyactions://notes?text={text}'}},
  ]}],
};
function storage(initial: HandyState | undefined = saved) {
  const values = new Map<string,string>(initial ? [[HANDY_STATE_KEY,JSON.stringify(initial)]] : []);
  const io = {
    values, failReads:false, failWrite:'', writes:[] as string[],
    async getItem(key:string) { if(io.failReads)throw new Error('protected storage unavailable'); return values.get(key) ?? null; },
    async setItem(key:string,value:string) { io.writes.push(key); if(io.failWrite===key)throw new Error('disk unavailable'); values.set(key,value); },
  };
  return io;
}

test('legacy presets/theme migrate intact and survive a cold repository restart and missing primary key', async () => {
  const io=storage();
  const repository=createHandyStateRepository(io);
  assert.deepEqual(await repository.load(),saved);
  assert.ok(io.values.has(HANDY_STATE_RECOVERY_KEY));
  assert.deepEqual(await createHandyStateRepository(io).load(),saved);
  io.values.delete(HANDY_STATE_KEY);
  assert.deepEqual(await createHandyStateRepository(io).load(),saved);
  for(const broken of ['null','{}','[]','{broken','']) {
    io.values.set(HANDY_STATE_KEY,broken);
    assert.deepEqual(await createHandyStateRepository(io).load(),saved);
    assert.equal(io.values.get(HANDY_STATE_KEY),broken,'Loading recovery does not overwrite unreadable original bytes');
  }
});

test('edits during an unfinished startup load are blocked and duplicate retry requests share that load', async () => {
  const io=storage();
  let release!: () => void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  let reads=0;
  const repository=createHandyStateRepository({...io,async getItem(key:string){reads++;await gate;return io.getItem(key);}});
  const session=createHandyStateSession(repository);
  const initial=session.load();
  assert.equal(session.load(),initial);
  assert.equal((await session.update(state=>({...state,theme:'midnight'}),'Theme')).ok,false);
  assert.equal(session.getSnapshot().refreshReady,false);
  assert.deepEqual(io.writes,[]);
  release();await initial;
  assert.equal(reads,2);
  assert.deepEqual(session.getSnapshot().state,saved);
});

test('cold-start read errors block edits and refreshes, and retry restores presets instead of saving defaults', async () => {
  const io=storage();io.failReads=true;
  const session=createHandyStateSession(createHandyStateRepository(io));
  await session.load();
  assert.equal(session.getSnapshot().loaded,false);
  assert.equal(session.getSnapshot().refreshReady,false);
  assert.match(session.getSnapshot().storageError,/not been reset/);
  const result=await session.update(state=>({...state,theme:'midnight'}),'Theme saved.');
  assert.equal(result.ok,false);
  assert.deepEqual(io.writes,[]);
  assert.equal(io.values.get(HANDY_STATE_KEY),JSON.stringify(saved));
  io.failReads=false;
  await session.load();
  assert.deepEqual(session.getSnapshot().state,saved);
  assert.equal(session.getSnapshot().loaded,true);
  assert.equal((await session.update(state=>({...state,theme:'midnight'}),'Theme saved.')).ok,true);
  assert.deepEqual((await createHandyStateRepository(io).load()).presets,saved.presets);
});

test('failed reload preserves last confirmed state and storage error despite surface messages', async () => {
  const io=storage();const session=createHandyStateSession(createHandyStateRepository(io));
  await session.load();const confirmed=session.getSnapshot().state;
  io.failReads=true;await session.load();
  assert.deepEqual(session.getSnapshot().state,confirmed);
  assert.equal(session.getSnapshot().state.presets,confirmed.presets);
  assert.equal(session.getSnapshot().loaded,false);
  const message=session.getSnapshot().message;
  session.setMessage('Lock Screen refreshed.');
  assert.equal(session.getSnapshot().message,message);
  assert.equal((await session.update(()=>({presets:[]}),'Saved')).ok,false);
  io.failReads=false;await session.load();
  assert.equal(session.getSnapshot().storageError,'');
  assert.deepEqual(session.getSnapshot().state,saved);
});

test('malformed present data never normalizes into a new empty installation', async () => {
  for(const raw of ['null','{}','[]','{broken','',JSON.stringify({...saved,presets:null}),JSON.stringify({...saved,theme:'unknown'})]) {
    const io=storage();io.values.set(HANDY_STATE_KEY,raw);
    const repository=createHandyStateRepository(io);
    await assert.rejects(repository.load());
    await assert.rejects(repository.update(()=>({presets:[]})));
    assert.equal(io.values.get(HANDY_STATE_KEY),raw);
    assert.deepEqual(io.writes,[]);
  }
});

test('functional concurrent theme/action/settings saves merge against latest committed state', async () => {
  const io=storage();const vault=preferenceVault();const session=createHandyStateSession(createHandyStateRepository(io),vault);await session.load();
  const results=await Promise.all([
    session.updateTheme('midnight','Theme'),
    session.update(state=>({...state,presets:state.presets.map(p=>({...p,actions:[...p.actions,{id:'added',name:'New action',payload:{type:'notes'}}]}))}),'Action'),
    session.update(state=>({...state,recentWorkspaces:{enabled:false,originId:'different'}}),'Workspaces'),
  ]);
  assert.ok(results.every(result=>result.ok));
  const restarted=createHandyStateSession(createHandyStateRepository(io),vault);await restarted.load();
  const restored=restarted.getSnapshot().state;
  assert.equal(restored.theme,'midnight');
  assert.deepEqual(restored.presets[0].actions.map(a=>a.id),['agent','note','added']);
  assert.deepEqual(restored.presets[0].actions.slice(0,2),saved.presets[0].actions);
  assert.deepEqual(restored.recentWorkspaces,{enabled:false,originId:'different'});
  assert.deepEqual(restored.surfaces,saved.surfaces);
});

test('a failed recovery commit leaves old presets intact and disables further writes until reload', async () => {
  const io=storage();const session=createHandyStateSession(createHandyStateRepository(io));await session.load();
  const previous=io.values.get(HANDY_STATE_RECOVERY_KEY);
  io.failWrite=HANDY_STATE_RECOVERY_KEY;
  assert.equal((await session.update(state=>({...state,theme:'midnight'}),'Theme')).ok,false);
  assert.equal(session.getSnapshot().loaded,false);
  assert.deepEqual(session.getSnapshot().state,saved);
  assert.equal(io.values.get(HANDY_STATE_KEY),JSON.stringify(saved));
  assert.equal(io.values.get(HANDY_STATE_RECOVERY_KEY),previous);
  io.failWrite='';await session.load();
  assert.deepEqual(session.getSnapshot().state,saved);
});

test('interrupted legacy mirror writes across multiple commits cannot roll back the journal', async () => {
  const io=storage();const repository=createHandyStateRepository(io);await repository.load();
  io.failWrite=HANDY_STATE_KEY;
  await repository.update(state=>({...state,theme:'midnight'}));
  const latest=await repository.update(state=>({...state,presets:[...state.presets,{id:'second',name:'Second',enabled:false,actions:[]}]}));
  assert.equal(io.values.get(HANDY_STATE_KEY),JSON.stringify(saved));
  const restored=await createHandyStateRepository(io).load();
  assert.deepEqual(restored,latest);
  assert.equal(restored.theme,'midnight');
  assert.equal(restored.presets.length,2);
});

test('new edits by legacy clients are migrated, and deliberate empty presets stay empty', async () => {
  const io=storage();const repository=createHandyStateRepository(io);await repository.load();
  await repository.update(state=>({...state,theme:'midnight'}));
  const legacyEdit={...saved,theme:'psychedelic' as const,presets:[]};
  io.values.set(HANDY_STATE_KEY,JSON.stringify(legacyEdit));
  assert.deepEqual(await createHandyStateRepository(io).load(),legacyEdit);
  io.values.delete(HANDY_STATE_KEY);
  assert.deepEqual(await createHandyStateRepository(io).load(),legacyEdit);
});

test('damaged journal recovers valid primary without replacing the damaged bytes during read', async () => {
  const io=storage();io.values.set(HANDY_STATE_RECOVERY_KEY,'broken recovery data');
  const repository=createHandyStateRepository(io);
  assert.deepEqual(await repository.load(),saved);
  assert.equal(io.values.get(HANDY_STATE_RECOVERY_KEY),'broken recovery data');
  await repository.update(state=>({...state,theme:'midnight'}));
  assert.equal((await createHandyStateRepository(io).load()).theme,'midnight');
});

test('native recovery of an orphaned primary restores settings even after an earlier launch created an empty journal', async () => {
  const io=storage();io.values.clear();
  await createHandyStateRepository(io).load();
  // An older library lost the primary index entry. The fixed native getter can
  // now return the intact original file despite the empty fallback from before.
  io.values.set(HANDY_STATE_KEY,JSON.stringify(saved));
  const repository=createHandyStateRepository(io);
  assert.deepEqual(await repository.load(),saved);
  assert.equal(repository.getDiagnostics().source,'primary');
  assert.deepEqual(repository.getDiagnostics().primary,{status:'valid',presets:1,actions:2,legacyTheme:'paper'});
  io.values.delete(HANDY_STATE_KEY);
  assert.deepEqual(await createHandyStateRepository(io).load(),saved);
});

test('cached settings diagnostics do not perform reads/writes or expose private preset contents', async () => {
  const io=storage();let reads=0;
  const repository=createHandyStateRepository({...io,async getItem(key:string){reads++;return io.getItem(key);}});
  await repository.load();const writes=io.writes.length;const beforeReads=reads;
  const diagnostics=repository.getDiagnostics();
  assert.equal(diagnostics.primary?.presets,1);
  assert.equal(diagnostics.primary?.legacyTheme,'paper');
  assert.equal(JSON.stringify(diagnostics).includes('Keep this prefix'),false);
  assert.equal(JSON.stringify(diagnostics).includes('handyactions://'),false);
  assert.equal(JSON.stringify(diagnostics).includes('vd-origin'),false);
  diagnostics.primary!.presets=999;
  assert.equal(repository.getDiagnostics().primary?.presets,1);
  assert.equal(reads,beforeReads);
  assert.equal(io.writes.length,writes);
});

test('migration write failures retain primary, and only genuinely absent records initialize defaults', async () => {
  const io=storage();io.failWrite=HANDY_STATE_RECOVERY_KEY;
  const repository=createHandyStateRepository(io);
  await assert.rejects(repository.load());
  await assert.rejects(repository.update(()=>({presets:[]})));
  assert.equal(io.values.get(HANDY_STATE_KEY),JSON.stringify(saved));
  io.failWrite='';assert.deepEqual(await repository.load(),saved);
  const fresh=storage(undefined);fresh.values.clear();
  assert.deepEqual(await createHandyStateRepository(fresh).load(),{presets:[]});
});

test('a read failure during mutation cannot overwrite storage and a mutable draft cannot alter prior snapshots', async () => {
  const io=storage();const session=createHandyStateSession(createHandyStateRepository(io));await session.load();
  const beforeWrites=io.writes.length;
  io.failReads=true;
  assert.equal((await session.update(state=>({...state,presets:[]}),'Delete')).ok,false);
  assert.equal(io.writes.length,beforeWrites);
  assert.deepEqual(session.getSnapshot().state,saved);
  io.failReads=false;await session.load();
  const confirmed=session.getSnapshot().state;
  await session.update(state=>{state.presets[0].name='Edited';return state;},'Edit');
  assert.deepEqual(confirmed,saved);
  assert.equal((await createHandyStateRepository(io).load()).presets[0].name,'Edited');
});
