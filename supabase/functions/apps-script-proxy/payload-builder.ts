
import { logNetworkEvent } from "../_shared/network-utils.ts"
import { RequestBody } from "./types.ts"

export function buildAppsScriptPayload(
  originalPayload: RequestBody,
  userEmail: string | null,
  scriptSecret: string,
  requestId: string
) {
  console.log('[PAYLOAD BUILDER] 🔧 Starting V.07 two-layer payload transformation:', {
    originalPayload: JSON.stringify(originalPayload, null, 2),
    userEmail: userEmail,
    hasSecret: !!scriptSecret,
    requestId: requestId,
    targetFormat: 'V.07-two-layer-secret-payload',
    timestamp: new Date().toISOString()
  });

  // Enhanced field extraction for V.07 compatibility
  console.log('[PAYLOAD BUILDER] 📋 Field extraction for V.07 two-layer format:', {
    originalSenders: originalPayload.userConfig?.senders,
    originalEmailFilter: originalPayload.userConfig?.emailFilter,
    extractedSenders: originalPayload.userConfig?.senders || originalPayload.userConfig?.emailFilter,
    originalDriveFolder: originalPayload.userConfig?.driveFolder,
    extractedDriveFolder: originalPayload.userConfig?.driveFolder,
    originalFileTypes: originalPayload.userConfig?.fileTypes,
    extractedFileTypes: originalPayload.userConfig?.fileTypes,
    originalFlowName: originalPayload.userConfig?.flowName,
    extractedFlowName: originalPayload.userConfig?.flowName,
    hasUserConfig: !!originalPayload.userConfig,
    userEmailForV07: userEmail,
    requestId: requestId
  });

  // Build V.07 compatible two-layer payload structure
  const twoLayerPayload = {
    secret: scriptSecret,
    payload: {
      action: originalPayload.action,
      userEmail: userEmail, // Critical for V.07: user email must be at payload level
      authenticatedUserEmail: userEmail, // V.07 backup field
      user_email: userEmail, // V.07 alternative field name
      userConfig: {
        senders: originalPayload.userConfig?.senders || originalPayload.userConfig?.emailFilter,
        emailFilter: originalPayload.userConfig?.senders || originalPayload.userConfig?.emailFilter, // V.07 backup
        driveFolder: originalPayload.userConfig?.driveFolder,
        fileTypes: originalPayload.userConfig?.fileTypes || ['pdf'],
        flowName: originalPayload.userConfig?.flowName,
        maxEmails: originalPayload.userConfig?.maxEmails || 10,
        enableDebugMode: originalPayload.userConfig?.enableDebugMode || true
      },
      debug_info: {
        request_id: requestId,
        has_user_email: !!userEmail,
        user_email_confirmed: userEmail,
        auth_method: 'V.07-two-layer-secret-payload',
        supabase_timestamp: new Date().toISOString(),
        timeout_config: 90000,
        version: 'V.07-FRONTEND-COMPATIBLE',
        email_validation: {
          provided: !!userEmail,
          value: userEmail || 'NOT_PROVIDED',
          multiple_fields: true
        }
      }
    }
  };

  console.log('[PAYLOAD BUILDER] ✅ V.07 two-layer payload transformation complete:', {
    twoLayerPayload: JSON.stringify(twoLayerPayload, null, 2),
    payloadSize: JSON.stringify(twoLayerPayload).length,
    hasSecret: !!twoLayerPayload.secret,
    hasPayload: !!twoLayerPayload.payload,
    innerAction: twoLayerPayload.payload?.action,
    innerUserEmail: twoLayerPayload.payload?.userEmail,
    alternativeEmailFields: {
      authenticatedUserEmail: twoLayerPayload.payload?.authenticatedUserEmail,
      user_email: twoLayerPayload.payload?.user_email
    },
    requestId: requestId,
    timestamp: new Date().toISOString()
  });

  // V.07 structure mapping validation
  console.log('[PAYLOAD BUILDER] 🔄 V.07 structure mapping validation:', {
    topLevel: {
      secret: 'V.07 Apps Script authentication secret',
      payload: 'Contains all business logic'
    },
    innerPayload: {
      action: twoLayerPayload.payload?.action,
      userEmail: twoLayerPayload.payload?.userEmail,
      authenticatedUserEmail: twoLayerPayload.payload?.authenticatedUserEmail,
      user_email: twoLayerPayload.payload?.user_email,
      userConfigKeys: Object.keys(twoLayerPayload.payload?.userConfig || {}),
      debugInfoKeys: Object.keys(twoLayerPayload.payload?.debug_info || {})
    },
    formatValidation: {
      hasRequiredTopLevel: !!(twoLayerPayload.secret && twoLayerPayload.payload),
      hasRequiredInnerLevel: !!(twoLayerPayload.payload?.action && twoLayerPayload.payload?.userEmail),
      structureValid: true,
      emailFieldsCount: [
        twoLayerPayload.payload?.userEmail,
        twoLayerPayload.payload?.authenticatedUserEmail,
        twoLayerPayload.payload?.user_email
      ].filter(Boolean).length
    },
    requestId: requestId
  });

  logNetworkEvent('PAYLOAD_BUILT_V07', {
    action: twoLayerPayload.payload?.action,
    userEmail: userEmail,
    flowName: twoLayerPayload.payload?.userConfig?.flowName,
    driveFolder: twoLayerPayload.payload?.userConfig?.driveFolder,
    hasMultipleEmailFields: true,
    version: 'V.07-two-layer-secret-payload',
    request_id: requestId
  });

  return twoLayerPayload;
}
