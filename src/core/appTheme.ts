import type { ThemeId } from './handyThemes.ts';

export type ThemeColors = {
  background: string; surface: string; surfaceRaised: string; input: string;
  text: string; muted: string; placeholder: string; border: string;
  primary: string; onPrimary: string; secondary: string; onSecondary: string;
  success: string; successSurface: string; danger: string; dangerSurface: string;
  code: string; codeText: string; qrBackground: string; qrInk: string;
};

export type AppTheme = { id: ThemeId; dark: boolean; colors: ThemeColors };

const palettes: Record<ThemeId, ThemeColors> = {
  psychedelic: {
    background: '#200D38', surface: '#301747', surfaceRaised: '#41245C', input: '#261139',
    text: '#FAF5FF', muted: '#DCCBEA', placeholder: '#BBA4CF', border: '#705082',
    primary: '#A7F3D0', onPrimary: '#12342B', secondary: '#433061', onSecondary: '#E8D5FF',
    success: '#A7F3D0', successSurface: '#193D36', danger: '#FFB4C8', dangerSurface: '#54243E',
    code: '#190B2C', codeText: '#E8D5FF', qrBackground: '#FFFFFF', qrInk: '#172D36',
  },
  midnight: {
    background: '#0E1820', surface: '#152832', surfaceRaised: '#203B47', input: '#101F28',
    text: '#F8FAFC', muted: '#C0D3DD', placeholder: '#99B0BD', border: '#496371',
    primary: '#79E3CF', onPrimary: '#102E29', secondary: '#23434C', onSecondary: '#AEF1E5',
    success: '#A7F3D0', successSurface: '#193D36', danger: '#FFB4BA', dangerSurface: '#4B2933',
    code: '#09131B', codeText: '#CEE9F0', qrBackground: '#FFFFFF', qrInk: '#172D36',
  },
  paper: {
    background: '#F4F0E5', surface: '#FFFCF5', surfaceRaised: '#E4EEE9', input: '#F5F3EB',
    text: '#172D36', muted: '#475569', placeholder: '#63717B', border: '#ABBAB5',
    primary: '#176D61', onPrimary: '#FFFFFF', secondary: '#DDEBE5', onSecondary: '#17594F',
    success: '#166534', successSurface: '#DCF0DF', danger: '#A52236', dangerSurface: '#F8DFE2',
    code: '#E7E6DC', codeText: '#243B43', qrBackground: '#FFFFFF', qrInk: '#172D36',
  },
};

export function appTheme(id: ThemeId = 'psychedelic'): AppTheme {
  return { id, dark: id !== 'paper', colors: palettes[id] };
}
