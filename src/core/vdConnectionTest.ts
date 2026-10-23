import type { OriginProfile } from './originRepository.ts';
import { createRequestClient, diagnosticText, type Transport } from './requestClient.ts';

export type VdConnectionTestResult = { ok: boolean; message: string };
export async function testVdConnection(profile: OriginProfile, transport: Transport): Promise<VdConnectionTestResult> {
  const endpoint = `GET ${profile.origin}/api/workspaces`;
  let status: number | undefined;
  try {
    const request = createRequestClient(async () => profile, async (url,init) => {
      const response = await transport(url,init);status=response.status;return response;
    });
    const response = await request(profile.id,'/api/workspaces',{diagnostics:true}) as {success?:boolean;data?:unknown};
    if (!response || response.success !== true || !Array.isArray(response.data) ||
      !response.data.every(workspace=>workspace&&typeof workspace==='object'&&typeof workspace.id==='string')) {
      return {ok:false,message:diagnosticText(`${endpoint}\nHTTP ${status}\nVD did not return a successful workspace-list response.\n${JSON.stringify(response)}`,profile)};
    }
    return {ok:true,message:diagnosticText(`VD connection succeeded.\n${endpoint}\nWorkspace API accepted the request (${response.data.length} workspaces visible).`,profile)};
  } catch (error) {
    return {ok:false,message:diagnosticText(`${endpoint}\n${error instanceof Error ? error.message : 'Connection test failed.'}`,profile)};
  }
}
