
import { logNetworkEvent } from "../_shared/network-utils.ts"
import { AppsScriptPayload } from "./types.ts"

export async function callAppsScript(
  appsScriptUrl: string,
  payload: AppsScriptPayload,
  requestId: string
): Promise<any> {
  console.log('[APPS SCRIPT CLIENT] 🚀 Starting Apps Script call:', {
    url: appsScriptUrl,
    payloadStructure: {
      hasAuthToken: !!payload.auth_token,
      action: payload.action,
      hasUserEmail: !!payload.userEmail,
      userEmail: payload.userEmail,
      userConfigKeys: Object.keys(payload.userConfig || {}),
      debugInfoKeys: Object.keys(payload.debug_info || {}),
      payloadSize: JSON.stringify(payload).length
    },
    requestId,
    timestamp: new Date().toISOString()
  });

  logNetworkEvent('CALLING_APPS_SCRIPT', {
    url: appsScriptUrl,
    userEmail: payload.userEmail,
    senders: payload.userConfig.senders,
    driveFolder: payload.userConfig.driveFolder,
    authMethod: 'shared-secret',
    request_id: requestId
  });

  // Log the exact payload being sent
  console.log('[APPS SCRIPT CLIENT] 📤 Exact payload being sent to Apps Script:', {
    fullPayload: JSON.stringify(payload, null, 2),
    contentType: 'application/json',
    requestId,
    timestamp: new Date().toISOString()
  });

  // Validate payload format before sending
  const validation = validateAppsScriptPayload(payload);
  if (!validation.isValid) {
    console.error('[APPS SCRIPT CLIENT] ❌ Payload validation failed before sending:', {
      errors: validation.errors,
      payload,
      requestId,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Invalid payload format: ${validation.errors.join(', ')}`);
  }

  // Make request to Apps Script with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  let response;
  const fetchStartTime = Date.now();
  
  try {
    console.log('[APPS SCRIPT CLIENT] 🌐 Making fetch request to Apps Script:', {
      url: appsScriptUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      },
      bodySize: JSON.stringify(payload).length,
      timeout: '60s',
      requestId,
      timestamp: new Date().toISOString()
    });

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
    const fetchDuration = Date.now() - fetchStartTime;
    
    console.log('[APPS SCRIPT CLIENT] 📥 Fetch response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      url: response.url,
      type: response.type,
      redirected: response.redirected,
      duration: `${fetchDuration}ms`,
      requestId,
      timestamp: new Date().toISOString()
    });

    // Log response headers
    const responseHeaders = Object.fromEntries(response.headers.entries());
    console.log('[APPS SCRIPT CLIENT] 📋 Response headers received:', {
      headers: responseHeaders,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      requestId,
      timestamp: new Date().toISOString()
    });

  } catch (fetchError) {
    clearTimeout(timeoutId);
    const fetchDuration = Date.now() - fetchStartTime;
    
    console.error('[APPS SCRIPT CLIENT] 💥 Fetch error occurred:', {
      error: fetchError.message,
      errorType: fetchError.name,
      duration: `${fetchDuration}ms`,
      isTimeout: fetchError.name === 'AbortError',
      requestId,
      timestamp: new Date().toISOString()
    });
    
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
    console.error('[APPS SCRIPT CLIENT] ❌ Apps Script returned error status:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      requestId,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Apps Script error (${response.status}): ${response.statusText}`);
  }

  // Parse Apps Script response with enhanced logging
  let responseText: string;
  let appsScriptData: any;
  
  try {
    console.log('[APPS SCRIPT CLIENT] 📖 Reading response text...');
    responseText = await response.text();
    
    console.log('[APPS SCRIPT CLIENT] 📄 Raw response text received:', {
      textLength: responseText.length,
      textPreview: responseText.substring(0, 500),
      fullText: responseText.length <= 2000 ? responseText : 'Text too long to log fully',
      hasContent: responseText.length > 0,
      requestId,
      timestamp: new Date().toISOString()
    });

    console.log('[APPS SCRIPT CLIENT] 🔍 Attempting JSON parse...');
    appsScriptData = JSON.parse(responseText);
    
    console.log('[APPS SCRIPT CLIENT] ✅ JSON parse successful:', {
      dataStructure: {
        hasStatus: 'status' in appsScriptData,
        status: appsScriptData.status,
        hasMessage: 'message' in appsScriptData,
        message: appsScriptData.message,
        hasData: 'data' in appsScriptData,
        dataKeys: appsScriptData.data ? Object.keys(appsScriptData.data) : [],
        hasError: 'error' in appsScriptData,
        topLevelKeys: Object.keys(appsScriptData)
      },
      fullData: JSON.stringify(appsScriptData, null, 2),
      requestId,
      timestamp: new Date().toISOString()
    });

    // Validate Apps Script response format
    const responseValidation = validateAppsScriptResponse(appsScriptData);
    if (!responseValidation.isValid) {
      console.error('[APPS SCRIPT CLIENT] ⚠️ Apps Script response format validation failed:', {
        errors: responseValidation.errors,
        response: appsScriptData,
        requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    logNetworkEvent('SUCCESS', {
      status: appsScriptData.status,
      attachments: appsScriptData.data?.attachments || 0,
      request_id: requestId
    });

    return appsScriptData;
    
  } catch (parseError) {
    console.error('[APPS SCRIPT CLIENT] 💥 JSON parse failed:', {
      parseError: parseError.message,
      responseText: responseText,
      textLength: responseText?.length || 0,
      textSample: responseText?.substring(0, 200) || 'No text available',
      requestId,
      timestamp: new Date().toISOString()
    });
    throw new Error('Apps Script returned invalid JSON: ' + parseError.message);
  }
}

function validateAppsScriptPayload(payload: AppsScriptPayload): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!payload.auth_token) errors.push('Missing auth_token');
  if (!payload.action) errors.push('Missing action');
  if (payload.action !== 'process_gmail_flow') errors.push(`Invalid action: ${payload.action}`);
  if (!payload.userConfig) errors.push('Missing userConfig');
  if (payload.userConfig && !payload.userConfig.driveFolder) errors.push('Missing userConfig.driveFolder');
  if (payload.userConfig && !payload.userConfig.flowName) errors.push('Missing userConfig.flowName');
  if (!payload.debug_info) errors.push('Missing debug_info');
  if (payload.debug_info && !payload.debug_info.request_id) errors.push('Missing debug_info.request_id');

  return {
    isValid: errors.length === 0,
    errors
  };
}

function validateAppsScriptResponse(response: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof response !== 'object') errors.push('Response is not an object');
  if (!('status' in response)) errors.push('Missing status field');
  if (response.status && !['success', 'error'].includes(response.status)) {
    errors.push(`Invalid status value: ${response.status}`);
  }
  if (response.status === 'success' && !response.data) {
    errors.push('Success response missing data field');
  }
  if (response.status === 'error' && !response.message) {
    errors.push('Error response missing message field');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
