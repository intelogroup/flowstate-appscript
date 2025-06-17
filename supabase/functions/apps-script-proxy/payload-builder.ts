
import { RequestBody, AppsScriptPayload } from "./types.ts"

export function buildAppsScriptPayload(
  originalPayload: RequestBody,
  userEmail: string | null,
  appsScriptSecret: string,
  requestId: string
): any { // Changed return type to support two-layer structure
  console.log('[PAYLOAD BUILDER] 🔧 Starting two-layer payload transformation:', {
    originalPayload: JSON.stringify(originalPayload, null, 2),
    userEmail,
    hasSecret: !!appsScriptSecret,
    requestId,
    targetFormat: 'two-layer-secret-payload',
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

  // Extract and validate fields for inner payload
  const senders = originalPayload.userConfig?.senders || originalPayload.userConfig?.emailFilter;
  const driveFolder = originalPayload.userConfig?.driveFolder || 'Email Attachments';
  const fileTypes = originalPayload.userConfig?.fileTypes || ['pdf'];
  const flowName = originalPayload.userConfig?.flowName || 'Default Flow';

  console.log('[PAYLOAD BUILDER] 📋 Field extraction for two-layer format:', {
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

  // Create the inner payload structure
  const innerPayload = {
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
      auth_method: 'two-layer-secret-payload',
      supabase_timestamp: new Date().toISOString(),
      timeout_config: 90000
    }
  };

  // Create the two-layer structure (secret + payload)
  const twoLayerPayload = {
    secret: appsScriptSecret,
    payload: innerPayload
  };

  // Validate two-layer structure
  const twoLayerValidation = validateTwoLayerPayload(twoLayerPayload);
  if (!twoLayerValidation.isValid) {
    console.error('[PAYLOAD BUILDER] ❌ Two-layer payload validation failed:', {
      errors: twoLayerValidation.errors,
      twoLayerPayload,
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  console.log('[PAYLOAD BUILDER] ✅ Two-layer payload transformation complete:', {
    twoLayerPayload: JSON.stringify(twoLayerPayload, null, 2),
    payloadSize: JSON.stringify(twoLayerPayload).length,
    hasSecret: !!twoLayerPayload.secret,
    hasPayload: !!twoLayerPayload.payload,
    innerAction: twoLayerPayload.payload?.action,
    innerUserEmail: twoLayerPayload.payload?.userEmail,
    requestId,
    timestamp: new Date().toISOString()
  });

  // Log structural comparison for debugging
  console.log('[PAYLOAD BUILDER] 🔄 Two-layer structure mapping:', {
    topLevel: {
      secret: 'Apps Script authentication secret',
      payload: 'Contains all business logic'
    },
    innerPayload: {
      action: twoLayerPayload.payload.action,
      userEmail: twoLayerPayload.payload.userEmail,
      userConfigKeys: Object.keys(twoLayerPayload.payload.userConfig),
      debugInfoKeys: Object.keys(twoLayerPayload.payload.debug_info)
    },
    formatValidation: {
      hasRequiredTopLevel: !!(twoLayerPayload.secret && twoLayerPayload.payload),
      hasRequiredInnerLevel: !!(twoLayerPayload.payload.action && twoLayerPayload.payload.userConfig),
      structureValid: twoLayerValidation.isValid
    },
    requestId
  });

  return twoLayerPayload;
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

function validateTwoLayerPayload(payload: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Top-level validation
  if (!payload.secret) errors.push('Missing top-level secret');
  if (!payload.payload) errors.push('Missing top-level payload');
  
  // Inner payload validation
  if (payload.payload) {
    if (!payload.payload.action) errors.push('Missing payload.action');
    if (!payload.payload.userConfig) errors.push('Missing payload.userConfig');
    if (!payload.payload.userConfig?.driveFolder) errors.push('Missing payload.userConfig.driveFolder');
    if (!payload.payload.userConfig?.flowName) errors.push('Missing payload.userConfig.flowName');
    if (!payload.payload.debug_info) errors.push('Missing payload.debug_info');
    if (!payload.payload.debug_info?.request_id) errors.push('Missing payload.debug_info.request_id');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
