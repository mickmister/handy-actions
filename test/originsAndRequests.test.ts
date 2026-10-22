import assert from 'node:assert/strict';
import test from 'node:test';
import { createOriginRepository, originUrl, type OriginProfile } from '../src/core/originRepository.ts';
import { createRequestClient, RequestFailure, type Transport } from '../src/core/requestClient.ts';
import { httpRequestSpec } from '../src/core/httpActions.ts';

const profile: OriginProfile = { id:'vd',name:'My VD',origin:'https://vd.example.test',headers:[
  {name:'Authorization',mode:'secret',value:'Bearer private-token'},
  {name:'X-Client',mode:'plaintext',value:'Handy'},
] };
function vaultFixture() {
  const values=new Map<string,string>();
  return {values,vault:{async getItem(key:string){return values.get(key)??null;},async setItem(key:string,value:string){values.set(key,value);},async removeItem(key:string){values.delete(key);}}};
}

test('secure profiles survive repository restart while saved secrets remain write-only',async()=>{
  const {vault}=vaultFixture();
  await createOriginRepository(vault).save(profile);
  const restarted=createOriginRepository(vault);
  const [summary]=await restarted.list();
  assert.equal(JSON.stringify(summary).includes('private-token'),false);
  assert.deepEqual(summary.headers[0],{name:'Authorization',mode:'secret',configured:true});
  assert.equal(summary.headers[1].value,'Handy');
  await restarted.save({...profile,name:'Renamed',headers:[{name:'authorization',mode:'secret'}]});
  assert.equal((await restarted.connection('vd')).headers[0].value,'Bearer private-token');
  for(const value of [undefined,'']) {
    await assert.rejects(restarted.save({...profile,headers:[{name:'authorization',mode:'plaintext',value}]}),/replacement|new non-empty/);
  }
  await restarted.save({...profile,headers:[{name:'authorization',mode:'plaintext',value:'new public value'}]});
  assert.equal((await restarted.list())[0].headers[0].value,'new public value');
  await restarted.remove('vd');
  assert.deepEqual(await restarted.list(),[]);
  await assert.rejects(restarted.connection('vd'),/missing/);
});

test('origin/header validation rejects credential escapes and malformed transport headers',async()=>{
  const repository=createOriginRepository(vaultFixture().vault);
  for(const origin of ['https://user:pass@vd.example.test','https://vd.example.test/api','https://vd.example.test/?key=token','file:///']) {
    await assert.rejects(repository.save({...profile,origin}));
  }
  for(const headers of [
    [{name:'Authorization',mode:'secret' as const,value:'first\r\nInjected: second'}],
    [{name:'Host',mode:'plaintext' as const,value:'other.example.test'}],
    [{name:'Authorization',mode:'secret' as const,value:'a'},{name:'authorization',mode:'plaintext' as const,value:'b'}],
  ]) await assert.rejects(repository.save({...profile,headers}));
  for(const path of ['//attacker.test/path','https://attacker.test','/\\attacker.test','/api\r\nX: y','/api#fragment'])assert.throws(()=>originUrl(profile.origin,path));
  assert.equal(originUrl(profile.origin,'/api?a=b'),'https://vd.example.test/api?a=b');
});

test('requests refuse redirects, omit browser credentials and never expose echoed secrets or native errors',async()=>{
  const calls:{url:string;init:RequestInit}[]=[];
  const transport:Transport=async(url,init)=>{
    calls.push({url,init});
    return new Response(JSON.stringify({nested:['Echo Bearer private-token','private-token','Bearer%20private-token'], 'Bearer private-token':'also Bearer private-token'}),{status:200});
  };
  const request=createRequestClient(async()=>profile,transport);
  const result=await request('vd','/api/test');
  assert.equal(JSON.stringify(result).includes('private-token'),false);
  assert.deepEqual(result,{nested:['Echo [secret]','[secret]','[secret]'],'[secret]':'also [secret]'});
  assert.equal(calls[0].init.redirect,'error');assert.equal(calls[0].init.credentials,'omit');
  assert.equal((calls[0].init.headers as Record<string,string>).authorization,'Bearer private-token');
  await assert.rejects(request('vd','//attacker.test'));assert.equal(calls.length,1);
  let attempts=0;
  for(const response of [new Response('Bearer private-token',{status:302}),new Response('Bearer private-token',{status:500})]) {
    const failing=createRequestClient(async()=>profile,async()=>{attempts++;return response;});
    await assert.rejects(failing('vd','/api',{method:'POST',body:'prompt'}),error=>error instanceof RequestFailure&&!error.message.includes('private-token'));
  }
  const failing=createRequestClient(async()=>profile,async()=>{attempts++;throw new Error('Bearer private-token');});
  await assert.rejects(failing('vd','/api'),error=>error instanceof RequestFailure&&!error.message.includes('private-token'));
  assert.equal(attempts,3);
});

test('a hung request aborts at the deadline without an automatic retry',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let attempts=0;
  const request=createRequestClient(async()=>profile,async(_url,init)=>{
    attempts++;
    return new Promise((_resolve,reject)=>init.signal!.addEventListener('abort',()=>reject(new Error('aborted'))));
  });
  const pending=request('vd','/api',{method:'POST'});
  const rejected=assert.rejects(pending,RequestFailure);
  await new Promise(resolve=>setImmediate(resolve));
  t.mock.timers.tick(20001);
  await rejected;assert.equal(attempts,1);
});

test('HTTP text substitution escapes URL text and structured JSON without altering JSON keys',()=>{
  const text='a/b? &日本語\n"quoted" \\ end';
  const spec=httpRequestSpec({type:'http',originId:'vd',path:'/api/{text}',method:'POST',bodyFormat:'json',body:'{"prompt":"prefix {text}","items":["{text}",3],"{text}":"unchanged key"}',captureText:true},text);
  assert.equal(spec.path,'/api/'+encodeURIComponent(text));
  assert.deepEqual(JSON.parse(spec.body!),{prompt:'prefix '+text,items:[text,3],'{text}':'unchanged key'});
  assert.throws(()=>httpRequestSpec({type:'http',originId:'vd',path:'/api',method:'POST',bodyFormat:'none',body:'',captureText:true},' \n'),/Enter text/);
});
