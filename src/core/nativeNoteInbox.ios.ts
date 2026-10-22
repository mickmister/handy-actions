import { requireOptionalNativeModule } from 'expo';

import type { NativeNoteInbox } from './noteInboxImporter';

// These small APIs are supplied by our pinned expo-widgets native patch. An
// older installed binary must not receive local no-foreground category actions.
const widgets = requireOptionalNativeModule<{
  readHandyNoteInbox?: () => Promise<unknown[]>;
  acknowledgeHandyNote?: (id: string) => Promise<void>;
}>('ExpoWidgets');

export const nativeNoteInbox: NativeNoteInbox | undefined =
  widgets?.readHandyNoteInbox && widgets?.acknowledgeHandyNote ? {
    read: () => widgets.readHandyNoteInbox!(),
    acknowledge: (id) => widgets.acknowledgeHandyNote!(id),
  } : undefined;
