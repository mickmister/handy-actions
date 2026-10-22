import { originUrl, type OriginProfile } from './originRepository.ts';

export type RequestSpec = { method?: string; body?: string; contentType?: string };
export type Transport = (url: string, init: RequestInit) => Promise<Response>;
export class RequestFailure extends Error {
  status?: number;
  constructor(status?: number) {
    super(status ? `Request failed (HTTP ${status}).` : 'Request failed or timed out. Delivery may be uncertain; review before retrying.');
    this.status=status;
  }
}

export function redactSecrets<T>(value: T, profile: OriginProfile): T {
  const secrets = profile.headers.filter(h => h.mode === 'secret' && h.value).flatMap(h => {
    // Servers may echo an Authorization credential without its scheme.
    const credential=/^(?:proxy-)?authorization$/i.test(h.name)?h.value.replace(/^(?:Bearer|Basic)\s+/i,''):h.value;
    return [...new Set([h.value,credential].filter(Boolean))].flatMap(value=>[value,encodeURIComponent(value)]);
  }).sort((a,b) => b.length-a.length);
  const scrub = (s: string) => secrets.reduce((text, secret) => text.split(secret).join('[secret]'), s);
  const visit = (v: unknown): unknown => typeof v === 'string' ? scrub(v) : Array.isArray(v) ? v.map(visit) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).map(([k,x]) => [scrub(k), visit(x)])) : v;
  return visit(value) as T;
}

export function createRequestClient(resolve: (id: string) => Promise<OriginProfile>, transport: Transport) {
  return async function request(originId: string, path: string, spec: RequestSpec = {}, parseJson = true): Promise<unknown> {
    const profile = await resolve(originId);
    const url = originUrl(profile.origin, path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const headers: Record<string, string> = { ...(spec.contentType ? { 'content-type': spec.contentType } : {}) };
      for (const h of profile.headers) headers[h.name.toLowerCase()] = h.value;
      // Expo fetch implements redirect:error natively on both iOS and Android.
      const response = await transport(url, { method: spec.method ?? 'GET', headers, body: spec.body, redirect: 'error', credentials: 'omit', signal: controller.signal });
      if (!response.ok || response.redirected) throw new RequestFailure(response.status);
      if (!parseJson) return { status: response.status };
      const data: unknown = await response.json();
      return redactSecrets(data, profile);
    } catch (error) {
      if (error instanceof RequestFailure) throw error;
      // Never expose native/network errors or server bodies that can echo headers.
      throw new RequestFailure();
    } finally { clearTimeout(timer); }
  };
}
