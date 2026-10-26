import type { AgentActionPayload } from './handyModel';
import { acceptedAgentSends } from './acceptedAgentSends';
export const agentReplyTrackingAvailable = false;
export async function prepareAgentReply(_id: string, _payload: AgentActionPayload, _prompt: string, _origin: string) {}
export const agentSendReceipts = acceptedAgentSends(async()=>{});
export async function resumeAgentReplies() { await agentSendReceipts.reconcile(); }
