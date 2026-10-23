import assert from 'node:assert/strict';
import test from 'node:test';
import { createOriginRepository, originKey, type OriginProfile } from '../src/core/originRepository.ts';
import { testVdConnection } from '../src/core/vdConnectionTest.ts';
import { diagnosticText } from '../src/core/requestClient.ts';

const profile:OriginProfile={id:'vd',name:'VD',origin:'https://vd.example.test',headers:[
  {name:'Authorization',mode:'secret',value:'Bearer private-token'},
  {name:'X-Client',mode:'plaintext',value:'Handy'},
]};
function fixture() {
  const values=new Map<string,string>();
  const vault={async getItem(key:string){return values.get(key)??null;},async setItem(key:string,value:string){values.set(key,value);},async removeItem(key:string){values.delete(key);}};
  return {values,repository:createOriginRepository(vault)};
}

test('testing the current form resolves unchanged secrets and unsaved edits without modifying storage',async()=>{
  const {values,repository}=fixture();await repository.save(profile);
  const stored=[...values];
  const connection=await repository.previewConnection({...profile,origin:'https://other.example.test',headers:[
    {name:'authorization',mode:'secret'}, {name:'X-Client',mode:'plaintext',value:'Edited client'},
  ]});
  const result=await testVdConnection(connection,async(url,init)=>{
    assert.equal(url,'https://other.example.test/api/workspaces');assert.equal(init.method,'GET');
    assert.equal((init.headers as Record<string,string>).authorization,'Bearer private-token');
    assert.equal((init.headers as Record<string,string>)['x-client'],'Edited client');
    assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');
    return new Response(JSON.stringify({success:true,data:[]}),{status:200});
  });
  assert.equal(result.ok,true);assert.match(result.message,/0 workspaces/);assert.deepEqual([...values],stored);
  assert.equal(JSON.stringify(await repository.list()).includes('private-token'),false);
});

test('a new connection and a replacement secret can be tested before saving',async()=>{
  const {values,repository}=fixture();
  const connection=await repository.previewConnection(profile);
  const success=await testVdConnection(connection,async()=>new Response(JSON.stringify({success:true,data:[{id:'workspace'}]})));
  assert.equal(success.ok,true);assert.equal(values.size,0);
  await repository.save(profile);
  const replacement=await repository.previewConnection({...profile,headers:[{name:'Authorization',mode:'secret',value:'Bearer replacement-token'}]});
  assert.equal(replacement.headers[0].value,'Bearer replacement-token');
  assert.equal((await repository.connection('vd')).headers[0].value,'Bearer private-token');
  await assert.rejects(repository.previewConnection({...profile,headers:[{name:'Authorization',mode:'plaintext'}]}),/new non-empty/);
});

test('corrupt secure storage cannot expose a saved secret in preparation errors',async()=>{
  const {values,repository}=fixture();await repository.save(profile);
  values.set(originKey(profile.id),'{"secret":"Bearer private-token" broken');
  await assert.rejects(repository.previewConnection(profile),error=>error instanceof Error && /secure origin/.test(error.message) && !error.message.includes('private-token'));
});

test('connection diagnostics show HTTP/auth/server details while scrubbing secret values and encodings',async()=>{
  const result=await testVdConnection(profile,async()=>new Response(JSON.stringify({
    error:'Authorization denied: Bearer private-token',detail:'private-token and Bearer%20private-token',
  }),{status:401,statusText:'Unauthorized',headers:{'www-authenticate':'Bearer error="invalid_token"','x-request-id':'request-123'}}));
  assert.equal(result.ok,false);assert.match(result.message,/HTTP 401/);assert.match(result.message,/Unauthorized/);
  assert.match(result.message,/invalid_token/);assert.match(result.message,/request-123/);assert.match(result.message,/Authorization denied/);
  assert.equal(result.message.includes('private-token'),false);
});

test('non-VD JSON, error envelopes, non-JSON pages and redirects fail with useful safe details',async()=>{
  for(const body of [JSON.stringify({success:false,message:'VD not ready'}),JSON.stringify({success:true,data:['not a workspace']}),'<html>Sign in to VD</html>']) {
    const result=await testVdConnection(profile,async()=>new Response(body,{status:200}));
    assert.equal(result.ok,false);assert.match(result.message,/HTTP 200/);assert.match(result.message,/workspace-list|Expected JSON/);
    assert.equal(result.message.includes('private-token'),false);
  }
  let requests=0;
  const redirect=await testVdConnection(profile,async()=>{requests++;return new Response('Use the correct origin',{status:302});});
  assert.equal(redirect.ok,false);assert.match(redirect.message,/HTTP 302/);assert.equal(requests,1);
});

test('network failure diagnostics expose useful native messages without echoing credentials',async()=>{
  const result=await testVdConnection(profile,async()=>{throw new Error('TLS certificate rejected for Bearer private-token');});
  assert.equal(result.ok,false);assert.match(result.message,/TLS certificate rejected/);assert.equal(result.message.includes('private-token'),false);
});

test('redaction precedes truncation and handles JSON-escaped secret values',()=>{
  const text=diagnosticText('x'.repeat(3990)+'private-token',profile);
  assert.equal(text.includes('private-'),false);
  const special={...profile,headers:[{name:'Authorization',mode:'secret' as const,value:'Bearer quoted"token\\tail'}]};
  const escaped=JSON.stringify({error:special.headers[0].value});
  assert.equal(diagnosticText(escaped,special).includes('quoted'),false);
});

test('connection tests report a bounded timeout without retrying',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let attempts=0;
  const pending=testVdConnection(profile,async(_url,init)=>{
    attempts++;
    return new Promise((_resolve,reject)=>init.signal!.addEventListener('abort',()=>reject(new Error('abort'))));
  });
  await new Promise(resolve=>setImmediate(resolve));t.mock.timers.tick(20001);
  const result=await pending;assert.equal(result.ok,false);assert.match(result.message,/timed out after 20 seconds/);assert.equal(attempts,1);
});
