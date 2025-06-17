
export function processAppsScriptResponse(
  appsScriptData: any,
  userEmail: string | null,
  requestId: string,
  totalDuration: number
): any {
  console.log('[RESPONSE PROCESSOR] 🔄 Starting Apps Script response processing:', {
    rawResponse: JSON.stringify(appsScriptData, null, 2),
    userEmail,
    requestId,
    totalDuration,
    timestamp: new Date().toISOString()
  });

  // Analyze response structure
  console.log('[RESPONSE PROCESSOR] 🔍 Response structure analysis:', {
    topLevelKeys: Object.keys(appsScriptData || {}),
    hasStatus: 'status' in (appsScriptData || {}),
    status: appsScriptData?.status,
    hasMessage: 'message' in (appsScriptData || {}),
    message: appsScriptData?.message,
    hasData: 'data' in (appsScriptData || {}),
    dataStructure: appsScriptData?.data ? {
      dataKeys: Object.keys(appsScriptData.data),
      attachments: appsScriptData.data.attachments,
      processedEmails: appsScriptData.data.processedEmails,
      emailsFound: appsScriptData.data.emailsFound
    } : null,
    hasError: 'error' in (appsScriptData || {}),
    error: appsScriptData?.error,
    requestId,
    timestamp: new Date().toISOString()
  });

  // Validate response format
  const validation = validateResponseFormat(appsScriptData);
  if (!validation.isValid) {
    console.error('[RESPONSE PROCESSOR] ❌ Response format validation failed:', {
      errors: validation.errors,
      response: appsScriptData,
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  // Process based on status
  if (appsScriptData?.status === 'success') {
    console.log('[RESPONSE PROCESSOR] ✅ Processing success response:', {
      dataAvailable: !!appsScriptData.data,
      attachments: appsScriptData.data?.attachments || 0,
      processedEmails: appsScriptData.data?.processedEmails || 0,
      emailsFound: appsScriptData.data?.emailsFound || 0,
      hasDebugInfo: !!appsScriptData.data?.debugInfo,
      requestId,
      timestamp: new Date().toISOString()
    });

    const processedResponse = {
      success: true,
      message: `Flow processed successfully using shared secret authentication`,
      request_id: requestId,
      auth_method: 'shared-secret',
      user_email: userEmail,
      performance_metrics: {
        total_duration: totalDuration
      },
      apps_script_response: appsScriptData,
      debug_info: {
        user_email: userEmail,
        auth_headers_received: true,
        response_processing: 'success'
      }
    };

    console.log('[RESPONSE PROCESSOR] 📤 Final success response:', {
      response: JSON.stringify(processedResponse, null, 2),
      requestId,
      timestamp: new Date().toISOString()
    });

    return processedResponse;

  } else if (appsScriptData?.status === 'error') {
    console.error('[RESPONSE PROCESSOR] ❌ Processing error response:', {
      errorMessage: appsScriptData.message,
      hasDetails: !!appsScriptData.details,
      details: appsScriptData.details,
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
        auth_method: 'shared-secret',
        response_processing: 'error'
      }
    };

    console.log('[RESPONSE PROCESSOR] 📤 Final error response:', {
      response: JSON.stringify(errorResponse, null, 2),
      requestId,
      timestamp: new Date().toISOString()
    });

    return errorResponse;

  } else {
    console.error('[RESPONSE PROCESSOR] ⚠️ Unexpected response format:', {
      status: appsScriptData?.status,
      unexpectedFormat: true,
      response: appsScriptData,
      requestId,
      timestamp: new Date().toISOString()
    });

    const unexpectedResponse = {
      error: 'Unexpected Apps Script response format',
      details: `Received status: ${appsScriptData?.status || 'undefined'}`,
      request_id: requestId,
      total_duration: totalDuration,
      debug_info: {
        user_email: userEmail,
        apps_script_response: appsScriptData,
        auth_method: 'shared-secret',
        response_processing: 'unexpected_format'
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

function validateResponseFormat(response: any): { isValid: boolean; errors: string[] } {
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
    } else {
      if (typeof response.data.attachments !== 'number') {
        errors.push('Success response data.attachments should be a number');
      }
      if (typeof response.data.processedEmails !== 'number') {
        errors.push('Success response data.processedEmails should be a number');
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
