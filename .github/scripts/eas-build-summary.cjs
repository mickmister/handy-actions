const fs = require('node:fs');

const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const builds = Array.isArray(result) ? result : [result];
if (builds.length === 0) {
  throw new Error('EAS returned no builds');
}

const lines = ['## Expo builds', ''];
for (const build of builds) {
  const { app, id, platform, status, artifacts } = build;
  if (!id || !app?.ownerAccount?.name || !app?.slug) {
    throw new Error('EAS build metadata is missing its build ID or project');
  }
  const page = `https://expo.dev/accounts/${encodeURIComponent(app.ownerAccount.name)}/projects/${encodeURIComponent(app.slug)}/builds/${encodeURIComponent(id)}`;
  lines.push(`### ${platform} — ${status}`, '', `- [Build details / install preview](${page})`);
  const download = artifacts?.applicationArchiveUrl || artifacts?.buildUrl;
  if (status === 'FINISHED' && download) {
    lines.push(`- [Download build artifact](${download})`);
  }
  lines.push('');
}

const summary = `${lines.join('\n')}\n`;
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
process.stdout.write(summary);
