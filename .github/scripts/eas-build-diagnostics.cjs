const fs = require('node:fs/promises');

async function main() {
  const id = process.env.EAS_BUILD_ID;
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new Error('Invalid EAS build ID');
  const response = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.EXPO_TOKEN}`,
    },
    body: JSON.stringify({
      query: 'query($id: ID!) { builds { byId(buildId: $id) { id status error { message errorCode } logFiles } } }',
      variables: { id },
    }),
  });
  if (!response.ok) throw new Error(`EAS API returned HTTP ${response.status}`);
  const result = await response.json();
  if (result.errors) throw new Error(JSON.stringify(result.errors));
  const build = result.data.builds.byId;
  const directory = 'eas-build-diagnostics';
  await fs.mkdir(directory, { recursive: true });
  // Signed log URLs are only used to download logs, never published as metadata.
  const metadata = { id: build.id, status: build.status, error: build.error };
  await fs.writeFile(`${directory}/build.json`, JSON.stringify(metadata, null, 2));
  console.log(JSON.stringify(metadata, null, 2));
  for (const [index, url] of (build.logFiles || []).entries()) {
    const log = await fetch(url);
    if (!log.ok) throw new Error(`Log ${index} returned HTTP ${log.status}`);
    await fs.writeFile(`${directory}/log-${index}.txt`, await log.text());
  }
  console.log(`Downloaded ${(build.logFiles || []).length} build logs.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
