
import { RequestBody, AppsScriptPayload } from "./types.ts"

export function buildAppsScriptPayload(
  originalPayload: RequestBody,
  userEmail: string | null,
  appsScriptSecret: string,
  requestId: string
): AppsScriptPayload {
  return {
    auth_token: appsScriptSecret, // Simple shared secret authentication
    action: 'process_gmail_flow',
    userEmail: userEmail, // Pass user's email for personalized processing
    userConfig: {
      senders: originalPayload.userConfig?.senders || originalPayload.userConfig?.emailFilter,
      driveFolder: originalPayload.userConfig?.driveFolder || 'Email Attachments',
      fileTypes: originalPayload.userConfig?.fileTypes || ['pdf'],
      flowName: originalPayload.userConfig?.flowName || 'Default Flow',
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
}
