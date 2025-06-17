
import { logNetworkEvent } from "../_shared/network-utils.ts"
import { AppsScriptPayload } from "./types.ts"

export async function callAppsScript(
  appsScriptUrl: string,
  payload: AppsScriptPayload,
  requestId: string
): Promise<any> {
  logNetworkEvent('CALLING_APPS_SCRIPT', {
    url: appsScriptUrl,
    userEmail: payload.userEmail,
    senders: payload.userConfig.senders,
    driveFolder: payload.userConfig.driveFolder,
    authMethod: 'shared-secret',
    request_id: requestId
  });

  // Make request to Apps Script with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  let response;
  try {
    response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
  } catch (fetchError) {
    clearTimeout(timeoutId);
    logNetworkEvent('FETCH_ERROR', { 
      error: fetchError.message,
      request_id: requestId
    });
    
    if (fetchError.name === 'AbortError') {
      throw new Error('Apps Script request timeout (60s)');
    }
    
    throw fetchError;
  }

  logNetworkEvent('APPS_SCRIPT_RESPONSE', {
    status: response.status,
    request_id: requestId
  });

  if (!response.ok) {
    throw new Error(`Apps Script error (${response.status})`);
  }

  // Parse Apps Script response
  try {
    const responseText = await response.text();
    const appsScriptData = JSON.parse(responseText);
    
    logNetworkEvent('SUCCESS', {
      status: appsScriptData.status,
      attachments: appsScriptData.data?.attachments || 0,
      request_id: requestId
    });

    return appsScriptData;
  } catch (error) {
    throw new Error('Apps Script returned invalid JSON: ' + error.message);
  }
}
