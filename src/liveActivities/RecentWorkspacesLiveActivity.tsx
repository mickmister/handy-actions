import { HStack, Image, Link, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, background, cornerRadius, font, foregroundStyle, frame, lineLimit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { HandyActionsLiveActivityProps } from '@/src/core/handyModel';
import type { WorkspaceLink } from '@/src/core/recentWorkspaces';

export type RecentWorkspacesActivityProps = {
  links: WorkspaceLink[];
  message: string;
  theme: HandyActionsLiveActivityProps['theme'];
};

const RecentWorkspacesActivity = (props: RecentWorkspacesActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const subdued = !!environment.isLuminanceReduced;
  const dark = props.theme?.id !== 'paper' || subdued;
  const accent = subdued ? '#CDD5DA' : props.theme?.accent ?? '#79E3CF';
  const islandAccent = dark ? accent : '#A7F3D0';
  const colors = subdued ? ['#0E1820', '#0E1820'] : props.theme?.colors ?? ['#0E1820', '#15333D'];
  // Keep helpers within the serialized worklet, including the Island layout.
  const list = (island: boolean) => {
    const ink = island || dark ? '#F3F6F7' : '#172D36';
    const tile = island || subdued ? '#1A2931' : props.theme?.tile ?? '#1A2931';
    return <VStack spacing={4} modifiers={[padding({ all: 8 })]}>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(ink), lineLimit(1)]}>Recent VD workspaces</Text>
      {props.links.map(workspace => <Link key={workspace.id} destination={workspace.url} modifiers={[frame({ minWidth: 0, maxWidth: 10000 })]}>
        <HStack spacing={8} modifiers={[padding({ horizontal: 10 }), frame({ minWidth: 0, maxWidth: 10000, height: 36 }), background(tile), cornerRadius(10)]}>
          <Image systemName="folder" color={island ? islandAccent : accent} size={14} />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(ink), lineLimit(1), frame({ minWidth: 0, maxWidth: 10000, alignment: 'leading' })]}>{workspace.title}</Text>
        </HStack>
      </Link>)}
      {props.message ? <Text modifiers={[font({ size: 12 }), foregroundStyle(ink), lineLimit(3)]}>{props.message}</Text> : null}
    </VStack>;
  };
  return {
    banner: <VStack modifiers={[activityBackgroundTint(colors[0]), background({ type: 'linearGradient', colors, startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } })]}>{list(false)}</VStack>,
    bannerSmall: list(false),
    compactLeading: <Image systemName="folder" color={islandAccent} />,
    minimal: <Image systemName="folder" color={islandAccent} />,
    expandedBottom: list(true),
  };
};

export default createLiveActivity<RecentWorkspacesActivityProps>('RecentWorkspacesActivity', RecentWorkspacesActivity);
