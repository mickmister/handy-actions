import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { siteIconForPayload, siteIconForUrl } from '../src/core/siteIcons.ts';

test('every supported service resolves to an available Expo Font Awesome brand glyph', () => {
  const require = createRequire(import.meta.url);
  const glyphs = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/FontAwesome6Free.json');
  const metadata = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/FontAwesome6Free_meta.json');
  for (const domain of [
    'youtube.com', 'linkedin.com', 'github.com', 'instagram.com', 'facebook.com',
    'x.com', 'tiktok.com', 'reddit.com', 'whatsapp.com', 'telegram.org',
    'discord.com', 'slack.com', 'spotify.com', 'soundcloud.com', 'twitch.tv',
    'pinterest.com', 'medium.com', 'stackoverflow.com', 'gitlab.com', 'vimeo.com',
    'music.apple.com', 'drive.google.com', 'dropbox.com', 'amazon.com',
  ]) {
    const icon = siteIconForUrl(`https://${domain}/example`);
    assert.ok(icon, domain);
    assert.ok(metadata.brands.includes(icon), `${domain}: ${icon} must be in the brand font`);
    assert.equal(typeof glyphs[icon], 'number', icon);
  }
});

test('recognizes common share URLs, subdomains, short links, and app schemes', () => {
  for (const [url, expected] of [
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://m.linkedin.com/in/person', 'linkedin'],
    ['https://lnkd.in/example', 'linkedin'],
    [' HTTPS://GITHUB.COM/person/repo ', 'github'],
    ['https://gist.github.com/person/id', 'github'],
    ['https://www.instagram.com/person', 'instagram'],
    ['https://x.com/person/status/123', 'x-twitter'],
    ['https://wa.me/123456', 'whatsapp'],
    ['https://open.spotify.com/track/abc', 'spotify'],
    ['https://vm.tiktok.com/abc', 'tiktok'],
    ['https://discord.gg/abc', 'discord'],
    ['youtube://watch?v=abc', 'youtube'],
    ['spotify:track:abc', 'spotify'],
    ['tg://resolve?domain=example', 'telegram'],
  ]) assert.equal(siteIconForUrl(url), expected, url);
});

test('uses generic fallback for malformed, unrelated, or misleading URLs', () => {
  for (const url of [
    '', 'plain QR text', 'github.com/person', 'https://example.com',
    'https://notyoutube.com', 'https://youtube.com.example.com',
    'https://youtube.com@evil.example', 'https://example.com/?url=https://github.com',
    'javascript://youtube.com/alert(1)', 'file://github.com/repo',
  ]) assert.equal(siteIconForUrl(url), undefined, url);
});

test('recognizes configured destinations across link, QR, and input actions', () => {
  assert.equal(siteIconForPayload({ type: 'qr', value: 'https://linkedin.com/in/person' }), 'linkedin');
  assert.equal(siteIconForPayload({ type: 'web', url: 'https://github.com/person' }), 'github');
  assert.equal(siteIconForPayload({ type: 'deeplink', url: 'youtube://watch?v=abc' }), 'youtube');
  assert.equal(siteIconForPayload({ type: 'text-input', urlTemplate: 'https://x.com/intent/post?text={text}' }), 'x-twitter');
  assert.equal(siteIconForPayload({ type: 'vd-agent', originId: 'github.com', prefix: '' }), undefined);
});
