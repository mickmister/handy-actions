import type { HttpActionPayload } from './handyModel.ts';

export function httpRequestSpec(payload: HttpActionPayload, text = '') {
  if (payload.captureText && !text.trim()) throw new Error('Enter text first.');
  const path = payload.path.replaceAll('{text}', encodeURIComponent(text));
  const substitute = (value: unknown): unknown => typeof value === 'string' ? value.replaceAll('{text}', text) : Array.isArray(value) ? value.map(substitute) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([k,v]) => [k,substitute(v)])) : value;
  const body = payload.bodyFormat === 'json' ? JSON.stringify(substitute(JSON.parse(payload.body))) : payload.bodyFormat === 'text' ? payload.body.replaceAll('{text}', text) : undefined;
  return { path, method: payload.method, body, contentType: payload.bodyFormat === 'json' ? 'application/json' : payload.bodyFormat === 'text' ? 'text/plain; charset=utf-8' : undefined };
}
