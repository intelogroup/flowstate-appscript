import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders, createCorsResponse, handleCorsPrelight } from "../_shared/cors.ts"
import { extractDebugInfo, logNetworkEvent, generateRequestId, createRetryableError } from "../_shared/network-utils.ts"

interface FlowConfig {
  senders?: string // V.06 compatible field
  emailFilter?: string // Legacy field for backward compatibility
  driveFolder: string
  fileTypes?: string[]
  userId?: string
  flowName?: string
  maxEmails?: number
  enableDebugMode?: boolean
  showEmailDetails?: boolean
}

interface RequestBody {
  action: string
  flowId?: string
  access_token?: string
  auth_token?: string
  userConfig?: FlowConfig
  googleTokens?: any
  debug_info?: any
}

// Enhanced timeout configuration
const TIMEOUT_CONFIG = {
  default: 60000,     // 60 seconds for normal operations
  gmail_flow: 90000,  // 90 seconds for Gmail processing
  simple: 30000       // 30 seconds for simple operations
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 2000,    // 2 seconds
  maxDelay: 10000     // 10 seconds max
}

async function callAppsScriptWithRetry(
  url: string, 
  payload: any, 
  debugInfo: any, 
  timeoutMs: number = TIMEOUT_CONFIG.default
): Promise<Response> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      logNetworkEvent('RETRY_ATTEMPT', {
        attempt,
        timeout: timeoutMs,
        request_id: debugInfo.request_id
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        logNetworkEvent('TIMEOUT_TRIGGERED', {
          attempt,
          timeout: timeoutMs,
          request_id: debugInfo.request_id
        });
        controller.abort();
      }, timeoutMs);

      const startTime = Date.now();
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Supabase-Edge-Function/3.1',
          'X-Request-ID': debugInfo.request_id,
          'X-Attempt': attempt.toString()
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      logNetworkEvent('REQUEST_SUCCESS', {
        attempt,
        duration,
        status: response.status,
        request_id: debugInfo.request_id
      });

      return response;

    } catch (error) {
      lastError = error;
      const duration = Date.now() - performance.now();
      
      logNetworkEvent('REQUEST_FAILED', {
        attempt,
        error: error.message,
        errorName: error.name,
        duration,
        request_id: debugInfo.request_id
      });

      // If it's an AbortError (timeout) and we have retries left
      if (error.name === 'AbortError' && attempt < RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1),
          RETRY_CONFIG.maxDelay
        );
        
        logNetworkEvent('RETRY_DELAY', {
          attempt,
          delay,
          nextAttempt: attempt + 1,
          request_id: debugInfo.request_id
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // For non-timeout errors or final attempt, throw immediately
      throw error;
    }
  }
  
  throw lastError;
}

function getTimeoutForOperation(action: string, userConfig?: FlowConfig): number {
  if (action === 'process_gmail_flow' || action === 'run_flow') {
    const emailCount = userConfig?.maxEmails || 5;
    // Dynamic timeout based on email count: 60s base + 10s per email (max 180s)
    return Math.min(
      TIMEOUT_CONFIG.gmail_flow + (emailCount * 10000),
      180000
    );
  }
  
  return TIMEOUT_CONFIG.default;
}

serve(async (req) => {
  const debugInfo = extractDebugInfo(req);
  const startTime = Date.now();
  logNetworkEvent('REQUEST_RECEIVED', debugInfo);

  // Enhanced CORS preflight handling
  if (req.method === 'OPTIONS') {
    logNetworkEvent('CORS_PREFLIGHT', { request_id: debugInfo.request_id });
    return handleCorsPrelight();
  }

  try {
    logNetworkEvent('FUNCTION_START', { request_id: debugInfo.request_id });

    // Get environment variables with enhanced error reporting
    const appsScriptUrl = Deno.env.get('APPS_SCRIPT_URL')
    const appsScriptSecret = Deno.env.get('APPS_SCRIPT_SECRET')

    if (!appsScriptUrl) {
      logNetworkEvent('CONFIG_ERROR', { 
        error: 'APPS_SCRIPT_URL missing', 
        request_id: debugInfo.request_id 
      });
      return createCorsResponse({
        error: 'Configuration error: APPS_SCRIPT_URL not set',
        request_id: debugInfo.request_id,
        troubleshooting: {
          message: 'Environment variable missing',
          steps: [
            '1. Set APPS_SCRIPT_URL in your Supabase Edge Function secrets',
            '2. Use your Apps Script web app deployment URL',
            '3. Format: https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
          ]
        }
      }, 500);
    }

    if (!appsScriptSecret) {
      logNetworkEvent('CONFIG_ERROR', { 
        error: 'APPS_SCRIPT_SECRET missing', 
        request_id: debugInfo.request_id 
      });
      return createCorsResponse({
        error: 'Configuration error: APPS_SCRIPT_SECRET not set',
        request_id: debugInfo.request_id,
        troubleshooting: {
          message: 'Secret token missing',
          steps: [
            '1. Generate a secret using Apps Script PropertiesService',
            '2. Store it as APPS_SCRIPT_SECRET in Supabase Edge Function secrets',
            '3. Use the same secret in your Apps Script code for validation'
          ]
        }
      }, 500);
    }

    // Enhanced request body parsing with improved empty body handling
    let originalPayload: RequestBody
    try {
      const bodyText = await req.text();
      logNetworkEvent('BODY_RECEIVED', { 
        size: bodyText.length, 
        preview: bodyText.substring(0, 100),
        request_id: debugInfo.request_id 
      });

      // Check for empty body specifically
      if (!bodyText || bodyText.trim().length === 0) {
        logNetworkEvent('EMPTY_BODY_ERROR', { 
          request_id: debugInfo.request_id,
          headers: Object.fromEntries(req.headers.entries())
        });
        return createCorsResponse({
          error: 'Empty request body received',
          request_id: debugInfo.request_id,
          troubleshooting: {
            message: 'No payload data was sent with the request',
            steps: [
              '1. Verify the frontend is sending a valid JSON payload',
              '2. Check if the request is being intercepted or modified',
              '3. Ensure the Content-Type header is set to application/json',
              '4. Try refreshing the page and attempting the request again'
            ]
          },
          debug_info: {
            method: req.method,
            url: req.url,
            headers: Object.fromEntries(req.headers.entries()),
            body_length: bodyText.length
          }
        }, 400);
      }

      if (bodyText.length > 1024 * 1024) { // 1MB limit
        throw createRetryableError('Request payload too large (>1MB)', false);
      }

      originalPayload = JSON.parse(bodyText);
      logNetworkEvent('PAYLOAD_PARSED', {
        action: originalPayload.action,
        flowId: originalPayload.flowId,
        hasAccessToken: !!originalPayload.access_token,
        hasAuthToken: !!originalPayload.auth_token,
        hasUserConfig: !!originalPayload.userConfig,
        hasGoogleTokens: !!originalPayload.googleTokens,
        flowName: originalPayload.userConfig?.flowName,
        maxEmails: originalPayload.userConfig?.maxEmails,
        request_id: debugInfo.request_id
      });
    } catch (error) {
      logNetworkEvent('PARSE_ERROR', { 
        error: error.message, 
        request_id: debugInfo.request_id 
      });
      return createCorsResponse({
        error: 'Invalid JSON in request body',
        details: error.message,
        request_id: debugInfo.request_id,
        troubleshooting: {
          message: 'The request body could not be parsed as valid JSON',
          steps: [
            '1. Check that the frontend is sending valid JSON data',
            '2. Verify there are no special characters breaking the JSON',
            '3. Try using a different browser or clearing cache',
            '4. Check the browser console for any errors'
          ]
        }
      }, 400);
    }

    // Validate required fields
    if (!originalPayload.action) {
      return createCorsResponse({
        error: 'Missing required field: action',
        received: Object.keys(originalPayload),
        request_id: debugInfo.request_id
      }, 400);
    }

    // Extract the Google OAuth token - it could be in auth_token, access_token, or googleTokens.access_token
    const googleOAuthToken = originalPayload.auth_token || 
                            originalPayload.access_token || 
                            originalPayload.googleTokens?.access_token;

    logNetworkEvent('TOKEN_EXTRACTION', {
      hasAuthToken: !!originalPayload.auth_token,
      hasAccessToken: !!originalPayload.access_token,
      hasGoogleTokensAccess: !!originalPayload.googleTokens?.access_token,
      selectedToken: googleOAuthToken?.substring(0, 20) + '...',
      tokenLength: googleOAuthToken?.length || 0,
      request_id: debugInfo.request_id
    });

    // Create proper Apps Script payload format with enhanced debugging
    let bodyForGas;
    
    if (originalPayload.action === 'process_gmail_flow') {
      // Direct process_gmail_flow action
      bodyForGas = {
        secret: appsScriptSecret,
        payload: {
          action: 'process_gmail_flow',
          userConfig: {
            ...originalPayload.userConfig,
            maxEmails: originalPayload.userConfig?.maxEmails || 5,
            enableDebugMode: true,
            showEmailDetails: true
          },
          // Send the Google OAuth token in the format Apps Script expects
          access_token: googleOAuthToken,
          auth_token: googleOAuthToken,
          googleTokens: {
            access_token: googleOAuthToken,
            refresh_token: originalPayload.googleTokens?.refresh_token || '',
            provider_token: googleOAuthToken
          },
          debug_info: {
            ...debugInfo,
            supabase_timestamp: new Date().toISOString(),
            auth_method: 'body-based-v6',
            timeout_config: getTimeoutForOperation(originalPayload.action, originalPayload.userConfig),
            request_source: 'edge-function-enhanced-debug',
            token_debug: {
              token_source: originalPayload.auth_token ? 'auth_token' : 
                           originalPayload.access_token ? 'access_token' : 'googleTokens.access_token',
              token_length: googleOAuthToken?.length || 0
            }
          }
        }
      };
    } else if (originalPayload.action === 'run_flow') {
      // Convert run_flow to the format Apps Script expects
      bodyForGas = {
        secret: appsScriptSecret,
        payload: {
          action: 'process_gmail_flow',
          userConfig: {
            ...originalPayload.userConfig,
            maxEmails: originalPayload.userConfig?.maxEmails || 5,
            enableDebugMode: true,
            showEmailDetails: true
          },
          // Send the Google OAuth token in the format Apps Script expects
          access_token: googleOAuthToken,
          auth_token: googleOAuthToken,
          googleTokens: {
            access_token: googleOAuthToken,
            refresh_token: originalPayload.googleTokens?.refresh_token || '',
            provider_token: googleOAuthToken
          },
          debug_info: {
            ...debugInfo,
            supabase_timestamp: new Date().toISOString(),
            auth_method: 'body-based-v6',
            timeout_config: getTimeoutForOperation('process_gmail_flow', originalPayload.userConfig),
            request_source: 'edge-function-enhanced-debug'
          }
        }
      };
    } else if (originalPayload.action === 'set_flow') {
      bodyForGas = {
        secret: appsScriptSecret,
        payload: {
          action: 'set_flow',
          userConfig: originalPayload.userConfig,
          debug_info: {
            ...debugInfo,
            supabase_timestamp: new Date().toISOString(),
            auth_method: 'body-based-v6'
          }
        }
      };
    } else {
      bodyForGas = {
        secret: appsScriptSecret,
        payload: {
          ...originalPayload,
          access_token: googleOAuthToken,
          auth_token: googleOAuthToken,
          debug_info: {
            ...debugInfo,
            supabase_timestamp: new Date().toISOString(),
            auth_method: 'body-based-v6'
          }
        }
      };
    }

    // Determine appropriate timeout
    const timeoutMs = getTimeoutForOperation(bodyForGas.payload.action, bodyForGas.payload.userConfig);

    logNetworkEvent('CALLING_APPS_SCRIPT', {
      url: appsScriptUrl,
      action: bodyForGas.payload.action,
      hasSecret: !!bodyForGas.secret,
      hasUserConfig: !!bodyForGas.payload.userConfig,
      hasAccessToken: !!bodyForGas.payload.access_token,
      hasAuthToken: !!bodyForGas.payload.auth_token,
      request_id: debugInfo.request_id,
      payload_size: JSON.stringify(bodyForGas).length,
      timeout: timeoutMs,
      maxEmails: bodyForGas.payload.userConfig?.maxEmails,
      debugMode: bodyForGas.payload.userConfig?.enableDebugMode,
      tokenDebug: {
        tokenLength: googleOAuthToken?.length || 0,
        tokenPreview: googleOAuthToken?.substring(0, 20) + '...' || 'none'
      }
    });

    // Call Apps Script with retry logic
    let response;
    try {
      response = await callAppsScriptWithRetry(appsScriptUrl, bodyForGas, debugInfo, timeoutMs);
    } catch (fetchError) {
      logNetworkEvent('FINAL_FETCH_ERROR', { 
        error: fetchError.message,
        name: fetchError.name,
        request_id: debugInfo.request_id,
        total_duration: Date.now() - startTime
      });
      
      if (fetchError.name === 'AbortError') {
        return createCorsResponse({
          error: `Apps Script request timeout (${timeoutMs/1000}s) after ${RETRY_CONFIG.maxRetries} attempts`,
          request_id: debugInfo.request_id,
          timeout_ms: timeoutMs,
          retries_attempted: RETRY_CONFIG.maxRetries,
          troubleshooting: {
            message: 'The request to Google Apps Script timed out after multiple attempts',
            steps: [
              '1. Your Gmail flow is processing too many emails at once',
              '2. Try reducing the maxEmails parameter in your flow configuration',
              '3. Check if your Apps Script deployment is responding normally',
              '4. Consider processing emails in smaller batches',
              '5. Verify the APPS_SCRIPT_URL is correct and accessible'
            ]
          },
          performance_hints: {
            current_timeout: `${timeoutMs/1000}s`,
            email_count: bodyForGas.payload.userConfig?.maxEmails || 'unknown',
            suggested_max_emails: Math.max(1, Math.floor((bodyForGas.payload.userConfig?.maxEmails || 5) / 2))
          }
        }, 504);
      }
      
      throw fetchError;
    }

    const totalDuration = Date.now() - startTime;
    logNetworkEvent('APPS_SCRIPT_RESPONSE', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      request_id: debugInfo.request_id,
      total_duration: totalDuration
    });

    if (!response.ok) {
      const responseText = await response.text();
      logNetworkEvent('APPS_SCRIPT_ERROR', {
        status: response.status,
        statusText: response.statusText,
        body: responseText.substring(0, 500),
        request_id: debugInfo.request_id,
        total_duration: totalDuration
      });

      const isHtmlResponse = responseText.trim().startsWith('<!DOCTYPE') || 
                           responseText.trim().startsWith('<html')

      return createCorsResponse({
        error: `Apps Script error (${response.status}): ${
          isHtmlResponse 
            ? 'Apps Script deployment access issue - check deployment settings' 
            : response.statusText || 'Unknown error'
        }`,
        request_id: debugInfo.request_id,
        apps_script_status: response.status,
        total_duration: totalDuration,
        troubleshooting: {
          message: isHtmlResponse 
            ? 'Apps Script deployment needs proper access settings'
            : 'Apps Script returned an error',
          steps: isHtmlResponse ? [
            '1. Go to your Apps Script project',
            '2. Click Deploy → Manage deployments', 
            '3. Click the gear icon to edit deployment settings',
            '4. Set "Execute as" to "Me" (your account)',
            '5. Set "Who has access" to "Anyone"',
            '6. Click Deploy and test the new URL'
          ] : [
            '1. Check Apps Script logs for detailed error information',
            '2. Verify the secret token matches between Supabase and Apps Script',
            '3. Ensure your Apps Script doPost function handles secret properly',
            '4. Check if the Google OAuth token format is correct',
            '5. Verify the token has the required Gmail and Drive scopes'
          ]
        },
        apps_script_url: appsScriptUrl,
        error_details: responseText.substring(0, 200),
        auth_method: 'body-based-v6',
        token_info: {
          has_token: !!googleOAuthToken,
          token_length: googleOAuthToken?.length || 0,
          token_source: originalPayload.auth_token ? 'auth_token' : 
                       originalPayload.access_token ? 'access_token' : 'googleTokens'
        }
      }, 502);
    }

    // Parse Apps Script response with enhanced error handling
    let appsScriptData
    try {
      const responseText = await response.text();
      appsScriptData = JSON.parse(responseText);
      
      logNetworkEvent('SUCCESS', {
        status: appsScriptData.status,
        message: appsScriptData.message,
        dataKeys: Object.keys(appsScriptData.data || {}),
        attachments: appsScriptData.data?.attachments || appsScriptData.data?.savedAttachments || 0,
        emailsFound: appsScriptData.data?.emailsFound || 0,
        emailsProcessed: appsScriptData.data?.processedEmails || 0,
        debugInfo: appsScriptData.data?.debugInfo || {},
        request_id: debugInfo.request_id,
        total_duration: totalDuration,
        performance_metrics: {
          edge_function_duration: totalDuration,
          apps_script_processing: appsScriptData.data?.processing_time || 'unknown'
        }
      });
    } catch (error) {
      logNetworkEvent('RESPONSE_PARSE_ERROR', { 
        error: error.message, 
        request_id: debugInfo.request_id,
        total_duration: totalDuration
      });
      return createCorsResponse({
        error: 'Apps Script returned invalid JSON',
        details: error.message,
        request_id: debugInfo.request_id,
        total_duration: totalDuration
      }, 502);
    }

    // Return successful response with enhanced metadata and debugging info
    return createCorsResponse({
      success: true,
      message: 'Flow processed successfully',
      timestamp: new Date().toISOString(),
      request_id: debugInfo.request_id,
      auth_method: 'body-based-v6',
      performance_metrics: {
        total_duration: totalDuration,
        timeout_used: timeoutMs,
        retries_available: RETRY_CONFIG.maxRetries
      },
      debug_info: debugInfo,
      apps_script_response: appsScriptData
    }, 200);

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    logNetworkEvent('EDGE_FUNCTION_ERROR', { 
      error: error.message,
      name: error.constructor.name,
      stack: error.stack?.substring(0, 500),
      request_id: debugInfo.request_id,
      total_duration: totalDuration
    });
    
    return createCorsResponse({
      error: 'Edge Function internal error',
      message: error.message,
      timestamp: new Date().toISOString(),
      request_id: debugInfo.request_id,
      total_duration: totalDuration,
      retryable: (error as any).retryable !== false
    }, 500);
  }
})
