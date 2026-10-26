import { Button, HStack, Image, Link, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, font, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type HandyWidgetProps = {
  enabled: boolean;
  presetName: string;
  openUrl: string;
  actions: { title: string; url: string; captureTarget?: string; siteGlyph?: string; solidGlyph?: string; systemImage?: 'note.text' | 'magnifyingglass' }[];
};

const HandyActionsWidget = (props: HandyWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const ready = props.enabled && props.actions?.length > 0;
  const primaryUrl = ready ? props.actions[0].url : props.openUrl;
  const label = ready ? props.actions[0].title : 'Open Handy Actions';
  const icon = (action: HandyWidgetProps['actions'][number]) => action.solidGlyph
    ? <Text modifiers={[font({ family: 'FontAwesome6Free-Solid', size: 16 })]}>{action.solidGlyph}</Text>
    : action.siteGlyph
    ? <Text modifiers={[font({ family: 'FontAwesome6Brands-Regular', size: 16 })]}>{action.siteGlyph}</Text>
    : <Image systemName={action.systemImage ?? (action.captureTarget ? 'square.and.pencil' : 'link')} size={16} />;
  if (environment.widgetFamily === 'accessoryInline') {
    // WidgetKit's inline accessory supports a text/link, not an interactive button.
    return <Text modifiers={primaryUrl ? [widgetURL(primaryUrl)] : []}>{ready ? `Open ${label}` : 'Handy Actions · off'}</Text>;
  }
  if (environment.widgetFamily === 'accessoryCircular') {
    if (ready && props.actions[0].captureTarget) return <Button target={props.actions[0].captureTarget} modifiers={[buttonStyle('plain')]}>
      <VStack>{icon(props.actions[0])}<Text modifiers={[font({size:10})]}>{label}</Text></VStack>
    </Button>;
    return <VStack modifiers={primaryUrl ? [widgetURL(primaryUrl)] : []}>
      {ready ? icon(props.actions[0]) : <Image systemName="link.circle" />}
      <Text modifiers={[font({ size: 10 })]}>{ready ? label : 'Handy'}</Text>
    </VStack>;
  }
  return <VStack modifiers={props.openUrl ? [widgetURL(props.openUrl)] : []}>
    <Text modifiers={[font({ size: 12, weight: 'bold' })]}>{ready ? props.presetName : 'Handy Actions'}</Text>
    {ready ? props.actions.slice(0, 2).map((action) => {
      const label = <HStack spacing={5}>{icon(action)}<Text modifiers={[font({ size: 12 })]}>{action.title}</Text></HStack>;
      return action.captureTarget
        ? <Button key={action.url} target={action.captureTarget} modifiers={[buttonStyle('plain')]}>{label}</Button>
        : <Link key={action.url} destination={action.url}>{label}</Link>;
    }) : <Text modifiers={[font({ size: 11 })]}>Enable widgets in Settings</Text>}
  </VStack>;
};

export default createWidget<HandyWidgetProps>('HandyActionsWidget', HandyActionsWidget);
