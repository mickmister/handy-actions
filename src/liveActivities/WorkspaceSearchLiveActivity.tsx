import { Button, HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, background, buttonStyle, cornerRadius, font, foregroundStyle, frame, lineLimit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type WorkspaceSearchProps = {
  searchId: string;
  title: string;
  message: string;
  results: { title: string; target: string }[];
  previous?: string;
  next?: string;
  searchAgain: string;
};

const WorkspaceSearchActivity = (props: WorkspaceSearchProps, environment: LiveActivityEnvironment) => {
  'widget';
  const accent = environment.isLuminanceReduced ? '#CDD5DA' : '#79E3CF';
  const control = (title: string, target: string) => <Button key={target} target={target} modifiers={[buttonStyle('plain'), frame({ minWidth: 0, maxWidth: 10000 })]}>
    <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(accent), lineLimit(1), padding({ horizontal: 6 }), frame({ minWidth: 0, maxWidth: 10000, height: 26 }), background('#1A2931'), cornerRadius(8)]}>{title}</Text>
  </Button>;
  const list = () => <VStack spacing={3} modifiers={[padding({ all: 6 })]}>
    <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#F3F6F7'), lineLimit(1)]}>{props.title}</Text>
    {!props.message ? props.results.map(result => <Button key={result.target} target={result.target} modifiers={[buttonStyle('plain'), frame({ minWidth: 0, maxWidth: 10000 })]}>
      <HStack spacing={6} modifiers={[padding({ horizontal: 8 }), frame({ minWidth: 0, maxWidth: 10000, height: 30 }), background('#1A2931'), cornerRadius(8)]}>
        <Image systemName="folder" color={accent} size={13} />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#F3F6F7'), lineLimit(1), frame({ minWidth: 0, maxWidth: 10000, alignment: 'leading' })]}>{result.title}</Text>
      </HStack>
    </Button>) : null}
    {props.message ? <Text modifiers={[font({ size: 12 }), foregroundStyle('#CDD5DA'), lineLimit(2)]}>{props.message}</Text> : null}
    <HStack spacing={5}>
      {props.previous && !props.message ? control('Previous', props.previous) : null}
      {control('Search again', props.searchAgain)}
      {props.next && !props.message ? control('Next', props.next) : null}
    </HStack>
  </VStack>;
  return {
    banner: <VStack modifiers={[activityBackgroundTint('#0E1820'), background('#0E1820')]}>{list()}</VStack>,
    bannerSmall: list(),
    compactLeading: <Image systemName="magnifyingglass" color={accent} />,
    minimal: <Image systemName="magnifyingglass" color={accent} />,
    expandedBottom: list(),
  };
};

export default createLiveActivity<WorkspaceSearchProps>('WorkspaceSearchActivity', WorkspaceSearchActivity);
