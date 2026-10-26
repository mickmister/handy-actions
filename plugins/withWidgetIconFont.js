const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;
const { withXcodeProject } = require('expo/config-plugins');

// expo-font registers the host app's fonts, but the WidgetKit extension is a
// separate process and needs its own bundled font and UIAppFonts registration.
module.exports = function withWidgetIconFont(config) {
  return withXcodeProject(config, next => {
    const project = next.modResults;
    const targetName = 'ExpoWidgetsTarget';
    const target = project.pbxTargetByName(targetName);
    if (!target) throw new Error('List withWidgetIconFont before expo-widgets so its Xcode mod runs after target creation');

    const directory = path.join(next.modRequest.platformProjectRoot, targetName);
    const filenames = ['FontAwesome6_Brands.ttf', 'FontAwesome6_Solid.ttf'];
    for (const filename of filenames) fs.copyFileSync(require.resolve(`@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/${filename}`), path.join(directory, filename));
    const infoPath = path.join(directory, 'Info.plist');
    const info = plist.parse(fs.readFileSync(infoPath, 'utf8'));
    info.UIAppFonts = [...new Set([...(info.UIAppFonts ?? []), ...filenames])];
    fs.writeFileSync(infoPath, plist.build(info));

    const group = project.findPBXGroupKey({ name: targetName });
    const targetUuid = project.findTargetKey(targetName);
    if (!group || !targetUuid) throw new Error('Widget extension group or target is missing');
    // node-xcode's lookup falls back to the host phase if the target has none.
    // Check the extension's own phase references before adding resources.
    const resources = project.hash.project.objects.PBXResourcesBuildPhase;
    if (!target.buildPhases.some(phase => resources?.[phase.value])) {
      project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetUuid);
    }
    // addResourceFile assumes a host Resources group, which Expo's current
    // template does not create. Attach the file directly to the widget group.
    for (const filename of filenames) {
      const file = project.addFile(filename, group);
      if (file) {
        file.uuid = project.generateUuid();
        file.target = targetUuid;
        project.addToPbxBuildFileSection(file);
        project.addToPbxResourcesBuildPhase(file);
      }
    }
    return next;
  });
};
