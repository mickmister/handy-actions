import { Button, HStack, Image, Link, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, background, buttonStyle, contentShape, cornerRadius, font, foregroundStyle, frame, lineLimit, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { LiveActivityActionLink } from '@/src/core/handyModel';
import type { SharedActivityConfiguration } from '@/src/core/sharedActivityModel';

export type SharedHandyActivityProps = {
  view: string;
  title: string;
  message: string;
  rows?: LiveActivityActionLink[][];
  results?: { title: string; target: string; solidGlyph?: string }[];
  responseText?: string;
  inputStatus?: string;
  responseLinks?: {title:string;url:string}[];
  primarySolidGlyph?: string;
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
    // Reclaim the preset heading for the Actions footer. Titled result pages
    // keep a shorter footer so three workspace/search rows still fit.
    const navigationHeight = props.view === 'actions' ? 44 : 32;
    const navigationInset = props.view === 'actions' ? 4 : 0;
    return <VStack spacing={props.view === 'actions' ? 6 : 3} modifiers={[padding({ all: props.view === 'actions' ? 6 : 5 })]}>
      {props.view !== 'actions' ? <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(ink), lineLimit(1)]}>{props.title}</Text> : null}
      {!props.message ? (props.rows ?? []).map((row, index) => <HStack key={index} spacing={6}>
        {row.map(action => {
          // Inset the visible tile inside a full-height hit area. The rectangle
          // content shape keeps transparent padding tappable too.
          const label = <HStack spacing={4} modifiers={[padding({ horizontal: 6 }), frame({ minWidth: 0, maxWidth: 10000, minHeight: 36, maxHeight: 36 }), background(tile), cornerRadius(8), padding({ horizontal: 2, vertical: 4 }), contentShape(shapes.rectangle())]}>
            {action.solidGlyph ? <Text modifiers={[font({ family: 'FontAwesome6Free-Solid', size: 13 }), foregroundStyle(highlight)]}>{action.solidGlyph}</Text>
              : action.siteGlyph ? <Text modifiers={[font({ family: 'FontAwesome6Brands-Regular', size: 13 }), foregroundStyle(highlight)]}>{action.siteGlyph}</Text>
              : <Image systemName={action.systemImage ?? (action.captureTarget ? 'square.and.pencil' : 'arrow.up.right')} color={highlight} size={13} />}
            <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(ink), lineLimit(2), frame({ minWidth: 0, maxWidth: 10000, alignment: 'leading' })]}>{action.title}</Text>
          </HStack>;
          return action.captureTarget ? <Button key={action.url} target={action.captureTarget} modifiers={[buttonStyle('plain'), frame({ minWidth: 0, maxWidth: 10000 })]}>{label}</Button>
            : <Link key={action.url} destination={action.url} modifiers={[frame({ minWidth: 0, maxWidth: 10000 })]}>{label}</Link>;
        })}
      </HStack>) : null}
      {!props.message ? (props.results ?? []).map(result => <Button key={result.target} target={result.target} modifiers={[buttonStyle('plain'), frame({ minWidth: 0, maxWidth: 10000 })]}>
        <HStack spacing={6} modifiers={[padding({ horizontal: 8 }), frame({ minWidth: 0, maxWidth: 10000, minHeight: 30, maxHeight: 30 }), background(tile), cornerRadius(8)]}>
          {result.solidGlyph ? <Text modifiers={[font({family:'FontAwesome6Free-Solid',size:13}),foregroundStyle(highlight)]}>{result.solidGlyph}</Text> : <Image systemName="folder" color={highlight} size={13} />}
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(ink), lineLimit(1), frame({ minWidth: 0, maxWidth: 10000, alignment: 'leading' })]}>{result.title}</Text>
        </HStack>
      </Button>) : null}
      {props.message ? <Text modifiers={[font({ size: 12 }), foregroundStyle(ink), lineLimit(3)]}>{props.message}</Text> : null}
      {props.responseText ? <Text modifiers={[font({size:12}),foregroundStyle(ink),lineLimit(3)]}>{props.responseText}</Text> : null}
      {props.inputStatus ? <Text modifiers={[font({size:11}),foregroundStyle(highlight),lineLimit(2)]}>{props.inputStatus}</Text> : null}
      {props.responseLinks?.length ? <HStack spacing={5}>{props.responseLinks.map(link=><Link key={link.url} destination={link.url}><Text modifiers={[font({size:11}),foregroundStyle(highlight),lineLimit(1)]}>{link.title}</Text></Link>)}</HStack> : null}
      <HStack spacing={props.view === 'actions' ? 8 : 4}>{props.navigation.map(control => <Button key={control.target} target={control.target} modifiers={[buttonStyle('plain'), frame({ minWidth: 44, maxWidth: 10000 })]}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(ink), lineLimit(1), padding({ horizontal: 6 }), frame({ minWidth: 44, maxWidth: 10000, minHeight: navigationHeight - navigationInset * 2, maxHeight: navigationHeight - navigationInset * 2 }), background(tile), cornerRadius(8), padding({ horizontal: navigationInset ? 2 : 0, vertical: navigationInset }), contentShape(shapes.rectangle())]}>{control.title}</Text>
      </Button>)}</HStack>
    </VStack>;
  };
  return {
    banner: <VStack modifiers={[activityBackgroundTint(colors[0]), background({ type: 'linearGradient', colors, startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } })]}>{list(false)}</VStack>,
    bannerSmall: list(false),
    compactLeading: props.primarySolidGlyph || props.view === 'replies' ? <Text modifiers={[font({family:'FontAwesome6Free-Solid',size:14}),foregroundStyle(dark?accent:'#A7F3D0')]}>{props.primarySolidGlyph ?? '\uf544'}</Text> : <Image systemName={props.view === 'actions' ? 'square.and.pencil' : props.view === 'search' ? 'magnifyingglass' : 'folder'} color={dark ? accent : '#A7F3D0'} />,
    minimal: props.primarySolidGlyph || props.view === 'replies' ? <Text modifiers={[font({family:'FontAwesome6Free-Solid',size:14}),foregroundStyle(dark?accent:'#A7F3D0')]}>{props.primarySolidGlyph ?? '\uf544'}</Text> : <Image systemName={props.view === 'search' ? 'magnifyingglass' : 'square.and.pencil'} color={dark ? accent : '#A7F3D0'} />,
    expandedBottom: list(true),
  };
};

export default createLiveActivity<SharedHandyActivityProps>('SharedHandyActivity', SharedHandyActivity);
