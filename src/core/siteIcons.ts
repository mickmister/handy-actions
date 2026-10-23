import type { HandyActionPayload } from './handyModel.ts';

// Match parsed hostnames, never URL substrings or user-provided action names.
const sites = [
  { icon: 'youtube', domains: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'], schemes: ['youtube:'] },
  { icon: 'linkedin', domains: ['linkedin.com', 'lnkd.in'], schemes: ['linkedin:'] },
  { icon: 'github', domains: ['github.com', 'gist.github.com'], schemes: ['github:'] },
  { icon: 'instagram', domains: ['instagram.com'], schemes: ['instagram:'] },
  { icon: 'facebook', domains: ['facebook.com', 'fb.com', 'fb.watch'], schemes: ['fb:'] },
  { icon: 'x-twitter', domains: ['x.com', 'twitter.com', 't.co'], schemes: ['twitter:', 'x:'] },
  { icon: 'tiktok', domains: ['tiktok.com'], schemes: ['tiktok:'] },
  { icon: 'reddit', domains: ['reddit.com', 'redd.it'], schemes: ['reddit:'] },
  { icon: 'whatsapp', domains: ['whatsapp.com', 'wa.me'], schemes: ['whatsapp:'] },
  { icon: 'telegram', domains: ['telegram.org', 't.me'], schemes: ['tg:'] },
  { icon: 'discord', domains: ['discord.com', 'discord.gg'], schemes: ['discord:'] },
  { icon: 'slack', domains: ['slack.com'], schemes: ['slack:'] },
  { icon: 'spotify', domains: ['spotify.com', 'spotify.link'], schemes: ['spotify:'] },
  { icon: 'soundcloud', domains: ['soundcloud.com'], schemes: ['soundcloud:'] },
  { icon: 'twitch', domains: ['twitch.tv'], schemes: ['twitch:'] },
  { icon: 'pinterest', domains: ['pinterest.com', 'pin.it'], schemes: ['pinterest:'] },
  { icon: 'medium', domains: ['medium.com'], schemes: [] },
  { icon: 'stack-overflow', domains: ['stackoverflow.com'], schemes: [] },
  { icon: 'gitlab', domains: ['gitlab.com'], schemes: [] },
  { icon: 'vimeo', domains: ['vimeo.com'], schemes: ['vimeo:'] },
  { icon: 'apple', domains: ['music.apple.com', 'podcasts.apple.com', 'apps.apple.com'], schemes: ['music:', 'podcasts:'] },
  { icon: 'google-drive', domains: ['drive.google.com', 'docs.google.com'], schemes: [] },
  { icon: 'dropbox', domains: ['dropbox.com'], schemes: [] },
  { icon: 'amazon', domains: ['amazon.com', 'amzn.to'], schemes: [] },
] as const;

export function siteIconForUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
      return sites.find(site => site.domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`)))?.icon;
    }
    return sites.find(site => (site.schemes as readonly string[]).includes(url.protocol))?.icon;
  } catch {
    return undefined;
  }
}

export function siteIconForPayload(payload: HandyActionPayload) {
  if (payload.type === 'web' || payload.type === 'deeplink') return siteIconForUrl(payload.url);
  if (payload.type === 'qr') return siteIconForUrl(payload.value);
  if (payload.type === 'text-input') return siteIconForUrl(payload.urlTemplate);
  return undefined;
}
