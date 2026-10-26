import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Choice, Field, useFormStyles } from './FormControls';
import { useAppTheme } from '@/src/hooks/useAppTheme';
import { createVdClient, displayName, sessionLabel, sessionRef, type Session, type Workspace } from '@/src/core/vdClient';
import { request } from '@/src/core/requests';
import { loadFavorites, updateFavorite, type Favorite } from '@/src/core/agentFavorites';
import type { AgentSession } from '@/src/core/handyModel';
import { workspacePage } from '@/src/core/workspacePagination';

export function SessionPicker({ originId, value, onSelect, disabled = false }: { originId: string; value?: AgentSession; onSelect(value: AgentSession): void; disabled?: boolean }) {
  const styles = useFormStyles();
  const { colors } = useAppTheme();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [workspace, setWorkspace] = useState('');
  const [alias, setAlias] = useState('');
  const [message, setMessage] = useState('');
  const [sessionMessage, setSessionMessage] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const visible = workspacePage(workspaces.filter(w => displayName(w.name,w.created_at).toLowerCase().includes(filter.toLowerCase())), page);
  const selectedWorkspace = workspaces.find(w => w.id === workspace);
  const generation = useRef(0);
  const workspaceGeneration = useRef(0);
  const currentOrigin=useRef(originId);currentOrigin.current=originId;
  async function refresh() { if(currentOrigin.current!==originId)return;const gen = ++workspaceGeneration.current; setMessage('Loading recent workspaces…'); try { const [ws, fs] = await Promise.all([createVdClient(request, originId).workspaces(), loadFavorites()]); if (gen !== workspaceGeneration.current || currentOrigin.current!==originId) return; setWorkspaces(ws); setPage(0); setFavorites(fs.filter(f => f.originId === originId)); setMessage(ws.length ? '' : 'No active workspaces.'); } catch (e) { if (gen === workspaceGeneration.current && currentOrigin.current === originId) setMessage(String(e instanceof Error ? e.message : 'Could not load workspaces.')); } }
  useEffect(() => { setWorkspace(''); setSessions([]); setSessionMessage(''); setWorkspaces([]); setFavorites([]); setFilter(''); setPage(0); if (originId) void refresh(); return () => { generation.current++; workspaceGeneration.current++; }; }, [originId]);
  async function chooseWorkspace(w: Workspace) { const gen = ++generation.current; setWorkspace(w.id); setSessions([]); setMessage(''); setSessionMessage('Loading sessions…'); try { const list = await createVdClient(request, originId).sessions(w.id); if (gen !== generation.current || currentOrigin.current !== originId) return; setSessions(list); setSessionMessage(list.length ? '' : 'This workspace has no sessions.'); } catch (e) { if (gen === generation.current && currentOrigin.current === originId) setSessionMessage(e instanceof Error ? e.message : 'Could not load sessions.'); } }
  return <View style={styles.card} pointerEvents={disabled?'none':'auto'} accessibilityElementsHidden={disabled}><Text style={styles.label}>Destination session</Text>
    {favorites.length ? <Text style={styles.copy}>Pinned favorites</Text> : null}
    {favorites.filter(f=>f.originId===originId).map(f => <View key={f.session.id} style={styles.row}><Choice selected={value?.id === f.session.id} label={`${f.name} · ${f.session.executor}`} onPress={() => { onSelect(f.session); setAlias(f.name); }} /><Choice label="Unpin" onPress={() => { void updateFavorite(f,true).then(refresh).catch(()=>setMessage('Could not remove favorite.')); }} /></View>)}
    {workspace ? <View style={{ gap: 8 }}>
      <Text style={styles.label}>Selected workspace</Text>
      <Text style={styles.copy}>{selectedWorkspace ? displayName(selectedWorkspace.name, selectedWorkspace.created_at) : workspace}</Text>
      <Choice label="Change workspace" disabled={disabled} onPress={() => {
        generation.current++;
        setWorkspace(''); setSessions([]); setSessionMessage(''); setMessage('');
      }} />
    </View> : <View style={{ gap: 12 }}>
    <Text style={styles.label}>Workspaces</Text>
    <Field label="Find workspace" value={filter} editable={!disabled} onChangeText={text => { setFilter(text); setPage(0); }} />
    {visible.items.map(w => <Choice key={w.id} disabled={disabled} selected={workspace === w.id} label={`${displayName(w.name,w.created_at)} · updated ${new Date(w.updated_at).toLocaleString()}`} onPress={() => void chooseWorkspace(w)} />)}
    {visible.total ? <Text accessibilityLiveRegion="polite" style={styles.copy}>Page {visible.page + 1} of {visible.pageCount} · {visible.first}–{visible.last} of {visible.total} workspaces</Text>
      : filter ? <Text style={styles.copy}>No matching workspaces.</Text> : null}
    {visible.pageCount > 1 ? <View style={styles.row}>
      <Choice label="Previous workspaces" disabled={disabled || visible.page === 0} onPress={() => setPage(visible.page - 1)} />
      <Choice label="Next workspaces" disabled={disabled || visible.page === visible.pageCount - 1} onPress={() => setPage(visible.page + 1)} />
    </View> : null}
    </View>}
    {workspace ? <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
      <Text accessibilityRole="header" style={styles.label}>Sessions</Text>
      <Text style={styles.copy}>Choose a session from the selected workspace.</Text>
      {sessionMessage ? <Text accessibilityLiveRegion="polite" style={styles.copy}>{sessionMessage}</Text> : null}
      {sessions.map(s => <Choice key={s.id} label={sessionLabel(s)} disabled={disabled || !s.executor} selected={value?.id === s.id} onPress={() => { onSelect(sessionRef(s)); setAlias(s.name ?? ''); }} />)}
      <Choice label="Refresh sessions" disabled={disabled || !selectedWorkspace} onPress={() => {
        if (selectedWorkspace) void chooseWorkspace(selectedWorkspace);
      }} />
    </View> : null}
    {value ? <><Text style={styles.copy}>Selected: {value.label}</Text><Field label="Favorite name (for example X Project Intake)" value={alias} onChangeText={setAlias} /><Choice label="Pin / rename favorite" disabled={!alias.trim()} onPress={() => { void updateFavorite({ originId, session: value, name: alias.trim() }).then(refresh).catch(() => setMessage('Could not save favorite.')); }} /></> : null}
    <Choice label="Refresh workspaces" disabled={!originId} onPress={() => void refresh()} /><Text accessibilityLiveRegion="polite" style={styles.copy}>{message}</Text>
  </View>;
}
