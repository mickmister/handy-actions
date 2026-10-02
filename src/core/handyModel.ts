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
  fallbackUrl?: string;
};

export type HandyActionPayload = QrActionPayload | WebActionPayload | DeepLinkActionPayload;

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
};

export type ValidationResult = { ok: true; errors: [] } | { ok: false; errors: string[] };

export type NotificationActionRow = {
  id: string;
  title: string;
  payload: HandyActionPayload;
};

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

export function findAction(state: HandyState, actionId: string): { preset: HandyPreset; action: HandyAction } | undefined {
  for (const preset of state.presets) {
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

export function enabledPresets(state: HandyState): HandyPreset[] {
  return state.presets.filter((preset) => preset.enabled && preset.actions.length > 0);
}

function validatePayload(payload: unknown, path: string): string[] {
  if (!isRecord(payload)) return [`${path} must be an object.`];
  if (payload.type === 'qr') {
    return isNonEmptyString(payload.value) ? [] : [`${path}.value must be a non-empty string for QR actions.`];
  }
  if (payload.type === 'web') {
    return isHttpUrl(payload.url) ? [] : [`${path}.url must be http(s) for web actions.`];
  }
  if (payload.type === 'deeplink') {
    const errors = isNonEmptyString(payload.url) ? [] : [`${path}.url must be non-empty for deeplink actions.`];
    if (payload.fallbackUrl !== undefined && !isHttpUrl(payload.fallbackUrl)) {
      errors.push(`${path}.fallbackUrl must be http(s) when present.`);
    }
    return errors;
  }
  return [`${path}.type must be "qr", "web", or "deeplink".`];
}

function normalizePayload(payload: unknown): HandyActionPayload {
  if (!isRecord(payload)) return { type: 'qr', value: '' };
  if (payload.type === 'web' && typeof payload.url === 'string') return { type: 'web', url: payload.url };
  if (payload.type === 'deeplink' && typeof payload.url === 'string') {
    return typeof payload.fallbackUrl === 'string'
      ? { type: 'deeplink', url: payload.url, fallbackUrl: payload.fallbackUrl }
      : { type: 'deeplink', url: payload.url };
  }
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
