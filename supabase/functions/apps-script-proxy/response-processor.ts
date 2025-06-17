
export function processAppsScriptResponse(
  appsScriptData: any,
  userEmail: string | null,
  requestId: string,
  totalDuration: number
): any {
  console.log('[RESPONSE PROCESSOR] 🔄 Processing Apps Script response from two-layer format:', {
    rawResponse: JSON.stringify(appsScriptData, null, 2),
    userEmail,
    requestId,
    totalDuration,
    expectedFormat: 'V.06-FRONTEND-COMPATIBLE-TWO-LAYER',
    timestamp: new Date().toISOString()
  });

  // Analyze response structure for two-layer format compatibility
  console.log('[RESPONSE PROCESSOR] 🔍 Two-layer response structure analysis:', {
    topLevelKeys: Object.keys(appsScriptData || {}),
    hasStatus: 'status' in (appsScriptData || {}),
    status: appsScriptData?.status,
    hasMessage: 'message' in (appsScriptData || {}),
    message: appsScriptData?.message,
    hasData: 'data' in (appsScriptData || {}),
    version: appsScriptData?.version,
    authMethod: appsScriptData?.data?.authMethod,
    processingTime: appsScriptData?.processing_time,
    dataStructure: appsScriptData?.data ? {
      dataKeys: Object.keys(appsScriptData.data),
      attachments: appsScriptData.data.attachments,
      processedEmails: appsScriptData.data.processedEmails,
      emailsFound: appsScriptData.data.emailsFound,
      flowName: appsScriptData.data.flowName,
      userEmail: appsScriptData.data.userEmail,
      authMethod: appsScriptData.data.authMethod,
      hasDebugInfo: !!appsScriptData.data.debugInfo
    } : null,
    hasError: 'error' in (appsScriptData || {}),
    error: appsScriptData?.error,
    requestId,
    timestamp: new Date().toISOString()
  });

  // Validate response format for two-layer compatibility
  const validation = validateTwoLayerResponseFormat(appsScriptData);
  if (!validation.isValid) {
    console.error('[RESPONSE PROCESSOR] ❌ Two-layer response format validation failed:', {
      errors: validation.errors,
      response: appsScriptData,
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  // Check for two-layer format version
  const isTwoLayerFormat = appsScriptData?.version?.includes('TWO-LAYER') || 
                           appsScriptData?.data?.authMethod === 'two-layer-secret-payload';

  console.log('[RESPONSE PROCESSOR] 🏷️ Format detection:', {
    version: appsScriptData?.version,
    authMethod: appsScriptData?.data?.authMethod,
    isTwoLayerFormat,
    detectionCriteria: {
      versionHasTwoLayer: appsScriptData?.version?.includes('TWO-LAYER'),
      authMethodIsTwoLayer: appsScriptData?.data?.authMethod === 'two-layer-secret-payload'
    },
    requestId,
    timestamp: new Date().toISOString()
  });

  // Process based on status
  if (appsScriptData?.status === 'success') {
    console.log('[RESPONSE PROCESSOR] ✅ Processing two-layer success response:', {
      dataAvailable: !!appsScriptData.data,
      attachments: appsScriptData.data?.attachments || 0,
      processedEmails: appsScriptData.data?.processedEmails || 0,
      emailsFound: appsScriptData.data?.emailsFound || 0,
      flowName: appsScriptData.data?.flowName,
      userEmail: appsScriptData.data?.userEmail,
      authMethod: appsScriptData.data?.authMethod,
      hasDebugInfo: !!appsScriptData.data?.debugInfo,
      processingTime: appsScriptData.processing_time,
      version: appsScriptData.version,
      requestId,
      timestamp: new Date().toISOString()
    });

    const processedResponse = {
      success: true,
      message: appsScriptData.message || `Flow processed successfully using two-layer authentication`,
      request_id: requestId,
      auth_method: 'two-layer-secret-payload',
      user_email: userEmail,
      performance_metrics: {
        total_duration: totalDuration,
        apps_script_processing_time: appsScriptData.processing_time || 0
      },
      apps_script_response: appsScriptData,
      debug_info: {
        user_email: userEmail,
        auth_headers_received: true,
        response_processing: 'success',
        two_layer_format: isTwoLayerFormat,
        version: appsScriptData.version,
        auth_method_from_response: appsScriptData.data?.authMethod
      }
    };

    console.log('[RESPONSE PROCESSOR] 📤 Final two-layer success response:', {
      response: JSON.stringify(processedResponse, null, 2),
      requestId,
      timestamp: new Date().toISOString()
    });

    return processedResponse;

  } else if (appsScriptData?.status === 'error') {
    console.error('[RESPONSE PROCESSOR] ❌ Processing two-layer error response:', {
      errorMessage: appsScriptData.message,
      hasDetails: !!appsScriptData.details,
      details: appsScriptData.details,
      version: appsScriptData.version,
      fullError: appsScriptData,
      requestId,
      timestamp: new Date().toISOString()
    });

    const errorResponse = {
      error: 'Apps Script execution failed',
      details: appsScriptData.message || 'Unknown Apps Script error',
      request_id: requestId,
      total_duration: totalDuration,
      debug_info: {
        user_email: userEmail,
        apps_script_response: appsScriptData,
        auth_method: 'two-layer-secret-payload',
        response_processing: 'error',
        two_layer_format: isTwoLayerFormat,
        version: appsScriptData.version
      }
    };

    console.log('[RESPONSE PROCESSOR] 📤 Final two-layer error response:', {
      response: JSON.stringify(errorResponse, null, 2),
      requestId,
      timestamp: new Date().toISOString()
    });

    return errorResponse;

  } else {
    console.error('[RESPONSE PROCESSOR] ⚠️ Unexpected two-layer response format:', {
      status: appsScriptData?.status,
      unexpectedFormat: true,
      response: appsScriptData,
      version: appsScriptData?.version,
      requestId,
      timestamp: new Date().toISOString()
    });

    const unexpectedResponse = {
      error: 'Unexpected Apps Script response format',
      details: `Received status: ${appsScriptData?.status || 'undefined'}, version: ${appsScriptData?.version || 'unknown'}`,
      request_id: requestId,
      total_duration: totalDuration,
      debug_info: {
        user_email: userEmail,
        apps_script_response: appsScriptData,
        auth_method: 'two-layer-secret-payload',
        response_processing: 'unexpected_format',
        two_layer_format: isTwoLayerFormat,
        version: appsScriptData?.version
      }
    };

    console.log('[RESPONSE PROCESSOR] 📤 Final unexpected format response:', {
      response: JSON.stringify(unexpectedResponse, null, 2),
      requestId,
      timestamp: new Date().toISOString()
    });

    return unexpectedResponse;
  }
}

function validateTwoLayerResponseFormat(response: any): { isValid: boolean; errors: string[] } {
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

  if (!('version' in response)) {
    errors.push('Missing version field (expected for two-layer format)');
  }

  if (response.status === 'success') {
    if (!response.data) {
      errors.push('Success response missing data field');
    } else {
      if (typeof response.data.attachments !== 'number') {
        errors.push('Success response data.attachments should be a number');
      }
      if (typeof response.data.processedEmails !== 'number') {
        errors.push('Success response data.processedEmails should be a number');
      }
      if (!response.data.authMethod) {
        errors.push('Success response missing data.authMethod (expected for two-layer format)');
      }
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
