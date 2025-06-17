
import { RequestBody, AppsScriptPayload } from "./types.ts"

export function buildAppsScriptPayload(
  originalPayload: RequestBody,
  userEmail: string | null,
  appsScriptSecret: string,
  requestId: string
): AppsScriptPayload {
  console.log('[PAYLOAD BUILDER] 🔧 Starting payload transformation:', {
    originalPayload: JSON.stringify(originalPayload, null, 2),
    userEmail,
    hasSecret: !!appsScriptSecret,
    requestId,
    timestamp: new Date().toISOString()
  });

  // Validate original payload structure
  const validation = validateOriginalPayload(originalPayload);
  if (!validation.isValid) {
    console.error('[PAYLOAD BUILDER] ❌ Original payload validation failed:', {
      errors: validation.errors,
      originalPayload,
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  // Extract and validate fields
  const senders = originalPayload.userConfig?.senders || originalPayload.userConfig?.emailFilter;
  const driveFolder = originalPayload.userConfig?.driveFolder || 'Email Attachments';
  const fileTypes = originalPayload.userConfig?.fileTypes || ['pdf'];
  const flowName = originalPayload.userConfig?.flowName || 'Default Flow';

  console.log('[PAYLOAD BUILDER] 📋 Field extraction details:', {
    originalSenders: originalPayload.userConfig?.senders,
    originalEmailFilter: originalPayload.userConfig?.emailFilter,
    extractedSenders: senders,
    originalDriveFolder: originalPayload.userConfig?.driveFolder,
    extractedDriveFolder: driveFolder,
    originalFileTypes: originalPayload.userConfig?.fileTypes,
    extractedFileTypes: fileTypes,
    originalFlowName: originalPayload.userConfig?.flowName,
    extractedFlowName: flowName,
    hasUserConfig: !!originalPayload.userConfig,
    requestId
  });

  const transformedPayload: AppsScriptPayload = {
    auth_token: appsScriptSecret,
    action: 'process_gmail_flow',
    userEmail: userEmail,
    userConfig: {
      senders: senders,
      driveFolder: driveFolder,
      fileTypes: fileTypes,
      flowName: flowName,
      maxEmails: 10,
      enableDebugMode: true
    },
    debug_info: {
      request_id: requestId,
      has_user_email: !!userEmail,
      auth_method: 'shared-secret',
      timestamp: new Date().toISOString()
    }
  };

  // Validate transformed payload
  const transformedValidation = validateTransformedPayload(transformedPayload);
  if (!transformedValidation.isValid) {
    console.error('[PAYLOAD BUILDER] ❌ Transformed payload validation failed:', {
      errors: transformedValidation.errors,
      transformedPayload,
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  console.log('[PAYLOAD BUILDER] ✅ Payload transformation complete:', {
    transformedPayload: JSON.stringify(transformedPayload, null, 2),
    payloadSize: JSON.stringify(transformedPayload).length,
    hasAllRequiredFields: !!(transformedPayload.auth_token && transformedPayload.action && transformedPayload.userConfig),
    requestId,
    timestamp: new Date().toISOString()
  });

  // Log field mapping details
  console.log('[PAYLOAD BUILDER] 🔄 Field mapping summary:', {
    mapping: {
      'originalPayload.action': `${originalPayload.action} → ${transformedPayload.action}`,
      'originalPayload.userConfig.senders': `${originalPayload.userConfig?.senders} → ${transformedPayload.userConfig.senders}`,
      'originalPayload.userConfig.emailFilter': `${originalPayload.userConfig?.emailFilter} → ${transformedPayload.userConfig.senders}`,
      'originalPayload.userConfig.driveFolder': `${originalPayload.userConfig?.driveFolder} → ${transformedPayload.userConfig.driveFolder}`,
      'originalPayload.userConfig.flowName': `${originalPayload.userConfig?.flowName} → ${transformedPayload.userConfig.flowName}`,
      'userEmail': `${userEmail} → ${transformedPayload.userEmail}`
    },
    requestId
  });

  return transformedPayload;
}

function validateOriginalPayload(payload: RequestBody): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!payload.action) errors.push('Missing action field');
  if (!payload.user_id) errors.push('Missing user_id field');
  if (!payload.userConfig) errors.push('Missing userConfig field');
  if (payload.userConfig && !payload.userConfig.driveFolder) errors.push('Missing userConfig.driveFolder');
  if (payload.userConfig && !payload.userConfig.flowName) errors.push('Missing userConfig.flowName');
  if (payload.userConfig && !payload.userConfig.senders && !payload.userConfig.emailFilter) {
    errors.push('Missing both userConfig.senders and userConfig.emailFilter');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function validateTransformedPayload(payload: AppsScriptPayload): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!payload.auth_token) errors.push('Missing auth_token');
  if (!payload.action) errors.push('Missing action');
  if (!payload.userConfig) errors.push('Missing userConfig');
  if (!payload.userConfig.driveFolder) errors.push('Missing userConfig.driveFolder');
  if (!payload.userConfig.flowName) errors.push('Missing userConfig.flowName');
  if (!payload.debug_info) errors.push('Missing debug_info');
  if (!payload.debug_info.request_id) errors.push('Missing debug_info.request_id');

  return {
    isValid: errors.length === 0,
    errors
  };
}
