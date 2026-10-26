import { Button, HStack, Image, Link, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, background, buttonStyle, cornerRadius, font, foregroundStyle, frame, lineLimit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { LiveActivityActionLink } from '@/src/core/handyModel';
import type { SharedActivityConfiguration } from '@/src/core/sharedActivityModel';

export type SharedHandyActivityProps = {
  view: string;
  title: string;
  message: string;
  rows?: LiveActivityActionLink[][];
  results?: { title: string; target: string }[];
  navigation: { title: string; target: string }[];
  theme?: SharedActivityConfiguration['theme'];
};

const SharedHandyActivity = (props: SharedHandyActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const subdued = !!environment.isLuminanceReduced;
  const dark = props.theme?.id !== 'paper' || subdued;
  const accent = subdued ? '#CDD5DA' : props.theme?.accent ?? '#79E3CF';
  const colors = subdued ? ['#0E1820', '#0E1820'] : props.theme?.colors ?? ['#0E1820', '#15333D'];
  const list = (island: boolean) => {
    const ink = island || dark ? '#F3F6F7' : '#172D36';
    const tile = island || subdued ? '#1A2931' : props.theme?.tile ?? '#1A2931';
    const highlight = island && !dark ? '#A7F3D0' : accent;
    return <VStack spacing={3} modifiers={[padding({ all: 5 })]}>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(ink), lineLimit(1)]}>{props.title}</Text>
      {!props.message ? (props.rows ?? []).map((row, index) => <HStack key={index} spacing={5}>
        {row.map(action => {
          const label = <HStack spacing={6} modifiers={[padding({ horizontal: 8 }), frame({ minWidth: 0, maxWidth: 10000, height: 44 }), background(tile), cornerRadius(12)]}>
            {action.siteGlyph ? <Text modifiers={[font({ family: 'FontAwesome6Brands-Regular', size: 15 }), foregroundStyle(highlight)]}>{action.siteGlyph}</Text>
              : <Image systemName={action.systemImage ?? (action.captureTarget ? 'square.and.pencil' : 'arrow.up.right')} color={highlight} size={14} />}
            <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(ink), lineLimit(2), frame({ minWidth: 0, maxWidth: 10000, alignment: 'leading' })]}>{action.title}</Text>
          </HStack>;
          return action.captureTarget ? <Button key={action.url} target={action.captureTarget} modifiers={[buttonStyle('plain'), frame({ minWidth: 0, maxWidth: 10000 })]}>{label}</Button>
            : <Link key={action.url} destination={action.url} modifiers={[frame({ minWidth: 0, maxWidth: 10000 })]}>{label}</Link>;
        })}
      </HStack>) : null}
      {!props.message ? (props.results ?? []).map(result => <Button key={result.target} target={result.target} modifiers={[buttonStyle('plain'), frame({ minWidth: 0, maxWidth: 10000 })]}>
        <HStack spacing={6} modifiers={[padding({ horizontal: 8 }), frame({ minWidth: 0, maxWidth: 10000, height: 30 }), background(tile), cornerRadius(8)]}>
          <Image systemName="folder" color={highlight} size={13} />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(ink), lineLimit(1), frame({ minWidth: 0, maxWidth: 10000, alignment: 'leading' })]}>{result.title}</Text>
        </HStack>
      </Button>) : null}
      {props.message ? <Text modifiers={[font({ size: 12 }), foregroundStyle(ink), lineLimit(3)]}>{props.message}</Text> : null}
      <HStack spacing={4}>{props.navigation.map(control => <Button key={control.target} target={control.target} modifiers={[buttonStyle('plain'), frame({ minWidth: 0, maxWidth: 10000 })]}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(ink), lineLimit(1), frame({ minWidth: 0, maxWidth: 10000, height: 26 }), background(tile), cornerRadius(8)]}>{control.title}</Text>
      </Button>)}</HStack>
    </VStack>;
  };
  return {
    banner: <VStack modifiers={[activityBackgroundTint(colors[0]), background({ type: 'linearGradient', colors, startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } })]}>{list(false)}</VStack>,
    bannerSmall: list(false),
    compactLeading: <Image systemName={props.view === 'actions' ? 'square.and.pencil' : 'folder'} color={dark ? accent : '#A7F3D0'} />,
    minimal: <Image systemName="square.and.pencil" color={dark ? accent : '#A7F3D0'} />,
    expandedBottom: list(true),
  };
};

export default createLiveActivity<SharedHandyActivityProps>('SharedHandyActivity', SharedHandyActivity);
