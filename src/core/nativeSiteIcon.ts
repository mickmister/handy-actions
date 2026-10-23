import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

import type { HandyActionPayload } from './handyModel';
import { siteIconForPayload } from './siteIcons';

// Resolve on the host: widget worklets cannot import React Native icon views.
export function nativeSiteIcon(payload: HandyActionPayload): string | undefined {
  const name = siteIconForPayload(payload);
  if (!name) return undefined;
  const codepoint = FontAwesome6.getRawGlyphMap('brand')[name];
  return codepoint ? String.fromCodePoint(codepoint) : undefined;
}
