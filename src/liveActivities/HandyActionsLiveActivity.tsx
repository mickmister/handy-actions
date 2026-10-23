import { Button, HStack, Image, Link, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint, background, buttonStyle, cornerRadius, font,
  foregroundStyle, frame, lineLimit, padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { HandyActionsLiveActivityProps } from '@/src/core/handyModel';

const HandyActionsActivity = (props: HandyActionsLiveActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const dark = props.theme ? props.theme.id !== 'paper' : environment.colorScheme === 'dark';
  const subdued = !!environment.isLuminanceReduced;
  const accent = subdued ? '#CDD5DA' : props.theme?.accent ?? '#79E3CF';
  const islandAccent = !dark && !subdued ? '#A7F3D0' : accent;
  const colors = props.theme?.colors ?? ['#0E1820','#15333D'];

  // Older active snapshots may still use the flat list. Keep those readable
  // with the same two-column layout until the next content refresh.
  const rows = props.actionRows ?? (props.actionLinks ?? []).reduce<NonNullable<HandyActionsLiveActivityProps['actionRows']>>((result, action, index) => {
    if (index % 2 === 0) result.push([]);
    result[result.length - 1].push(action);
    return result;
  }, []);

  // Keep helpers inside the worklet: the extension serializes only this function.
  // Island uses a dark palette even when the Lock Screen has a light appearance.
  const actionControls = (onDark: boolean) => rows.map((row, rowIndex) => <HStack key={`row-${rowIndex}`} spacing={6}>
    {row.map((action) => {
      const ink = onDark ? '#F3F6F7' : '#172D36';
      const highlight = onDark ? islandAccent : '#176D61';
      const label = <HStack spacing={8} modifiers={[
        padding({ horizontal: 10, vertical: 6 }), frame({ minWidth: 0, maxWidth: 10000, height: 44 }),
        background(subdued ? '#111A20' : onDark ? (dark ? props.theme?.tile ?? '#1A2931' : '#1A2931') : props.theme?.tile ?? '#E5EDEF'), cornerRadius(14),
      ]}>
        {action.siteGlyph
          ? <Text modifiers={[font({ family: 'FontAwesome6Brands-Regular', size: 16 }), foregroundStyle(highlight)]}>{action.siteGlyph}</Text>
          : <Image systemName={action.captureTarget ? 'square.and.pencil' : 'arrow.up.right'} color={highlight} size={14} />}
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(ink), lineLimit(2), frame({ minWidth: 0, maxWidth: 10000, alignment: 'leading' })]}>{action.title}</Text>
      </HStack>;
      const modifiers = [frame({ minWidth: 0, maxWidth: 10000 })];
      return action.captureTarget
        ? <Button key={action.url} target={action.captureTarget} modifiers={[buttonStyle('plain'), ...modifiers]}>{label}</Button>
        : <Link key={action.url} destination={action.url} modifiers={modifiers}>{label}</Link>;
    })}
  </HStack>);

  return {
    banner: (
      <VStack spacing={6} modifiers={[
        padding({ all: 8 }), activityBackgroundTint(subdued ? '#0E1820' : colors[0]),
        background(subdued ? '#0E1820' : {type:'linearGradient',colors,startPoint:{x:0,y:0},endPoint:{x:1,y:1}}),
      ]}>
        {actionControls(subdued || dark)}
      </VStack>
    ),
    bannerSmall: <VStack spacing={6} modifiers={[padding({ all: 6 })]}>
      {actionControls(subdued || dark)}
    </VStack>,
    compactLeading: <Image systemName="square.and.pencil" color={islandAccent} />,
    minimal: <Image systemName="square.and.pencil" color={islandAccent} />,
    expandedBottom: (
      <VStack spacing={6} modifiers={[padding({ all: 6 }),background(subdued?'#0E1820':{type:'linearGradient',colors:dark?colors:['#0E1820','#15333D'],startPoint:{x:0,y:0},endPoint:{x:1,y:1}}),cornerRadius(14)]}>{actionControls(true)}</VStack>
    ),
  };
};

export default createLiveActivity<HandyActionsLiveActivityProps>('HandyActionsActivity', HandyActionsActivity);
