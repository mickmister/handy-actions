import assert from 'node:assert/strict';
import test from 'node:test';

import {
  actionFromNotificationRowsData,
  actionIdFromPressId,
  actionNotificationRows,
  actionPressId,
  defaultHandyState,
  exportHandyState,
  findAction,
  importHandyState,
  liveActivityPropsForPreset,
  liveActivityActionRowsForPreset,
  liveActivityCaptureTarget,
  notificationBodyForPreset,
  notificationIdForPreset,
  notificationRowsData,
  presetIdFromPressId,
  presetPressId,
  validateHandyState,
  surfaceSettings,
  textInputUrl,
  widgetPreset,
  type HandyPreset,
  type HandyState,
} from '../src/core/handyModel.ts';

test('default state starts local and empty', () => {
  const state = defaultHandyState();
  assert.deepEqual(state, { presets: [] });
});

test('native capture target preserves scoped destination snapshot and round trips through reply data', () => {
  const action = {
    id: 'note', name: 'Add "café" 📝',
    payload: { type: 'text-input' as const, urlTemplate: 'otherapp://note?text={text}&source=lock' },
  };
  const target = liveActivityCaptureTarget('preset-b', action)!;
  const capture = JSON.parse(target.slice('handy-note-capture-v1:'.length));
  assert.equal(capture.presetId, 'preset-b');
  assert.equal(capture.title, action.name);
  // This is the same path used by the existing Notifee reply handler on cold start.
  assert.deepEqual(actionFromNotificationRowsData(capture.actionId, capture.actions), action);
  action.payload.urlTemplate = 'changed://destination?text={text}';
  assert.equal(actionFromNotificationRowsData(capture.actionId, capture.actions)?.payload.type, 'text-input');
  assert.equal(JSON.parse(capture.actions)[0].payload.urlTemplate, 'otherapp://note?text={text}&source=lock');
  assert.equal(liveActivityCaptureTarget('preset-a', { id: 'qr', name: 'QR', payload: { type: 'qr', value: 'abc' } }), undefined);
});

test('live activity props summarize the preset without app runtime state', () => {
  const preset: HandyPreset = {
    id: 'conference',
    name: 'Social/Conference',
    enabled: true,
    actions: [
      { id: 'a1', name: 'My LinkTree', payload: { type: 'qr', value: 'https://example.test/linktree' } },
      { id: 'a2', name: 'My LinkedIn', payload: { type: 'qr', value: 'https://example.test/linkedin' } },
      { id: 'a3', name: 'My website', payload: { type: 'qr', value: 'https://example.test' } },
      { id: 'a4', name: 'Landing page', payload: { type: 'qr', value: 'https://example.test/app' } },
    ],
  };

  assert.deepEqual(liveActivityPropsForPreset(preset, '2026-10-02T20:00:00.000Z', 'handyactions://preset-actions?presetId=conference'), {
    presetId: 'conference',
    presetName: 'Social/Conference',
    actionCount: 4,
    firstAction: 'My LinkTree',
    secondAction: 'My LinkedIn',
    thirdAction: 'My website',
    updatedAt: '2026-10-02T20:00:00.000Z',
    openUrl: 'handyactions://preset-actions?presetId=conference',
  });
});

test('Live Activity rows retain every action in order, including capture destinations beyond the third action', () => {
  const preset: HandyPreset = {
    id: 'many-actions', name: 'Many actions', enabled: true,
    actions: Array.from({length:7}, (_, index) => ({
      id: `action-${index}`, name: 'Same label',
      payload: {type:'text-input',urlTemplate:`app://note-${index}?text={text}`},
    })),
  };
  for (const count of [0,1,2,3,4,5,6,7]) {
    const subset = {...preset,actions:preset.actions.slice(0,count)};
    const rows = liveActivityActionRowsForPreset(subset, action => ({
      title:action.name,
      url:`app://capture?presetId=${preset.id}&actionId=${action.id}`,
      captureTarget:liveActivityCaptureTarget(preset.id,action),
    }));
    assert.equal(rows.length,Math.ceil(count/2));
    assert.equal(rows.every(row=>row.length>0&&row.length<=2),true);
    assert.deepEqual(rows.flat().map(link=>new URL(link.url).searchParams.get('actionId')),subset.actions.map(action=>action.id));
    for (const [index,link] of rows.flat().entries()) {
      const snapshot=JSON.parse(link.captureTarget!.slice('handy-note-capture-v1:'.length));
      assert.equal(snapshot.presetId,preset.id);
      assert.deepEqual(actionFromNotificationRowsData(snapshot.actionId,snapshot.actions),subset.actions[index]);
    }
    // Live Activity layout must not inherit notification quick-action limits.
    assert.equal(actionNotificationRows(subset).length,Math.min(count,3));
  }
});

test('validates typed action payloads', () => {
  const state: HandyState = {
    presets: [
      {
        id: 'conference',
        name: 'Conference',
        enabled: true,
        actions: [
          { id: 'linktree', name: 'My LinkTree', payload: { type: 'qr', value: 'https://example.test/linktree' } },
          {
            id: 'docs',
            name: 'Agenda Doc',
            payload: {
              type: 'deeplink',
              url: 'googledocs://document/d/abc',
            },
          },
          { id: 'site', name: 'Website', payload: { type: 'web', url: 'https://example.test' } },
        ],
      },
    ],
  };

  assert.equal(validateHandyState(state).ok, true);
});

test('rejects ambiguous payload JSON', () => {
  const state = {
    presets: [
      {
        id: 'bad',
        name: 'Bad',
        enabled: true,
        actions: [{ id: 'x', name: 'No type', payload: { url: 'https://example.test' } }],
      },
    ],
  };

  const result = validateHandyState(state);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /payload.type/);
});

test('import/export round trips normalized state', () => {
  const state: HandyState = {
    presets: [
      {
        id: 'p1',
        name: 'Social',
        enabled: false,
        actions: [{ id: 'a1', name: 'Website', payload: { type: 'qr', value: 'https://example.test' } }],
      },
    ],
  };

  assert.deepEqual(importHandyState(exportHandyState(state)), state);
});

test('notification rows are stable and capped to OS-size controls', () => {
  const preset: HandyPreset = {
    id: 'conference',
    name: 'Conference',
    enabled: true,
    actions: [
      { id: 'a1', name: 'One', payload: { type: 'qr', value: '1' } },
      { id: 'a2', name: 'Two', payload: { type: 'qr', value: '2' } },
      { id: 'a3', name: 'Three', payload: { type: 'qr', value: '3' } },
      { id: 'a4', name: 'Four', payload: { type: 'qr', value: '4' } },
    ],
  };

  assert.equal(notificationIdForPreset(preset), 'handy-preset-conference');
  assert.deepEqual(
    actionNotificationRows(preset).map((row) => row.id),
    ['a1', 'a2', 'a3'],
  );
});

test('notification metadata builds real action press ids instead of body text commands', () => {
  const preset: HandyPreset = {
    id: 'conference',
    name: 'Social/Conference',
    enabled: true,
    actions: [
      { id: 'linkedin-one', name: 'LinkedIn', payload: { type: 'web', url: 'https://www.linkedin.com/in/example-one' } },
      { id: 'linkedin-two', name: 'LinkedIn', payload: { type: 'web', url: 'https://www.linkedin.com/in/example-two' } },
    ],
  };

  assert.equal(notificationBodyForPreset(preset), 'Long-press or expand for 2 actions.');
  assert.equal(actionPressId('linkedin-one'), 'handy-action:linkedin-one');
  assert.equal(actionIdFromPressId('handy-action:linkedin-two'), 'linkedin-two');
  assert.equal(presetPressId('conference'), 'handy-preset-press:conference');
  assert.equal(presetIdFromPressId('handy-preset-press:conference'), 'conference');
  assert.equal(actionIdFromPressId('open-app'), undefined);
  assert.equal(presetIdFromPressId('open-app'), undefined);

  const action = actionFromNotificationRowsData('linkedin-two', notificationRowsData(preset));
  assert.deepEqual(action, {
    id: 'linkedin-two',
    name: 'LinkedIn',
    payload: { type: 'web', url: 'https://www.linkedin.com/in/example-two' },
  });
});

test('text destinations preserve note contents and existing URL components', () => {
  const text = 'Hello & goodbye? #tag 100%\n日本語 😀';
  const url = textInputUrl('someapp://add-note?workspace=abc&text={text}#editor', text);
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('text'), text);
  assert.equal(parsed.searchParams.get('workspace'), 'abc');
  assert.equal(parsed.hash, '#editor');
  assert.equal(textInputUrl('someapp://notes/{text}', 'a/b'), 'someapp://notes/a%2Fb');
  assert.throws(() => textInputUrl('someapp://notes?text={text}', ' \n '), /Enter a note/);
  for (const invalid of ['someapp://notes', 'https://{text}.example.test', 'javascript://run?text={text}', 'not a url {text}']) {
    assert.throws(() => textInputUrl(invalid, 'note'), /Invalid text destination/);
  }
});

test('text-input actions round trip through storage, export and notification snapshots', () => {
  const state: HandyState = {
    presets: [{ id: 'p', name: 'Notes', enabled: true, actions: [{
      id: 'note', name: 'Add Note', payload: { type: 'text-input', urlTemplate: 'handyactionspreview://notes?text={text}' },
    }] }],
    surfaces: { liveActivities: true, lockScreenWidgets: true, notifications: false, widgetPresetId: 'p' },
  };
  assert.equal(validateHandyState(state).ok, true);
  assert.deepEqual(importHandyState(exportHandyState(state)), state);
  assert.deepEqual(actionFromNotificationRowsData('note', notificationRowsData(state.presets[0])), state.presets[0].actions[0]);
  const invalid = structuredClone(state);
  invalid.presets[0].actions[0].payload = { type: 'text-input', urlTemplate: 'app://note' };
  assert.equal(validateHandyState(invalid).ok, false);
});

test('legacy presets retain surface defaults and widget selection uses an enabled nonempty preset', () => {
  const legacy = importHandyState('{"presets":[]}');
  assert.deepEqual(surfaceSettings(legacy), { liveActivities: true, lockScreenWidgets: false, notifications: true });
  const state: HandyState = {
    surfaces: { liveActivities: false, lockScreenWidgets: true, notifications: false, widgetPresetId: 'second' },
    presets: [
      { id: 'first', name: 'First', enabled: true, actions: [{ id: 'a', name: 'A', payload: { type: 'web', url: 'https://example.test' } }] },
      { id: 'second', name: 'Second', enabled: true, actions: [{ id: 'b', name: 'B', payload: { type: 'qr', value: 'b' } }] },
    ],
  };
  assert.equal(widgetPreset(state)?.id, 'second');
  state.presets[1].actions[0].id = 'a';
  assert.equal(findAction(state, 'a', 'second')?.action.name, 'B');
  assert.equal(findAction(state, 'a', 'missing'), undefined);
  state.presets[1].enabled = false;
  assert.equal(widgetPreset(state)?.id, 'first');
  state.presets[0].actions = [];
  assert.equal(widgetPreset(state), undefined);
  assert.deepEqual(surfaceSettings(state), { liveActivities: false, lockScreenWidgets: true, notifications: false, widgetPresetId: 'second' });
});

test('legacy imports disable fallbacks and remote action exports contain references only',()=>{
  const legacy=importHandyState(JSON.stringify({presets:[{id:'p',name:'P',enabled:false,actions:[
    {id:'deep',name:'Deep',payload:{type:'deeplink',url:'app://target',fallbackUrl:'https://legacy.test'}},
    {id:'input',name:'Input',payload:{type:'text-input',urlTemplate:'app://target?text={text}',fallbackUrlTemplate:'https://legacy.test?text={text}'}},
  ]}]}));
  assert.equal(exportHandyState(legacy).includes('fallback'),false);
  assert.deepEqual(legacy.presets[0].actions[0].payload,{type:'deeplink',url:'app://target'});
  const state:HandyState={theme:'paper',presets:[{id:'p',name:'P',enabled:true,actions:[
    {id:'http',name:'HTTP',payload:{type:'http',originId:'local-origin',path:'/api',method:'POST',bodyFormat:'json',body:'{"text":"{text}"}',captureText:true}},
    {id:'agent',name:'Agent',payload:{type:'vd-agent',originId:'local-origin',prefix:'new project',session:{id:'s',workspaceId:'w',label:'Intake · CLAUDE_CODE',executor:'CLAUDE_CODE'}}},
  ]}]};
  assert.deepEqual(importHandyState(exportHandyState(state)),state);
  for(const action of state.presets[0].actions) {
    const target=liveActivityCaptureTarget('p',action,false,true)!;
    const wire=JSON.parse(target.slice('handy-note-capture-v1:'.length));
    assert.equal(wire.backgroundRequest,true);
    assert.deepEqual(actionFromNotificationRowsData(action.id,wire.actions),action);
    assert.equal(target.includes('Authorization'),false);
  }
});
