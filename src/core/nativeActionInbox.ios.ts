import { requireOptionalNativeModule } from 'expo';
import type { NativeActionInbox } from './actionInboxImporter';
const widgets=requireOptionalNativeModule<{
  readHandyActionInbox?:()=>Promise<unknown[]>;acknowledgeHandyAction?:(id:string)=>Promise<void>;
}>('ExpoWidgets');
export const nativeActionInbox:NativeActionInbox|undefined=widgets?.readHandyActionInbox&&widgets?.acknowledgeHandyAction ? {
  read:()=>widgets.readHandyActionInbox!(),acknowledge:id=>widgets.acknowledgeHandyAction!(id),
}:undefined;
