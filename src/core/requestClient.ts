import { originUrl, type OriginProfile } from './originRepository.ts';

export type RequestSpec = { method?: string; body?: string; contentType?: string; diagnostics?: boolean; cache?: 'no-store' };
export type Transport = (url: string, init: RequestInit) => Promise<Response>;
export class RequestFailure extends Error {
  status?: number;
  constructor(status?: number, details?: string) {
    const summary = status ? `Request failed (HTTP ${status}).` : details ? 'Connection request failed.' : 'Request failed or timed out. Delivery may be uncertain; review before retrying.';
    super(details ? `${summary}\n${details}` : summary);
    this.status=status;
  }
}

export function redactSecrets<T>(value: T, profile: OriginProfile): T {
  const secrets = profile.headers.filter(h => h.mode === 'secret' && h.value).flatMap(h => {
    // Servers may echo an Authorization credential without its scheme.
    const credential=/^(?:proxy-)?authorization$/i.test(h.name)?h.value.replace(/^(?:Bearer|Basic)\s+/i,''):h.value;
    return [...new Set([h.value,credential].filter(Boolean))].flatMap(value=>[value,encodeURIComponent(value),JSON.stringify(value).slice(1,-1)]);
  }).sort((a,b) => b.length-a.length);
  const scrub = (s: string) => secrets.reduce((text, secret) => text.split(secret).join('[secret]'), s);
  const visit = (v: unknown): unknown => typeof v === 'string' ? scrub(v) : Array.isArray(v) ? v.map(visit) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).map(([k,x]) => [scrub(k), visit(x)])) : v;
  return visit(value) as T;
}

export function diagnosticText(value: unknown, profile: OriginProfile): string {
  // Redact BEFORE truncation: clipping first can leak a partial credential at
  // the display boundary. Escape control characters but retain useful lines.
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
  const safe = redactSecrets(text, profile).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return safe.length > 4000 ? `${safe.slice(0,4000)}\n[Response truncated]` : safe;
}

export function createRequestClient(resolve: (id: string) => Promise<OriginProfile>, transport: Transport) {
  return async function request(originId: string, path: string, spec: RequestSpec = {}, parseJson = true): Promise<unknown> {
    const profile = await resolve(originId);
    const url = originUrl(profile.origin, path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const headers: Record<string, string> = { ...(spec.diagnostics || spec.cache === 'no-store' ? {'cache-control':'no-cache'} : {}), ...(spec.contentType ? { 'content-type': spec.contentType } : {}) };
      for (const h of profile.headers) headers[h.name.toLowerCase()] = h.value;
      // Expo fetch implements redirect:error natively on both iOS and Android.
      const response = await transport(url, { method: spec.method ?? 'GET', headers, body: spec.body, redirect: 'error', credentials: 'omit', signal: controller.signal,
        ...(spec.diagnostics || spec.cache === 'no-store' ? {cache:'no-store' as const} : {}) });
      if (spec.diagnostics) {
        const body = await response.text();
        const status = diagnosticText(`HTTP ${response.status} ${response.statusText}`,profile).trim();
        const responseHeaders = ['content-type','www-authenticate','retry-after','x-request-id']
          .flatMap(name => {const value=response.headers.get(name);return value?[`${name}: ${value}`]:[];}).join('\n');
        if (!response.ok || response.redirected) {
          throw new RequestFailure(response.status, diagnosticText(`${status}${response.redirected?' (redirect refused)':''}\n${responseHeaders}\n${body || 'The server returned an empty response.'}`,profile));
        }
        if (!parseJson) return {status:response.status};
        try { return redactSecrets(JSON.parse(body),profile); }
        catch { throw new RequestFailure(response.status, diagnosticText(`${status}\n${responseHeaders}\nExpected JSON from VD, but received:\n${body || '[Empty response]'}`,profile)); }
      }
      if (!response.ok || response.redirected) throw new RequestFailure(response.status);
      if (!parseJson) return { status: response.status };
      const data: unknown = await response.json();
      return redactSecrets(data, profile);
    } catch (error) {
      if (error instanceof RequestFailure) throw error;
      if (spec.diagnostics) {
        const detail = controller.signal.aborted ? 'Connection test timed out after 20 seconds.' :
          diagnosticText(error instanceof Error ? `${error.name}: ${error.message}` : 'Network request failed.', profile);
        throw new RequestFailure(undefined, `${detail}\nCheck the origin, network access and TLS certificate. Redirects are disabled.`);
      }
      // Normal action delivery retains generic errors; detailed diagnostics are opt-in.
      throw new RequestFailure();
    } finally { clearTimeout(timer); }
  };
}
