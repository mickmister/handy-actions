import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeId, type AgentSession, type HandyAction } from './handyModel';
export type EditorDraft = { id: string; action: HandyAction; presetId?: string; text: string; createdAt: string; session?:AgentSession; submissionId?:string; sourceNoteId?:string; sourceNoteIds?:string[]; combineStep?: 'order' | 'destination' | 'review' };
const PREFIX = 'handy-actions/editor-draft/';
let writes:Promise<unknown>=Promise.resolve();
function serialize<T>(work:()=>Promise<T>):Promise<T> {const next=writes.then(work);writes=next.catch(()=>{});return next;}
export function saveEditorDraft(action: HandyAction, text: string, presetId?: string, id = makeId('editor'), context:Pick<EditorDraft,'session'|'submissionId'|'sourceNoteId'|'sourceNoteIds'|'combineStep'>={}) {
  const draft: EditorDraft = { id, action, text, presetId, createdAt: new Date().toISOString(),...context };
  return serialize(async()=>{await AsyncStorage.setItem(PREFIX + id, JSON.stringify(draft)); return draft;});
}
export async function readEditorDraft(id: string): Promise<EditorDraft | undefined> { const raw = await AsyncStorage.getItem(PREFIX+id); return raw ? JSON.parse(raw) : undefined; }
export function removeEditorDraft(id: string) { return serialize(()=>AsyncStorage.removeItem(PREFIX+id)); }
export async function listEditorDrafts(): Promise<EditorDraft[]> { const keys = (await AsyncStorage.getAllKeys()).filter(k=>k.startsWith(PREFIX)); const values = await Promise.all(keys.map(key=>AsyncStorage.getItem(key))); return values.flatMap(v=>v ? [JSON.parse(v) as EditorDraft] : []); }
