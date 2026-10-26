import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAgentSendReceipts, type AgentSendReceipt } from './agentSendReceipts';
import { confirmAgentHandoff } from './handyNotes';

export function acceptedAgentSends(bind: (receipt:AgentSendReceipt)=>Promise<void>) {
  return createAgentSendReceipts(AsyncStorage,async receipt=>{
    await confirmAgentHandoff(receipt.id,receipt.sources,receipt.action,receipt.result.kind);
    await bind(receipt);
  });
}
