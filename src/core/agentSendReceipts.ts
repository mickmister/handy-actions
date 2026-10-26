import type { HandyAction } from './handyModel.ts';

export type AgentSendReceipt = {
  id: string;
  action: HandyAction;
  sources: string[];
  result: {kind:'started'|'queued';processId?:string};
  prompt: string;
};
type Storage = {
  getItem(key:string):Promise<string|null>;
  setItem(key:string,value:string):Promise<void>;
  removeItem(key:string):Promise<void>;
  getAllKeys():Promise<readonly string[]>;
};
const prefix = 'handy-actions/accepted-agent-send/';
export const acceptedAgentSendKey = (id: string) => prefix + id;

// The send has already succeeded. Reconciliation applies local effects only;
// it must never call the side-effecting VD send endpoint again.
export function createAgentSendReceipts(storage: Storage, apply: (receipt: AgentSendReceipt)=>Promise<void>) {
  let tail: Promise<unknown> = Promise.resolve();
  function serialize<T>(work:()=>Promise<T>) {
    const next=tail.then(work);tail=next.catch(()=>{});return next;
  }
  return {
    record(receipt: AgentSendReceipt) {
      return serialize(async()=>{
        await storage.setItem(prefix+receipt.id,JSON.stringify(receipt));
        await apply(receipt);
        await storage.removeItem(prefix+receipt.id);
      });
    },
    reconcile() {
      return serialize(async()=>{
        for(const key of (await storage.getAllKeys()).filter(key=>key.startsWith(prefix))) {
          const raw=await storage.getItem(key);
          if(!raw)continue;
          await apply(JSON.parse(raw));
          await storage.removeItem(key);
        }
      });
    },
  };
}
