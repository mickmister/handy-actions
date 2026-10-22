import assert from 'node:assert/strict';
import test from 'node:test';
import { createVdClient, insertTag, prefixedPrompt, QueueChanged, type QueueStatus } from '../src/core/vdClient.ts';
import type { RequestSpec } from '../src/core/requestClient.ts';

const target={id:'session',workspaceId:'workspace',executor:'CLAUDE_CODE',label:'Intake · CLAUDE_CODE'};
const empty:QueueStatus={status:'empty'};
const queued:QueueStatus={status:'queued',message:{queued_at:'2026-10-22T12:00:00Z',data:{message:'Old prefix\nold prompt',executor_config:{executor:target.executor}}}};
function fixture({running=false,queues=[empty],session={id:target.id,workspace_id:target.workspaceId,executor:target.executor}}={}) {
  const calls:{path:string;spec?:RequestSpec}[]=[];
  const snapshots=[...queues];
  const client=createVdClient(async(origin,path,spec)=>{
    assert.equal(origin,'origin');calls.push({path,spec});
    let data:unknown=null;
    if(spec?.method==='POST')data={};
    else if(path.endsWith('/queue'))data=snapshots.length>1?snapshots.shift():snapshots[0];
    else if(path.includes('conversation-preview'))data={session_id:target.id,has_running_turn:running};
    else data=session;
    return {success:true,data};
  },'origin');
  return {client,calls,posts:()=>calls.filter(c=>c.spec?.method==='POST')};
}

test('fresh prompts start a verified session using the actual follow-up contract',async()=>{
  const {client,posts}=fixture();
  assert.deepEqual(await client.send(target,prefixedPrompt('new project','日本語\nfresh')),{kind:'started'});
  assert.equal(posts()[0].path,'/api/sessions/session/follow-up');
  assert.deepEqual(JSON.parse(posts()[0].spec!.body!),{prompt:'new project\n日本語\nfresh',executor_config:{executor:'CLAUDE_CODE'},retry_process_id:null,force_when_dirty:null,perform_git_reset:null});
});

test('busy sessions queue; existing messages require an explicit operation and preserve old prefixes',async()=>{
  const busy=fixture({running:true});
  assert.deepEqual(await busy.client.send(target,'fresh'),{kind:'queued'});
  assert.equal(busy.posts()[0].path,'/api/sessions/session/queue');
  const occupied=fixture({running:true,queues:[queued]});
  assert.deepEqual(await occupied.client.send(target,'fresh'),{kind:'needs-choice',queue:queued});
  assert.equal(occupied.posts().length,0);
  await occupied.client.send(target,prefixedPrompt('New prefix','new prompt'),{operation:'append',expected:queued});
  assert.equal(JSON.parse(occupied.posts()[0].spec!.body!).message,'Old prefix\nold prompt\nNew prefix\nnew prompt');
  const replacement=fixture({queues:[queued]});
  await replacement.client.send(target,'replacement',{operation:'overwrite',expected:queued});
  assert.equal(JSON.parse(replacement.posts()[0].spec!.body!).message,'replacement');
});

test('changed queues and stale locked destinations fail without a write',async()=>{
  const changed={...queued,message:{...queued.message,queued_at:'later'}};
  for(const queues of [[changed],[queued,changed],[empty,queued]]) {
    const instance=fixture({running:true,queues});
    const edit=queues[0].status==='queued'?{operation:'append' as const,expected:queued}:undefined;
    await assert.rejects(instance.client.send(target,'prompt',edit),QueueChanged);
    assert.equal(instance.posts().length,0);
  }
  for(const session of [{id:target.id,workspace_id:'other',executor:target.executor},{id:target.id,workspace_id:target.workspaceId,executor:'OTHER'},{id:'other',workspace_id:target.workspaceId,executor:target.executor}]) {
    const stale=fixture({session});await assert.rejects(stale.client.send(target,'prompt'),/changed/);assert.equal(stale.posts().length,0);
  }
});

test('empty prompts cannot send a prefix; tags replace the selected range using actual tag content',async()=>{
  assert.throws(()=>prefixedPrompt('prefix',' \n '),/Enter a prompt/);
  assert.equal(prefixedPrompt(' prefix ','fresh'),' prefix \nfresh');
  const {client,calls}=fixture();await assert.rejects(client.send(target,''),/Enter a prompt/);assert.equal(calls.length,0);
  assert.deepEqual(insertTag('before DELETE after',{start:7,end:13},{id:'t',tag_name:'context',content:'<context>日本語</context>'}),{
    text:'before <context>日本語</context> after',selection:{start:29,end:29},
  });
});
