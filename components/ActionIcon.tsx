import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

import type { HandyActionPayload } from '@/src/core/handyModel';
import { siteIconForPayload } from '@/src/core/siteIcons';

export function ActionIcon({ payload, size = 22, color = '#334155' }: {
  payload: HandyActionPayload;
  size?: number;
  color?: string;
}) {
  const site = siteIconForPayload(payload);
  // Labels remain visible; the icon is decorative and should not be read twice.
  if (site) return <FontAwesome6 name={site} brand size={size} color={color} accessible={false} />;
  const fallback = payload.type === 'notes' ? 'note-sticky'
    : payload.type === 'qr' ? 'qrcode'
    : payload.type === 'vd-agent' ? 'robot'
    : payload.type === 'text-input' ? 'pen-to-square'
    : payload.type === 'http' ? 'server' : 'link';
  return <FontAwesome6 name={fallback} solid size={size} color={color} accessible={false} />;
}
