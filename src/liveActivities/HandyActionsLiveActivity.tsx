import { Image, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { HandyActionsLiveActivityProps } from '@/src/core/handyModel';

const HandyActionsActivity = (props: HandyActionsLiveActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const accentColor = environment.isLuminanceReduced ? '#FFFFFF' : '#38BDF8';
  const secondaryColor = environment.colorScheme === 'dark' ? '#CBD5E1' : '#475569';
  const actionLine =
    props.actionCount === 1 ? '1 ready action' : `${props.actionCount} ready actions`;

  return {
    banner: (
      <VStack modifiers={[padding({ all: 14 }), activityBackgroundTint('#0F172A')]}>
        <Text modifiers={[font({ weight: 'bold', size: 18 }), foregroundStyle('#FFFFFF')]}>
          {props.presetName}
        </Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(accentColor)]}>{actionLine}</Text>
        {props.firstAction ? (
          <Text modifiers={[font({ size: 13 }), foregroundStyle(secondaryColor)]}>• {props.firstAction}</Text>
        ) : null}
        {props.secondAction ? (
          <Text modifiers={[font({ size: 13 }), foregroundStyle(secondaryColor)]}>• {props.secondAction}</Text>
        ) : null}
        {props.thirdAction ? (
          <Text modifiers={[font({ size: 13 }), foregroundStyle(secondaryColor)]}>• {props.thirdAction}</Text>
        ) : null}
      </VStack>
    ),
    compactLeading: <Image systemName="link.circle.fill" color={accentColor} />,
    compactTrailing: <Text modifiers={[foregroundStyle(accentColor)]}>{props.actionCount}</Text>,
    minimal: <Image systemName="link.circle.fill" color={accentColor} />,
    expandedLeading: (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Image systemName="link.circle.fill" color={accentColor} />
        <Text modifiers={[font({ size: 11 }), foregroundStyle(secondaryColor)]}>Handy</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: 'bold', size: 20 }), foregroundStyle(accentColor)]}>{props.actionCount}</Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(secondaryColor)]}>actions</Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: 'bold' }), foregroundStyle('#FFFFFF')]}>{props.presetName}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(secondaryColor)]}>Tap to open the action list</Text>
      </VStack>
    ),
  };
};

export default createLiveActivity<HandyActionsLiveActivityProps>('HandyActionsActivity', HandyActionsActivity);
