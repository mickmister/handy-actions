import assert from 'node:assert/strict';
import test from 'node:test';
import { createPresetRepository, HANDY_STATE_KEY, HANDY_STATE_RECOVERY_KEY, HANDY_STATE_BEFORE_RESTORE } from '../src/core/handyStateRepository.ts';
import { createHandyStateSession } from '../src/core/handyStateSession.ts';
import { createThemeRepository, THEME_PREFERENCE_KEY } from '../src/core/themeRepository.ts';
import { mergeRecoveredPresets, presetRecoveryCandidates } from '../src/core/presetRecovery.ts';
import type { HandyState } from '../src/core/handyModel.ts';

const original: HandyState = {theme:'paper',presets:[{id:'old',name:'My original actions',enabled:true,actions:[
  {id:'send',name:'Agent',payload:{type:'vd-agent',originId:'vd',prefix:'Original exact prompt\n',session:{id:'session',workspaceId:'workspace',label:'Original session',executor:'CLAUDE_CODE'}}},
  {id:'note',name:'Note',payload:{type:'notes'}},
]}]};
function store(initial: [string,string][] = []) {
  const values = new Map(initial);
  const io = {values,reads:[] as string[],writes:[] as string[],failReads:false,failWritePrefix:'',
    async getItem(key:string){io.reads.push(key);if(io.failReads)throw new Error('Unavailable');return values.get(key) ?? null;},
    async setItem(key:string,value:string){io.writes.push(key);if(io.failWritePrefix && key.startsWith(io.failWritePrefix))throw new Error('Write failed');values.set(key,value);},
  };
  return io;
}
function fixture(state: HandyState = original) {
  const presets=store([[HANDY_STATE_KEY,JSON.stringify(state)]]);const vault=store();
  const repository=createPresetRepository(presets);const themes=createThemeRepository(vault);
  const session=createHandyStateSession(repository,themes);
  return {presets,vault,repository,themes,session};
}

test('theme-only changes use only the preference vault, preserve original preset bytes and survive restart', async () => {
  const {presets,vault,session}=fixture();await session.load();
  assert.equal(session.getSnapshot().state.theme,'paper');
  const before=new Map(presets.values);const reads=presets.reads.length;const writes=presets.writes.length;
  assert.equal((await session.updateTheme('midnight')).ok,true);
  assert.deepEqual(presets.values,before);
  assert.equal(presets.reads.length,reads);assert.equal(presets.writes.length,writes);
  assert.ok(vault.writes.every(key=>key===THEME_PREFERENCE_KEY));
  const restarted=createHandyStateSession(createPresetRepository(presets),createThemeRepository(vault));await restarted.load();
  assert.equal(restarted.getSnapshot().state.theme,'midnight');
  assert.deepEqual(restarted.getSnapshot().state.presets,original.presets);
});

test('theme can be changed before any preset load or while preset reads fail, with zero preset IO', async () => {
  const {presets,vault,session}=fixture();presets.failReads=true;
  assert.equal((await session.updateTheme('midnight')).ok,true);
  assert.deepEqual(presets.reads,[]);assert.deepEqual(presets.writes,[]);
  assert.equal(session.getSnapshot().loaded,false);assert.equal(session.getSnapshot().refreshReady,false);
  await session.load();
  const reads=presets.reads.length;
  assert.equal((await session.updateTheme('paper')).ok,true);
  assert.equal(presets.reads.length,reads);assert.deepEqual(presets.writes,[]);
  assert.deepEqual(presets.values.get(HANDY_STATE_KEY),JSON.stringify(original));
  assert.equal((await createThemeRepository(vault).load()).theme,'paper');
});

test('preset edits strip legacy theme fields and never save the preference vault', async () => {
  const {presets,vault,session}=fixture();await session.load();await session.updateTheme('midnight');
  const preference=new Map(vault.values);const reads=vault.reads.length;const writes=vault.writes.length;
  await session.update(state=>({...state,presets:[...state.presets,{id:'new',name:'New',enabled:false,actions:[]}]}),'Add');
  assert.equal(Object.hasOwn(JSON.parse(presets.values.get(HANDY_STATE_KEY)!),'theme'),false);
  assert.equal(Object.hasOwn(JSON.parse(presets.values.get(HANDY_STATE_RECOVERY_KEY)!).state,'theme'),false);
  assert.deepEqual(vault.values,preference);assert.equal(vault.reads.length,reads);assert.equal(vault.writes.length,writes);
  assert.equal(session.getSnapshot().state.theme,'midnight');
});

test('legacy migration cannot overwrite an already saved independent theme', async () => {
  const {vault,session}=fixture();await createThemeRepository(vault).save('midnight');
  const writes=vault.writes.length;await session.load();
  assert.equal(session.getSnapshot().state.theme,'midnight');assert.equal(vault.writes.length,writes);
});

test('a delayed legacy preference migration survives preset edits and restart while the preference vault is unavailable', async () => {
  const {presets,vault,session}=fixture();vault.failReads=true;await session.load();
  await session.update(state=>({...state,presets:[...state.presets,{id:'new',name:'New preset',enabled:false,actions:[]}]}),'Add');
  assert.equal(JSON.parse(presets.values.get(HANDY_STATE_KEY)!).theme,undefined);
  vault.failReads=false;
  const restarted=createHandyStateSession(createPresetRepository(presets),createThemeRepository(vault));await restarted.load();
  assert.equal(restarted.getSnapshot().state.theme,'paper');
  assert.equal(restarted.getSnapshot().state.presets.length,2);
});

test('a theme chosen while presets are still loading wins over the delayed legacy seed', async () => {
  const presets=store([[HANDY_STATE_KEY,JSON.stringify(original)]]);const vault=store();
  let release!: () => void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const repository=createPresetRepository({...presets,async getItem(key:string){await gate;return presets.getItem(key);}});
  const session=createHandyStateSession(repository,createThemeRepository(vault));
  const loading=session.load();
  assert.equal((await session.updateTheme('midnight')).ok,true);
  release();await loading;
  assert.equal(session.getSnapshot().state.theme,'midnight');
  assert.equal((await createThemeRepository(vault).load()).theme,'midnight');
  assert.deepEqual(session.getSnapshot().state.presets,original.presets);
});

test('theme read/write failures do not block preset edits or modify preset records', async () => {
  const {presets,vault,session}=fixture();vault.failReads=true;await session.load();
  assert.equal(session.getSnapshot().loaded,true);assert.equal(session.getSnapshot().themeLoaded,false);
  assert.equal((await session.update(state=>({...state,presets:state.presets.map(p=>({...p,name:'Edited'}))}),'Edit')).ok,true);
  const before=new Map(presets.values);const writes=presets.writes.length;
  vault.failWritePrefix=THEME_PREFERENCE_KEY;
  assert.equal((await session.updateTheme('midnight')).ok,false);
  assert.equal(session.getSnapshot().loaded,true);assert.deepEqual(presets.values,before);assert.equal(presets.writes.length,writes);
  vault.failWritePrefix='';assert.equal((await session.updateTheme('paper')).ok,true);
  assert.equal(session.getSnapshot().refreshReady,true);
});

test('candidate parsing finds original presets in old files/journals, excludes themes and deduplicates snapshots', () => {
  const raw=JSON.stringify(original);
  const candidates=presetRecoveryCandidates([
    {id:'orphan',source:'Original file',raw},
    {id:'journal',source:'Journal',raw:JSON.stringify({version:1,state:{presets:[]},legacyBase:raw})},
    {id:'broken',source:'Broken',raw:'broken'},
    {id:'empty',source:'Empty',raw:'{"presets":[],"theme":"midnight"}'},
  ]);
  assert.equal(candidates.length,1);assert.deepEqual(candidates[0].state.presets,original.presets);
  assert.equal(candidates[0].state.theme,undefined);
});

test('recovering after an empty theme-only save restores actions while retaining the selected independent theme', async () => {
  const {presets,vault,session}=fixture({presets:[],theme:'midnight'});await session.load();
  presets.values.set('handy-actions/notes/v1','Retained notes');
  const beforePrimary=presets.values.get(HANDY_STATE_KEY);
  const candidate=presetRecoveryCandidates([{id:'old-file',source:'Original',raw:JSON.stringify(original)}])[0];
  assert.equal((await session.restorePresets(candidate.state)).ok,true);
  assert.deepEqual(session.getSnapshot().state.presets,original.presets);assert.equal(session.getSnapshot().state.theme,'midnight');
  assert.equal(presets.values.get('handy-actions/notes/v1'),'Retained notes');
  const archived=[...presets.values.entries()].find(([key])=>key.startsWith(HANDY_STATE_BEFORE_RESTORE));
  assert.ok(archived);assert.equal(JSON.parse(archived[1]).primary,beforePrimary);
  const restarted=createHandyStateSession(createPresetRepository(presets),createThemeRepository(vault));await restarted.load();
  assert.deepEqual(restarted.getSnapshot().state.presets,original.presets);assert.equal(restarted.getSnapshot().state.theme,'midnight');
});

test('recovery merges missing actions without replacing current edits or duplicating IDs', () => {
  const current:HandyState={theme:'midnight',presets:[{...original.presets[0],name:'Current name',actions:[{id:'send',name:'Edited agent',payload:{type:'notes'}}]}]};
  const merged=mergeRecoveredPresets(current,original);
  assert.equal(merged.theme,'midnight');assert.equal(merged.presets[0].name,'Current name');
  assert.deepEqual(merged.presets[0].actions.map(action=>action.id),['send','note']);
  assert.deepEqual(merged.presets[0].actions[0],current.presets[0].actions[0]);
  assert.deepEqual(mergeRecoveredPresets(merged,original),merged);
});

test('explicit recovery archives corrupt current records before restoring; an archive failure makes no destructive writes', async () => {
  const {presets,session}=fixture();presets.values.set(HANDY_STATE_KEY,'broken primary');presets.values.set(HANDY_STATE_RECOVERY_KEY,'broken journal');
  await session.load();assert.equal(session.getSnapshot().loaded,false);
  presets.failWritePrefix=HANDY_STATE_BEFORE_RESTORE;
  assert.equal((await session.restorePresets(original)).ok,false);
  assert.equal(presets.values.get(HANDY_STATE_KEY),'broken primary');assert.equal(presets.values.get(HANDY_STATE_RECOVERY_KEY),'broken journal');
  presets.failWritePrefix='';assert.equal((await session.restorePresets(original)).ok,true);
  const archive=[...presets.values.entries()].find(([key])=>key.startsWith(HANDY_STATE_BEFORE_RESTORE));
  assert.equal(JSON.parse(archive![1]).primary,'broken primary');assert.equal(JSON.parse(archive![1]).recovery,'broken journal');
  assert.deepEqual(session.getSnapshot().state.presets,original.presets);
});
