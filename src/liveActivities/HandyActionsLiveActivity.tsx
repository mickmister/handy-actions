import { Button, HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint, background, buttonStyle, cornerRadius, font,
  foregroundStyle, frame, lineLimit, padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { HandyActionsLiveActivityProps } from '@/src/core/handyModel';

const HandyActionsActivity = (props: HandyActionsLiveActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const subdued = !!environment.isLuminanceReduced;
  const accent = subdued ? '#CDD5DA' : '#79E3CF';
  const bannerInk = dark ? '#F3F6F7' : '#172D36';
  const secondaryInk = dark ? '#9AAEB8' : '#536D79';
  const countLabel = props.actionCount === 1 ? '1 action' : `${props.actionCount} actions`;

  // Keep helpers inside the worklet: the extension serializes only this function.
  // Island uses a dark palette even when the Lock Screen has a light appearance.
  const actionControls = (onDark: boolean) => (props.actionLinks ?? []).map((action) => {
    const ink = onDark ? '#F3F6F7' : '#172D36';
    const highlight = onDark ? accent : '#176D61';
    const label = <VStack spacing={7} modifiers={[
      padding({ horizontal: 10, vertical: 10 }), frame({ minHeight: 56 }),
      background(onDark ? (subdued ? '#111A20' : '#1A2931') : '#E5EDEF'), cornerRadius(14),
    ]}>
      <Image systemName={action.captureTarget ? 'square.and.pencil' : 'arrow.up.right'} color={highlight} size={16} />
      <HStack spacing={0}>
        <Spacer />
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(ink), lineLimit(2)]}>{action.title}</Text>
        <Spacer />
      </HStack>
    </VStack>;
    return action.captureTarget
      ? <Button key={action.url} target={action.captureTarget} modifiers={[buttonStyle('plain')]}>{label}</Button>
      : <Link key={action.url} destination={action.url}>{label}</Link>;
  });

  return {
    banner: (
      <VStack alignment="leading" spacing={12} modifiers={[
        padding({ all: 14 }), activityBackgroundTint(dark ? '#0E1820' : '#F4F7F8'),
      ]}>
        <HStack spacing={12}>
          <VStack alignment="leading" spacing={3}>
            <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(secondaryInk)]}>HANDY ACTIONS</Text>
            <Text modifiers={[font({ size: 18, weight: 'semibold' }), foregroundStyle(bannerInk), lineLimit(1)]}>{props.presetName}</Text>
          </VStack>
          <Spacer />
          <Link destination={props.openUrl} modifiers={[foregroundStyle(dark ? accent : '#176D61')]}>
            <VStack alignment="trailing" spacing={3}>
              <Text modifiers={[font({ size: 12, weight: 'semibold' })]}>All actions ↗</Text>
              <Text modifiers={[font({ size: 11 }), foregroundStyle(secondaryInk)]}>{countLabel}</Text>
            </VStack>
          </Link>
        </HStack>
        <HStack spacing={8}>{actionControls(dark)}</HStack>
      </VStack>
    ),
    bannerSmall: <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 10 })]}>
      <Text modifiers={[font({ size: 14, weight: 'semibold' }), lineLimit(1)]}>{props.presetName}</Text>
      <Text modifiers={[font({ size: 11 })]}>{countLabel}</Text>
    </VStack>,
    compactLeading: <Image systemName="square.and.pencil" color={accent} />,
    compactTrailing: <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(accent)]}>{props.actionCount}</Text>,
    minimal: <Image systemName="square.and.pencil" color={accent} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={3} modifiers={[padding({ leading: 6, top: 4 })]}>
        <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle('#9AAEB8')]}>HANDY ACTIONS</Text>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle('#F3F6F7'), lineLimit(1)]}>{props.presetName}</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ trailing: 6, top: 4 })]}>
        <Link destination={props.openUrl} label="All actions ↗" modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(accent)]} />
      </VStack>
    ),
    expandedBottom: (
      <HStack spacing={8} modifiers={[padding({ horizontal: 4, top: 8, bottom: 4 })]}>{actionControls(true)}</HStack>
    ),
  };
};

export default createLiveActivity<HandyActionsLiveActivityProps>('HandyActionsActivity', HandyActionsActivity);
