import { validateHandyState, type HandyAction } from './handyModel.ts';

export type NativeActionInbox = {read():Promise<unknown[]>;acknowledge(id:string):Promise<void>};
type Repository = {
  queueNote(action:HandyAction,text:string,id:string,presetId?:string):Promise<unknown>;
  markNoteAttempt(id:string):Promise<void>;completeNote(id:string):Promise<void>;
};
export function createActionInboxImporter(inbox:NativeActionInbox|undefined, repository:Repository,
  saveEmpty:(action:HandyAction,id:string,presetId?:string)=>Promise<unknown>) {
  let importing:Promise<void>|undefined;
  return function importActions():Promise<void> {
    if(!inbox)return Promise.resolve();
    if(importing)return importing;
    importing=(async()=>{
      for(const raw of await inbox.read()) {
        if(!raw || typeof raw!=='object')throw new Error('A captured action could not be read; native copy retained.');
        const record=raw as Record<string,unknown>;
        if(typeof record.id!=='string'||!record.id||typeof record.text!=='string'||typeof record.completed!=='boolean'||
          !validateHandyState({presets:[{id:'native',name:'Native',enabled:false,actions:[record.action]}]}).ok)throw new Error('Invalid captured action; native copy retained.');
        const action=record.action as HandyAction;
        if(record.completed)await repository.completeNote(record.id);
        else if(record.text.trim()) {
          const pending=await repository.queueNote(action,record.text,record.id,typeof record.presetId==='string'?record.presetId:undefined);
          if(pending)await repository.markNoteAttempt(record.id);
        } else await saveEmpty(action,record.id,typeof record.presetId==='string'?record.presetId:undefined);
        await inbox.acknowledge(record.id);
      }
    })().finally(()=>{importing=undefined;});
    return importing;
  };
}
