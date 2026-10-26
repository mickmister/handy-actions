import type { HandyNote } from './noteRepository.ts';

export function combineNotes(notes: HandyNote[], orderedIds: string[]): string {
  const ids = [...new Set(orderedIds)];
  if (ids.length < 2) throw new Error('Select at least two notes.');
  return ids.map(id => {
    const note = notes.find(entry => entry.id === id);
    if (!note || note.status === 'completed') throw new Error('A selected note is no longer pending. Select notes again.');
    return note.text;
  }).join('\n\n');
}
