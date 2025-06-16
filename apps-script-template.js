
/**
 * Apps Script Web App Template for Gmail to Drive Flow
 * Updated for Body-Based Authentication (FIXED VERSION)
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Create a new Google Apps Script project
 * 2. Copy this code into the Code.gs file
 * 3. Enable Gmail API and Drive API in the Apps Script project
 * 4. Set your secret: PropertiesService.getScriptProperties().setProperty('APPS_SCRIPT_SECRET', 'your-secret-here')
 * 5. Deploy as a web app with:
 *    - Execute as: "Me" (your account)
 *    - Who has access: "Anyone"
 * 6. Copy the web app URL to your Supabase APPS_SCRIPT_URL secret
 */

function doPost(e) {
  // 1. Retrieve your secret from Script Properties
  const SCRIPT_SECRET = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET');
  
  try {
    console.log('📨 Received POST request');
    
    // 2. Parse the incoming request body
    if (!e.postData || !e.postData.contents) {
      console.error('❌ No post data received');
      return createErrorResponse('No request body received');
    }
    
    const requestData = JSON.parse(e.postData.contents);
    const receivedSecret = requestData.secret;
    const payload = requestData.payload;
    
    console.log('📋 Request parsed:', {
      hasSecret: !!receivedSecret,
      hasPayload: !!payload,
      action: payload?.action,
      flowId: payload?.flowId
    });
    
    // 3. AUTHENTICATION CHECK: This is the security gate
    if (!SCRIPT_SECRET) {
      console.error('❌ APPS_SCRIPT_SECRET not configured in Script Properties');
      return createErrorResponse('Server configuration error: Secret not configured');
    }
    
    if (receivedSecret !== SCRIPT_SECRET) {
      console.error('❌ Authentication failed: Invalid secret');
      return createErrorResponse('Unauthorized: Invalid authentication secret');
    }
    
    console.log('✅ Authentication successful');
    
    // --- AUTHENTICATION SUCCESSFUL ---
    
    // 4. Route to appropriate handler based on action
    if (payload.action === 'run_flow') {
      return processFlowExecution(payload);
    } else if (payload.action === 'process_gmail_flow') {
      return processGmailFlow(payload.userConfig, payload.googleTokens);
    } else {
      console.error('❌ Unknown action:', payload.action);
      return createErrorResponse('Unknown action: ' + payload.action);
    }
    
  } catch (error) {
    console.error('❌ Error in doPost:', error);
    return createErrorResponse('Internal server error: ' + error.toString());
  }
}

function processFlowExecution(payload) {
  try {
    console.log('🚀 Processing flow execution:', payload.flowId);
    
    // Extract Google OAuth token from payload
    const googleOAuthToken = payload.access_token;
    
    if (!googleOAuthToken) {
      console.error('❌ No Google OAuth token provided');
      return createErrorResponse('Google authentication required');
    }
    
    console.log('🔑 Google OAuth token received:', googleOAuthToken.substring(0, 20) + '...');
    
    // TODO: Implement your Gmail to Drive logic here
    // You can use the googleOAuthToken to make authenticated requests to Gmail and Drive APIs
    
    // For now, return a success response
    const result = {
      status: 'success',
      message: 'Flow executed successfully',
      data: {
        flowId: payload.flowId,
        timestamp: new Date().toISOString(),
        processedEmails: 0, // Update with actual count
        savedAttachments: 0, // Update with actual count
        authMethod: 'body-based'
      }
    };
    
    console.log('✅ Flow execution completed:', result);
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('❌ Error processing flow execution:', error);
    return createErrorResponse('Failed to execute flow: ' + error.toString());
  }
}

function processGmailFlow(userConfig, googleTokens) {
  try {
    console.log('📧 Processing Gmail flow for:', userConfig?.flowName);
    
    // Extract access token
    const accessToken = googleTokens?.access_token;
    
    if (!accessToken) {
      console.error('❌ No access token provided for Gmail/Drive access');
      return createErrorResponse('Google OAuth access token required');
    }
    
    // Search for emails using the user's filter
    const threads = GmailApp.search(userConfig.emailFilter, 0, 50);
    let processedCount = 0;
    let attachmentCount = 0;
    
    console.log(`📨 Found ${threads.length} email threads matching filter`);
    
    threads.forEach(thread => {
      const messages = thread.getMessages();
      
      messages.forEach(message => {
        const attachments = message.getAttachments();
        
        attachments.forEach(attachment => {
          // Check if file type should be processed
          if (shouldProcessFileType(attachment, userConfig.fileTypes)) {
            try {
              // Create file in Google Drive
              const fileName = `${userConfig.flowName}_${new Date().toISOString()}_${attachment.getName()}`;
              const folder = getOrCreateFolder(userConfig.driveFolder);
              
              const file = folder.createFile(attachment.copyBlob().setName(fileName));
              
              console.log(`💾 Saved attachment: ${fileName}`);
              attachmentCount++;
              
            } catch (attachmentError) {
              console.error('❌ Error processing attachment:', attachmentError);
            }
          }
        });
        
        processedCount++;
      });
    });
    
    const result = {
      status: 'success',
      message: `Processed ${processedCount} emails and saved ${attachmentCount} attachments`,
      data: {
        processedEmails: processedCount,
        savedAttachments: attachmentCount,
        flowName: userConfig.flowName,
        authMethod: 'body-based'
      }
    };
    
    console.log('✅ Gmail flow completed:', result);
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('❌ Error processing Gmail flow:', error);
    return createErrorResponse('Failed to process Gmail flow: ' + error.toString());
  }
}

function shouldProcessFileType(attachment, allowedTypes) {
  if (!allowedTypes || allowedTypes.length === 0) {
    return true; // Process all types if none specified
  }
  
  const fileName = attachment.getName().toLowerCase();
  const mimeType = attachment.getContentType().toLowerCase();
  
  return allowedTypes.some(type => {
    switch (type) {
      case 'pdf':
        return fileName.endsWith('.pdf') || mimeType.includes('pdf');
      case 'images':
        return mimeType.startsWith('image/');
      case 'documents':
        return mimeType.includes('document') || 
               mimeType.includes('text') || 
               fileName.match(/\.(doc|docx|txt|rtf)$/);
      default:
        return true;
    }
  });
}

function getOrCreateFolder(folderPath) {
  const pathParts = folderPath.split('/').filter(part => part.trim() !== '');
  let currentFolder = DriveApp.getRootFolder();
  
  pathParts.forEach(folderName => {
    const existingFolders = currentFolder.getFoldersByName(folderName);
    
    if (existingFolders.hasNext()) {
      currentFolder = existingFolders.next();
    } else {
      currentFolder = currentFolder.createFolder(folderName);
    }
  });
  
  return currentFolder;
}

function createErrorResponse(message) {
  const errorResponse = {
    status: 'error',
    message: message,
    timestamp: new Date().toISOString(),
    authMethod: 'body-based'
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(errorResponse))
    .setMimeType(ContentService.MimeType.JSON);
}

// Test function - you can run this to test your setup
function testFunction() {
  console.log('✅ Apps Script is working correctly with body-based authentication!');
  return 'Success';
}

/**
 * SETUP CHECKLIST FOR BODY-BASED AUTHENTICATION:
 * 
 * 1. ✅ Set your secret in Script Properties:
 *    PropertiesService.getScriptProperties().setProperty('APPS_SCRIPT_SECRET', 'your-secret-here')
 * 
 * 2. ✅ Deploy this script as a Web App with:
 *    - Execute as: "Me" (your account)
 *    - Who has access: "Anyone"
 * 
 * 3. ✅ Copy the Web App URL to your Supabase APPS_SCRIPT_URL secret
 * 
 * 4. ✅ Copy your secret to your Supabase APPS_SCRIPT_SECRET secret
 * 
 * 5. ✅ Test the deployment - the secret is now validated in the request body
 * 
 * 6. ✅ Enable Gmail API and Drive API in your Apps Script project
 * 
 * This method works around Apps Script's header limitations by sending authentication
 * data in the request body where Apps Script can reliably access it.
 */
