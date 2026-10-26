import { requireOptionalNativeModule } from 'expo';
import type { AgentActionPayload } from './handyModel';
import { acceptedAgentSends } from './acceptedAgentSends';

const native = requireOptionalNativeModule<{
  prepareHandyReplyWatch?: (json: string) => Promise<void>;
  acceptHandyReplyWatch?: (json: string) => Promise<void>;
  resumeHandyReplyWatches?: () => Promise<void>;
}>('ExpoWidgets');

export const agentReplyTrackingAvailable = !!native?.prepareHandyReplyWatch && !!native?.acceptHandyReplyWatch;
export async function prepareAgentReply(id: string, payload: AgentActionPayload, prompt: string, origin: string) {
  if (agentReplyTrackingAvailable) await native!.prepareHandyReplyWatch!(JSON.stringify({id,payload,prompt,origin}));
}
async function acceptAgentReply(id: string, result: {kind:'started'|'queued';processId?:string}, prompt: string) {
  if (agentReplyTrackingAvailable) await native!.acceptHandyReplyWatch!(JSON.stringify({id,processId:result.processId,...(result.kind==='queued'?{queuedPrompt:prompt}:{})}));
}
export const agentSendReceipts = acceptedAgentSends(receipt=>acceptAgentReply(receipt.id,receipt.result,receipt.prompt));
export async function resumeAgentReplies() {
  await agentSendReceipts.reconcile();
  await native?.resumeHandyReplyWatches?.();
}
