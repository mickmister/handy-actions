export type QrActionPayload = {
  type: 'qr';
  value: string;
};

export type WebActionPayload = {
  type: 'web';
  url: string;
};

export type DeepLinkActionPayload = {
  type: 'deeplink';
  url: string;
};

export type TextInputActionPayload = {
  type: 'text-input';
  urlTemplate: string;
};

export type HttpActionPayload = {
  type: 'http'; originId: string; path: string; method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  bodyFormat: 'none' | 'json' | 'text'; body: string; captureText: boolean;
};
export type AgentSession = { id: string; workspaceId: string; label: string; executor: string };
export type AgentActionPayload = { type: 'vd-agent'; originId: string; prefix: string; session?: AgentSession };

export type NotesActionPayload = { type: 'notes' };

export type HandyActionPayload = QrActionPayload | WebActionPayload | DeepLinkActionPayload | TextInputActionPayload | HttpActionPayload | AgentActionPayload | NotesActionPayload;

export function isInputPayload(payload: HandyActionPayload): boolean {
  return payload.type === 'text-input' || payload.type === 'vd-agent' || (payload.type === 'http' && payload.captureText);
}

export type SurfaceSettings = {
  liveActivities: boolean;
  lockScreenWidgets: boolean;
  notifications: boolean;
  widgetPresetId?: string;
};

export function surfaceSettings(state: HandyState): SurfaceSettings {
  return { liveActivities: true, lockScreenWidgets: false, notifications: true, ...state.surfaces };
}

export type HandyAction = {
  id: string;
  name: string;
  payload: HandyActionPayload;
};

export type HandyPreset = {
  id: string;
  name: string;
  enabled: boolean;
  actions: HandyAction[];
};

export type HandyState = {
  presets: HandyPreset[];
  surfaces?: SurfaceSettings;
  theme?: 'psychedelic' | 'midnight' | 'paper';
};

export type ValidationResult = { ok: true; errors: [] } | { ok: false; errors: string[] };

export type NotificationActionRow = {
  id: string;
  title: string;
  payload: HandyActionPayload;
};

export type LiveActivityActionLink = { title: string; url: string; captureTarget?: string; siteGlyph?: string; systemImage?: 'note.text' };

export type HandyActionsLiveActivityProps = {
  presetId: string;
  presetName: string;
  actionCount: number;
  firstAction: string;
  secondAction: string;
  thirdAction: string;
  updatedAt: string;
  openUrl: string;
  actionLinks?: LiveActivityActionLink[];
  actionRows?: LiveActivityActionLink[][];
  theme?: { id: string; colors: string[]; accent: string; ink: string; muted: string; tile: string };
};

export const ACTION_PRESS_PREFIX = 'handy-action:';
export const PRESET_PRESS_PREFIX = 'handy-preset-press:';

export function defaultHandyState(): HandyState {
  return { presets: [] };
}

export function makeId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function exportHandyState(state: HandyState): string {
  const result = validateHandyState(state);
  if (!result.ok) {
    throw new Error(result.errors.join('\n'));
  }
  return JSON.stringify(normalizeHandyState(state), null, 2);
}

export function importHandyState(text: string): HandyState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const normalized = normalizeHandyState(parsed);
  const result = validateHandyState(normalized);
  if (!result.ok) {
    throw new Error(result.errors.join('\n'));
  }
  return normalized;
}

export function normalizeHandyState(value: unknown): HandyState {
  if (!isRecord(value) || !Array.isArray(value.presets)) {
    return defaultHandyState();
  }

  return {
    ...(isRecord(value) && ['psychedelic', 'midnight', 'paper'].includes(String(value.theme)) ? { theme: value.theme as HandyState['theme'] } : {}),
    ...(isRecord(value.surfaces) ? { surfaces: {
      liveActivities: value.surfaces.liveActivities !== false,
      lockScreenWidgets: value.surfaces.lockScreenWidgets === true,
      notifications: value.surfaces.notifications !== false,
      ...(typeof value.surfaces.widgetPresetId === 'string' ? { widgetPresetId: value.surfaces.widgetPresetId } : {}),
    } } : {}),
    presets: value.presets.map((rawPreset): HandyPreset => {
      const preset = isRecord(rawPreset) ? rawPreset : {};
      const rawActions = Array.isArray(preset.actions) ? preset.actions : [];

      return {
        id: cleanId(isNonEmptyString(preset.id) ? preset.id : makeId('preset')),
        name: cleanText(isNonEmptyString(preset.name) ? preset.name : 'Untitled preset'),
        enabled: preset.enabled === true,
        actions: rawActions.map((rawAction): HandyAction => {
          const action = isRecord(rawAction) ? rawAction : {};
          return {
            id: cleanId(isNonEmptyString(action.id) ? action.id : makeId('action')),
            name: cleanText(isNonEmptyString(action.name) ? action.name : 'Untitled action'),
            payload: normalizePayload(action.payload),
          };
        }),
      };
    }),
  };
}

export function validateHandyState(state: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(state) || !Array.isArray(state.presets)) {
    return { ok: false, errors: ['State must be an object with a presets array.'] };
  }

  const presetIds = new Set<string>();
  if(state.theme!==undefined && !['psychedelic','midnight','paper'].includes(String(state.theme)))errors.push('theme must be psychedelic, midnight or paper.');
  if (state.surfaces !== undefined) {
    const settings = state.surfaces;
    if (!isRecord(settings) || ['liveActivities', 'lockScreenWidgets', 'notifications'].some((key) => typeof settings[key] !== 'boolean')) {
      errors.push('surfaces must contain boolean liveActivities, lockScreenWidgets and notifications settings.');
    }
  }
  for (const [presetIndex, rawPreset] of state.presets.entries()) {
    const preset = isRecord(rawPreset) ? rawPreset : {};
    const path = `presets[${presetIndex}]`;
    if (!isNonEmptyString(preset.id)) errors.push(`${path}.id must be a non-empty string.`);
    if (!isNonEmptyString(preset.name)) errors.push(`${path}.name must be a non-empty string.`);
    if (isNonEmptyString(preset.id) && presetIds.has(preset.id)) errors.push(`${path}.id duplicates another preset.`);
    if (isNonEmptyString(preset.id)) presetIds.add(preset.id);
    if (typeof preset.enabled !== 'boolean') errors.push(`${path}.enabled must be boolean.`);
    if (!Array.isArray(preset.actions)) {
      errors.push(`${path}.actions must be an array.`);
      continue;
    }

    const actionIds = new Set<string>();
    for (const [actionIndex, rawAction] of preset.actions.entries()) {
      const action = isRecord(rawAction) ? rawAction : {};
      const actionPath = `${path}.actions[${actionIndex}]`;
      if (!isNonEmptyString(action.id)) errors.push(`${actionPath}.id must be a non-empty string.`);
      if (!isNonEmptyString(action.name)) errors.push(`${actionPath}.name must be a non-empty string.`);
      if (isNonEmptyString(action.id) && actionIds.has(action.id)) {
        errors.push(`${actionPath}.id duplicates another action in this preset.`);
      }
      if (isNonEmptyString(action.id)) actionIds.add(action.id);
      errors.push(...validatePayload(action.payload, `${actionPath}.payload`));
    }
  }

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function findAction(state: HandyState, actionId: string, presetId?: string): { preset: HandyPreset; action: HandyAction } | undefined {
  for (const preset of state.presets) {
    if (presetId && preset.id !== presetId) continue;
    const action = preset.actions.find((candidate) => candidate.id === actionId);
    if (action) return { preset, action };
  }
  return undefined;
}

export function notificationIdForPreset(preset: Pick<HandyPreset, 'id'>): string {
  return `handy-preset-${cleanId(preset.id)}`;
}

export function actionNotificationRows(preset: HandyPreset): NotificationActionRow[] {
  // ken: notification action rows are OS-tight; show first 3, add overflow only after device tests demand it.
  return preset.actions.slice(0, 3).map((action) => ({
    id: action.id,
    title: action.name,
    payload: action.payload,
  }));
}

// Versioned wire contract with the native intent in patches/expo-widgets@57.0.22.patch.
// Carry the destination snapshot so posting does not depend on React or async storage.
export function liveActivityCaptureTarget(presetId: string, action: HandyAction, localSave = false, backgroundRequest = false): string | undefined {
  if (!isInputPayload(action.payload)) return undefined;
  return `handy-note-capture-v1:${JSON.stringify({
    actionId: action.id,
    presetId,
    title: action.name,
    ...(localSave ? { localSave: true } : {}),
    ...(backgroundRequest ? { backgroundRequest: true } : {}),
    actions: JSON.stringify([{ id: action.id, title: action.name, payload: action.payload }]),
  })}`;
}

export function actionPressId(actionId: string): string {
  return `${ACTION_PRESS_PREFIX}${actionId}`;
}

export function actionIdFromPressId(pressId: string): string | undefined {
  return pressId.startsWith(ACTION_PRESS_PREFIX) ? pressId.slice(ACTION_PRESS_PREFIX.length) : undefined;
}

export function presetPressId(presetId: string): string {
  return `${PRESET_PRESS_PREFIX}${presetId}`;
}

export function presetIdFromPressId(pressId: string): string | undefined {
  return pressId.startsWith(PRESET_PRESS_PREFIX) ? pressId.slice(PRESET_PRESS_PREFIX.length) : undefined;
}

export function notificationBodyForPreset(preset: HandyPreset): string {
  const count = actionNotificationRows(preset).length;
  if (count === 0) return 'No actions configured.';
  return count === 1 ? 'Long-press or expand for 1 action.' : `Long-press or expand for ${count} actions.`;
}

export function notificationRowsData(preset: HandyPreset): string {
  return JSON.stringify(actionNotificationRows(preset));
}

export function liveActivityPropsForPreset(
  preset: HandyPreset,
  updatedAt = new Date().toISOString(),
  openUrl = '',
): HandyActionsLiveActivityProps {
  const rows = actionNotificationRows(preset);
  return {
    presetId: preset.id,
    presetName: preset.name,
    actionCount: preset.actions.length,
    firstAction: rows[0]?.title ?? '',
    secondAction: rows[1]?.title ?? '',
    thirdAction: rows[2]?.title ?? '',
    updatedAt,
    openUrl,
  };
}

export function liveActivityActionRowsForPreset(
  preset: HandyPreset,
  linkForAction: (action: HandyAction) => LiveActivityActionLink,
): LiveActivityActionLink[][] {
  const rows: LiveActivityActionLink[][] = [];
  for (const action of preset.actions) {
    if (!rows.length || rows[rows.length - 1].length === 2) rows.push([]);
    rows[rows.length - 1].push(linkForAction(action));
  }
  return rows;
}

export function actionFromNotificationRowsData(actionId: string, rawActions: unknown): HandyAction | undefined {
  if (typeof rawActions !== 'string') return undefined;

  try {
    const parsed: unknown = JSON.parse(rawActions);
    if (!Array.isArray(parsed)) return undefined;

    for (const rawRow of parsed) {
      if (!isRecord(rawRow) || rawRow.id !== actionId || !isNonEmptyString(rawRow.title)) continue;
      if (validatePayload(rawRow.payload, 'payload').length > 0) continue;

      const action: HandyAction = {
        id: rawRow.id,
        name: rawRow.title,
        payload: rawRow.payload as HandyActionPayload,
      };
      return action;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function enabledPresets(state: HandyState): HandyPreset[] {
  return state.presets.filter((preset) => preset.enabled && preset.actions.length > 0);
}

function validatePayload(payload: unknown, path: string): string[] {
  if (!isRecord(payload)) return [`${path} must be an object.`];
  if (payload.type === 'notes') return [];
  if (payload.type === 'text-input') {
    return validTextTemplate(payload.urlTemplate) ? [] : [`${path}.urlTemplate must be an app/https URL containing {text} in its query or path.`];
  }
  if (payload.type === 'http') {
    const errors: string[] = [];
    if (!isNonEmptyString(payload.originId)) errors.push(`${path}.originId is required.`);
    if (typeof payload.path !== 'string' || !payload.path.startsWith('/') || /^\/\//.test(payload.path) || /[\\\r\n#]/.test(payload.path)) errors.push(`${path}.path must be a relative /path.`);
    if (!['GET','POST','PUT','PATCH','DELETE'].includes(String(payload.method))) errors.push(`${path}.method is invalid.`);
    if (!['none','json','text'].includes(String(payload.bodyFormat)) || typeof payload.body !== 'string') errors.push(`${path}.body format is invalid.`);
    if (payload.method === 'GET' && payload.bodyFormat !== 'none') errors.push(`${path}: GET cannot have a body.`);
    if (payload.bodyFormat === 'json') { try { JSON.parse(String(payload.body)); } catch { errors.push(`${path}.body must be valid JSON; use a string "{text}" placeholder.`); } }
    if (typeof payload.captureText !== 'boolean') errors.push(`${path}.captureText must be boolean.`);
    return errors;
  }
  if (payload.type === 'vd-agent') {
    const errors = isNonEmptyString(payload.originId) && typeof payload.prefix === 'string' ? [] : [`${path}: origin and prefix are required.`];
    if (payload.session !== undefined && (!isRecord(payload.session) || !['id','workspaceId','label','executor'].every(k => isNonEmptyString((payload.session as Record<string,unknown>)[k])))) errors.push(`${path}.session must be a complete selected session.`);
    return errors;
  }
  if (payload.type === 'qr') {
    return isNonEmptyString(payload.value) ? [] : [`${path}.value must be a non-empty string for QR actions.`];
  }
  if (payload.type === 'web') {
    return isHttpUrl(payload.url) ? [] : [`${path}.url must be http(s) for web actions.`];
  }
  if (payload.type === 'deeplink') {
    return isNonEmptyString(payload.url) ? [] : [`${path}.url must be non-empty for deeplink actions.`];
  }
  return [`${path}.type is unsupported.`];
}

function normalizePayload(payload: unknown): HandyActionPayload {
  if (!isRecord(payload)) return { type: 'qr', value: '' };
  if (payload.type === 'notes') return { type: 'notes' };
  if (payload.type === 'text-input' && typeof payload.urlTemplate === 'string') {
    return {
      type: 'text-input', urlTemplate: payload.urlTemplate,
    };
  }
  if (payload.type === 'web' && typeof payload.url === 'string') return { type: 'web', url: payload.url };
  if (payload.type === 'deeplink' && typeof payload.url === 'string') {
    return { type: 'deeplink', url: payload.url };
  }
  if (payload.type === 'http') return { type: 'http', originId: String(payload.originId ?? ''), path: String(payload.path ?? ''), method: payload.method as HttpActionPayload['method'], bodyFormat: payload.bodyFormat as HttpActionPayload['bodyFormat'], body: String(payload.body ?? ''), captureText: payload.captureText === true };
  if (payload.type === 'vd-agent') return { type: 'vd-agent', originId: String(payload.originId ?? ''), prefix: typeof payload.prefix === 'string' ? payload.prefix : '', ...(isRecord(payload.session) ? { session: { id: String(payload.session.id ?? ''), workspaceId: String(payload.session.workspaceId ?? ''), label: String(payload.session.label ?? ''), executor: String(payload.session.executor ?? '') } } : {}) };
  if (payload.type === 'qr' && typeof payload.value === 'string') return { type: 'qr', value: payload.value };
  return { type: 'qr', value: '' };
}

function cleanId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || makeId('id');
}

function cleanText(value: string): string {
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpUrl(value: unknown): boolean {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validTextTemplate(value: unknown): value is string {
  if (typeof value !== 'string' || !value.includes('{text}')) return false;
  try {
    const url = new URL(value.replaceAll('{text}', 'note'));
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !['javascript:', 'data:', 'file:'].includes(url.protocol)
      && !value.slice(0, value.indexOf('://') + 3).includes('{text}')
      && !value.slice(value.indexOf('://') + 3).split(/[/?#]/)[0].includes('{text}');
  } catch { return false; }
}

export function textInputUrl(template: string, text: string): string {
  if (!validTextTemplate(template)) throw new Error('Invalid text destination template. Include {text} in a URL query or path.');
  if (!text.trim()) throw new Error('Enter a note first.');
  return template.replaceAll('{text}', encodeURIComponent(text));
}

export function widgetPreset(state: HandyState): HandyPreset | undefined {
  const presets = enabledPresets(state);
  return presets.find((preset) => preset.id === surfaceSettings(state).widgetPresetId) ?? presets[0];
}
