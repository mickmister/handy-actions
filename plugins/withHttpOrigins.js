const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

// Origins are configured at runtime, including Tailscale IPs and MagicDNS
// names, so HTTP support cannot use a fixed build-time domain allowlist.
module.exports = function withHttpOrigins(config) {
  config = withInfoPlist(config, next => {
    const transport = { ...next.modResults.NSAppTransportSecurity };
    // On iOS 10+, the presence of these narrower exceptions makes iOS ignore
    // NSAllowsArbitraryLoads, even when their value is false.
    delete transport.NSAllowsLocalNetworking;
    delete transport.NSAllowsArbitraryLoadsForMedia;
    delete transport.NSAllowsArbitraryLoadsInWebContent;
    transport.NSAllowsArbitraryLoads = true;
    next.modResults.NSAppTransportSecurity = transport;
    return next;
  });
  return withAndroidManifest(config, next => {
    const application = next.modResults.manifest.application?.[0];
    if (!application) throw new Error('Android application manifest entry is missing');
    application.$['android:usesCleartextTraffic'] = 'true';
    return next;
  });
};
