
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders, createCorsResponse, handleCorsPrelight } from "../_shared/cors.ts"

interface WebhookUpdate {
  type: string;
  status: string;
  message: string;
  timestamp: string;
  requestId: string;
  authenticatedUser: string | null;
  version: string;
  data: any;
}

serve(async (req) => {
  console.log('[WEBHOOK HANDLER] 📨 Received webhook request:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  if (req.method === 'OPTIONS') {
    console.log('[WEBHOOK HANDLER] 🔄 Handling CORS preflight request');
    return handleCorsPrelight();
  }

  try {
    if (req.method !== 'POST') {
      console.error('[WEBHOOK HANDLER] ❌ Invalid method:', req.method);
      return createCorsResponse({
        error: 'Method not allowed',
        expected: 'POST'
      }, 405);
    }

    const webhookData: WebhookUpdate = await req.json();
    
    console.log('[WEBHOOK HANDLER] 📋 Received webhook update:', {
      type: webhookData.type,
      status: webhookData.status,
      message: webhookData.message,
      requestId: webhookData.requestId,
      authenticatedUser: webhookData.authenticatedUser,
      hasData: !!webhookData.data,
      timestamp: webhookData.timestamp
    });

    // Validate webhook structure
    if (!webhookData.type || !webhookData.status || !webhookData.requestId) {
      console.error('[WEBHOOK HANDLER] ❌ Invalid webhook structure:', webhookData);
      return createCorsResponse({
        error: 'Invalid webhook structure',
        required: ['type', 'status', 'requestId']
      }, 400);
    }

    // Process different webhook types
    let response;
    switch (webhookData.type) {
      case 'status_update':
        response = await handleStatusUpdate(webhookData);
        break;
      default:
        console.warn('[WEBHOOK HANDLER] ⚠️ Unknown webhook type:', webhookData.type);
        response = { received: true, processed: false, reason: 'Unknown webhook type' };
    }

    console.log('[WEBHOOK HANDLER] ✅ Webhook processed successfully:', {
      requestId: webhookData.requestId,
      status: webhookData.status,
      processed: response.processed !== false
    });

    return createCorsResponse(response, 200);

  } catch (error) {
    console.error('[WEBHOOK HANDLER] 💥 Error processing webhook:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return createCorsResponse({
      error: 'Webhook processing failed',
      details: error.message
    }, 500);
  }
});

async function handleStatusUpdate(webhookData: WebhookUpdate) {
  console.log('[WEBHOOK HANDLER] 🔄 Processing status update:', {
    status: webhookData.status,
    requestId: webhookData.requestId,
    authenticatedUser: webhookData.authenticatedUser
  });

  // Here you could:
  // 1. Store webhook data in Supabase database
  // 2. Send real-time updates to frontend via WebSocket/SSE
  // 3. Trigger notifications
  // 4. Update flow status in database

  try {
    // For now, just log the webhook data
    // In a full implementation, you'd broadcast this to connected clients
    
    console.log('[WEBHOOK HANDLER] 📊 Webhook data details:', {
      message: webhookData.message,
      data: webhookData.data,
      timestamp: webhookData.timestamp
    });

    // Example: If you had a real-time connection system
    // await broadcastToClients(webhookData.requestId, webhookData);

    return {
      received: true,
      processed: true,
      requestId: webhookData.requestId,
      status: webhookData.status,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[WEBHOOK HANDLER] ❌ Status update processing failed:', error);
    return {
      received: true,
      processed: false,
      error: error.message,
      requestId: webhookData.requestId
    };
  }
}
