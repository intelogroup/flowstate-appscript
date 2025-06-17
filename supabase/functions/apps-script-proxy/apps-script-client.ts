
export async function callAppsScript(
  appsScriptUrl: string,
  twoLayerPayload: any, // Changed from AppsScriptPayload to support two-layer
  requestId: string
): Promise<any> {
  console.log('[APPS SCRIPT CLIENT] 🚀 Starting Apps Script call with two-layer format:', {
    url: appsScriptUrl,
    hasSecret: !!twoLayerPayload.secret,
    hasPayload: !!twoLayerPayload.payload,
    innerAction: twoLayerPayload.payload?.action,
    innerUserEmail: twoLayerPayload.payload?.userEmail,
    requestId,
    timestamp: new Date().toISOString()
  });

  // Validate two-layer structure before sending
  const structureValidation = validateTwoLayerStructure(twoLayerPayload);
  if (!structureValidation.isValid) {
    console.error('[APPS SCRIPT CLIENT] ❌ Two-layer structure validation failed:', {
      errors: structureValidation.errors,
      payload: twoLayerPayload,
      requestId,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Invalid two-layer payload structure: ${structureValidation.errors.join(', ')}`);
  }

  console.log('[APPS SCRIPT CLIENT] 📤 Sending two-layer payload to Apps Script:', {
    payloadStructure: {
      topLevel: Object.keys(twoLayerPayload),
      secret: twoLayerPayload.secret ? 'Present' : 'Missing',
      payload: twoLayerPayload.payload ? Object.keys(twoLayerPayload.payload) : 'Missing'
    },
    innerPayloadDetails: twoLayerPayload.payload ? {
      action: twoLayerPayload.payload.action,
      hasUserConfig: !!twoLayerPayload.payload.userConfig,
      hasUserEmail: !!twoLayerPayload.payload.userEmail,
      hasDebugInfo: !!twoLayerPayload.payload.debug_info,
      userConfigKeys: twoLayerPayload.payload.userConfig ? Object.keys(twoLayerPayload.payload.userConfig) : [],
      debugInfoKeys: twoLayerPayload.payload.debug_info ? Object.keys(twoLayerPayload.payload.debug_info) : []
    } : null,
    payloadSize: JSON.stringify(twoLayerPayload).length,
    requestId,
    timestamp: new Date().toISOString()
  });

  const fetchStartTime = Date.now();
  
  try {
    console.log('[APPS SCRIPT CLIENT] 🌐 Making fetch request to Apps Script...');
    
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(twoLayerPayload)
    });

    const fetchDuration = Date.now() - fetchStartTime;
    console.log('[APPS SCRIPT CLIENT] 📥 Apps Script response received:', {
      fetchDuration: `${fetchDuration}ms`,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      url: response.url,
      type: response.type,
      redirected: response.redirected,
      responseHeaders: Object.fromEntries(response.headers.entries()),
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      requestId,
      timestamp: new Date().toISOString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[APPS SCRIPT CLIENT] ❌ Apps Script HTTP error:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        errorLength: errorText.length,
        sentPayloadStructure: {
          hasSecret: !!twoLayerPayload.secret,
          hasPayload: !!twoLayerPayload.payload,
          innerAction: twoLayerPayload.payload?.action
        },
        requestId,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Apps Script HTTP ${response.status}: ${errorText}`);
    }

    let responseText;
    try {
      responseText = await response.text();
      console.log('[APPS SCRIPT CLIENT] 📋 Raw Apps Script response text:', {
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 500),
        isEmpty: responseText.trim().length === 0,
        requestId,
        timestamp: new Date().toISOString()
      });
    } catch (textError) {
      console.error('[APPS SCRIPT CLIENT] ❌ Failed to read response text:', {
        textError: textError instanceof Error ? textError.message : String(textError),
        requestId,
        timestamp: new Date().toISOString()
      });
      throw new Error('Failed to read Apps Script response text');
    }

    if (!responseText || responseText.trim().length === 0) {
      console.error('[APPS SCRIPT CLIENT] ❌ Empty response from Apps Script:', {
        responseText,
        sentPayload: twoLayerPayload,
        requestId,
        timestamp: new Date().toISOString()
      });
      throw new Error('Empty response received from Apps Script');
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
      console.log('[APPS SCRIPT CLIENT] ✅ Apps Script response parsed successfully:', {
        parsedResponseStructure: {
          topLevelKeys: Object.keys(parsedResponse || {}),
          status: parsedResponse?.status,
          message: parsedResponse?.message,
          hasData: !!parsedResponse?.data,
          version: parsedResponse?.version,
          processingTime: parsedResponse?.processing_time
        },
        dataStructure: parsedResponse?.data ? {
          dataKeys: Object.keys(parsedResponse.data),
          attachments: parsedResponse.data.attachments,
          processedEmails: parsedResponse.data.processedEmails,
          emailsFound: parsedResponse.data.emailsFound,
          authMethod: parsedResponse.data.authMethod
        } : null,
        fetchDuration: `${fetchDuration}ms`,
        requestId,
        timestamp: new Date().toISOString()
      });
    } catch (parseError) {
      console.error('[APPS SCRIPT CLIENT] ❌ Failed to parse Apps Script JSON response:', {
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
        responseText: responseText.substring(0, 1000),
        responseLength: responseText.length,
        sentPayloadStructure: {
          hasSecret: !!twoLayerPayload.secret,
          hasPayload: !!twoLayerPayload.payload
        },
        requestId,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Invalid JSON response from Apps Script: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    // Validate response format
    const responseValidation = validateAppsScriptResponse(parsedResponse);
    if (!responseValidation.isValid) {
      console.error('[APPS SCRIPT CLIENT] ❌ Apps Script response format validation failed:', {
        errors: responseValidation.errors,
        response: parsedResponse,
        requestId,
        timestamp: new Date().toISOString()
      });
    }

    console.log('[APPS SCRIPT CLIENT] 🎉 Apps Script call completed successfully:', {
      responseStatus: parsedResponse.status,
      responseMessage: parsedResponse.message,
      hasResponseData: !!parsedResponse.data,
      authMethod: parsedResponse.data?.authMethod,
      version: parsedResponse.version,
      totalDuration: `${fetchDuration}ms`,
      requestId,
      timestamp: new Date().toISOString()
    });

    return parsedResponse;

  } catch (error) {
    const fetchDuration = Date.now() - fetchStartTime;
    console.error('[APPS SCRIPT CLIENT] 💥 Apps Script call failed:', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : 'No stack trace',
      fetchDuration: `${fetchDuration}ms`,
      sentPayloadStructure: {
        hasSecret: !!twoLayerPayload.secret,
        hasPayload: !!twoLayerPayload.payload,
        innerAction: twoLayerPayload.payload?.action
      },
      requestId,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

function validateTwoLayerStructure(payload: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!payload) {
    errors.push('Payload is null or undefined');
    return { isValid: false, errors };
  }

  if (typeof payload !== 'object') {
    errors.push('Payload is not an object');
    return { isValid: false, errors };
  }

  // Top-level validation
  if (!payload.secret) errors.push('Missing top-level secret');
  if (!payload.payload) errors.push('Missing top-level payload');

  // Inner payload validation
  if (payload.payload && typeof payload.payload === 'object') {
    if (!payload.payload.action) errors.push('Missing payload.action');
    if (!payload.payload.userConfig) errors.push('Missing payload.userConfig');
  } else if (payload.payload) {
    errors.push('payload.payload is not an object');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function validateAppsScriptResponse(response: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!response) {
    errors.push('Response is null or undefined');
    return { isValid: false, errors };
  }

  if (typeof response !== 'object') {
    errors.push('Response is not an object');
    return { isValid: false, errors };
  }

  if (!('status' in response)) {
    errors.push('Missing status field');
  }

  if (response.status && !['success', 'error'].includes(response.status)) {
    errors.push(`Invalid status value: ${response.status} (expected: success or error)`);
  }

  if (response.status === 'success') {
    if (!response.data) {
      errors.push('Success response missing data field');
    }
  }

  if (response.status === 'error') {
    if (!response.message) {
      errors.push('Error response missing message field');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
