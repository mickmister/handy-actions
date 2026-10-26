import assert from 'node:assert/strict';
import test from 'node:test';
import { appTheme, type ThemeColors } from '../src/core/appTheme.ts';
import { themeOptions } from '../src/core/handyThemes.ts';

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('all selectable themes maintain readable text, controls, status labels, and QR codes', () => {
  const pairs: [keyof ThemeColors, keyof ThemeColors][] = [
    ['text', 'background'], ['muted', 'background'],
    ['text', 'surface'], ['muted', 'surface'],
    ['text', 'surfaceRaised'], ['muted', 'surfaceRaised'],
    ['text', 'input'], ['placeholder', 'input'],
    ['primary', 'background'], ['primary', 'surface'],
    ['onPrimary', 'primary'], ['onSecondary', 'secondary'],
    ['success', 'successSurface'], ['danger', 'dangerSurface'],
    ['codeText', 'code'], ['qrInk', 'qrBackground'],
  ];
  for (const option of themeOptions) {
    const { colors } = appTheme(option.id);
    for (const [foreground, background] of pairs) {
      assert.ok(contrast(colors[foreground], colors[background]) >= 4.5,
        `${option.id}: ${foreground} on ${background} must meet 4.5:1 contrast`);
    }
    // Theme chooser labels are rendered on the actual Lock Screen swatches.
    assert.ok(contrast(colors.text, option.colors[0]) >= 4.5, `${option.id}: preview text`);
    assert.ok(contrast(colors.muted, option.colors[0]) >= 4.5, `${option.id}: preview description`);
  }
});
