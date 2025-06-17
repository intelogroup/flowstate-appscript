/**
 * Apps Script Web App Template for Gmail to Drive Flow
 * TWO-LAYER AUTHENTICATION VERSION (secret + payload structure)
 * V.06 FRONTEND-COMPATIBLE
 */

function doPost(e) {
  const startTime = Date.now();
  
  try {
    console.log('📨 Received POST request - V.06 Two-Layer Format');
    
    if (!e.postData || !e.postData.contents) {
      console.error('❌ No post data received');
      return createFrontendResponse('error', 'No request body received');
    }
    
    let requestData;
    try {
      requestData = JSON.parse(e.postData.contents);
      console.log('📋 Raw request parsed:', {
        hasSecret: !!requestData.secret,
        hasPayload: !!requestData.payload,
        topLevelKeys: Object.keys(requestData || {}),
        payloadKeys: requestData.payload ? Object.keys(requestData.payload) : []
      });
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError);
      return createFrontendResponse('error', 'Invalid JSON in request body');
    }
    
    // Validate two-layer structure
    if (!requestData.secret) {
      console.error('❌ Missing secret in top-level structure');
      return createFrontendResponse('error', 'Authentication failed: Missing secret in top-level structure');
    }
    
    if (!requestData.payload) {
      console.error('❌ Missing payload in top-level structure');
      return createFrontendResponse('error', 'Missing payload in top-level structure');
    }
    
    // Extract authentication and payload layers
    const receivedSecret = requestData.secret;
    const payload = requestData.payload;
    const SCRIPT_SECRET = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET');
    
    console.log('🔐 Two-layer authentication check:', {
      hasReceivedSecret: !!receivedSecret,
      hasStoredSecret: !!SCRIPT_SECRET,
      secretLengths: {
        received: receivedSecret?.length || 0,
        stored: SCRIPT_SECRET?.length || 0
      },
      payloadAction: payload?.action,
      payloadUserConfig: !!payload?.userConfig
    });
    
    // Enhanced authentication checking
    if (!SCRIPT_SECRET) {
      console.error('❌ APPS_SCRIPT_SECRET not configured in Apps Script properties');
      return createFrontendResponse('error', 'Server configuration error: Missing secret. Please configure APPS_SCRIPT_SECRET in Apps Script Properties.');
    }
    
    if (receivedSecret !== SCRIPT_SECRET) {
      console.error('❌ Authentication failed: Invalid secret in two-layer structure');
      console.log('🔍 Secret comparison details:', {
        receivedLength: receivedSecret?.length || 0,
        expectedLength: SCRIPT_SECRET?.length || 0,
        match: receivedSecret === SCRIPT_SECRET,
        receivedPreview: receivedSecret ? receivedSecret.substring(0, 10) + '...' : 'None',
        expectedPreview: SCRIPT_SECRET ? SCRIPT_SECRET.substring(0, 10) + '...' : 'None'
      });
      return createFrontendResponse('error', 'Authentication failed: Invalid secret token');
    }
    
    console.log('✅ Two-layer authentication successful');
    
    // Validate payload structure
    if (!payload.action) {
      console.error('❌ Missing action in payload');
      return createFrontendResponse('error', 'Missing action in payload');
    }
    
    console.log('📧 Processing payload with action:', {
      action: payload.action,
      hasUserConfig: !!payload.userConfig,
      hasUserEmail: !!payload.userEmail,
      hasDebugInfo: !!payload.debug_info,
      userConfigKeys: payload.userConfig ? Object.keys(payload.userConfig) : []
    });
    
    // Handle different actions from payload
    if (payload.action === 'process_gmail_flow') {
      return handleGmailFlowFrontendCompatible(payload, startTime);
    } else if (payload.action === 'health_check') {
      return createFrontendResponse('success', 'Apps Script is healthy and ready', {
        version: 'V.06-FRONTEND-COMPATIBLE-TWO-LAYER',
        timestamp: new Date().toISOString(),
        auth_method: 'two-layer-secret-payload',
        processing_time: Date.now() - startTime
      });
    } else {
      console.error('❌ Unknown action in payload:', payload.action);
      return createFrontendResponse('error', 'Unknown action: ' + payload.action);
    }
    
  } catch (error) {
    console.error('❌ Error in doPost:', error);
    return createFrontendResponse('error', 'Internal server error: ' + error.toString());
  }
}

function handleGmailFlowFrontendCompatible(payload, startTime) {
  try {
    console.log('📧 Processing Gmail flow with two-layer payload structure');
    console.log('📧 Payload details:', {
      userConfig: payload.userConfig,
      userEmail: payload.userEmail,
      debugInfo: payload.debug_info
    });
    
    // Enhanced validation for payload structure
    if (!payload.userConfig) {
      console.error('❌ No user config in payload');
      return createFrontendResponse('error', 'User configuration is required in payload');
    }
    
    if (!payload.userConfig.driveFolder) {
      console.error('❌ No drive folder in payload userConfig');
      return createFrontendResponse('error', 'Drive folder is required in payload userConfig');
    }
    
    if (!payload.userConfig.flowName) {
      console.error('❌ No flow name in payload userConfig');
      return createFrontendResponse('error', 'Flow name is required in payload userConfig');
    }
    
    // Build Gmail search query using payload data
    let searchQuery = buildSearchQuery(payload.userConfig, payload.userEmail);
    
    console.log('🔍 Gmail search query from payload:', searchQuery);
    
    // Search for emails with enhanced error handling
    let threads;
    try {
      threads = GmailApp.search(searchQuery, 0, payload.userConfig.maxEmails || 10);
    } catch (gmailError) {
      console.error('❌ Gmail search failed:', gmailError);
      return createFrontendResponse('error', 'Gmail search failed: ' + gmailError.toString());
    }
    
    let processedCount = 0;
    let attachmentCount = 0;
    let emailsFound = threads.length;
    let processedAttachments = [];
    
    console.log(`📨 Found ${emailsFound} email threads from payload search`);
    
    if (emailsFound === 0) {
      return createFrontendResponse('success', 'No emails found matching the search criteria', {
        processedEmails: 0,
        savedAttachments: 0,
        emailsFound: 0,
        attachments: 0,
        flowName: payload.userConfig.flowName,
        userEmail: payload.userEmail,
        searchQuery: searchQuery,
        debugInfo: {
          userEmail: payload.userEmail,
          searchQuery: searchQuery,
          emailsFound: 0,
          processedEmails: 0,
          savedAttachments: 0,
          payloadProcessing: 'two-layer-format'
        },
        processing_time: Date.now() - startTime
      });
    }
    
    // Process emails and attachments
    threads.forEach((thread, threadIndex) => {
      try {
        const messages = thread.getMessages();
        console.log(`📧 Thread ${threadIndex + 1}: ${messages.length} messages`);
        
        messages.forEach((message, messageIndex) => {
          try {
            const attachments = message.getAttachments();
            console.log(`📎 Message ${messageIndex + 1}: ${attachments.length} attachments`);
            
            attachments.forEach((attachment, attachmentIndex) => {
              try {
                if (shouldProcessFileType(attachment, payload.userConfig.fileTypes)) {
                  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                  const fileName = `${payload.userConfig.flowName}_${timestamp}_${attachment.getName()}`;
                  
                  const folder = getOrCreateFolder(payload.userConfig.driveFolder);
                  const file = folder.createFile(attachment.copyBlob().setName(fileName));
                  
                  processedAttachments.push({
                    originalName: attachment.getName(),
                    savedName: fileName,
                    size: attachment.getSize(),
                    type: attachment.getContentType(),
                    fileId: file.getId(),
                    fileUrl: file.getUrl()
                  });
                  
                  console.log(`💾 Saved attachment ${attachmentIndex + 1}: ${fileName}`);
                  attachmentCount++;
                } else {
                  console.log(`⏭️ Skipped attachment ${attachmentIndex + 1}: ${attachment.getName()} (file type not allowed)`);
                }
              } catch (attachmentError) {
                console.error(`❌ Error processing attachment ${attachmentIndex + 1}:`, attachmentError);
              }
            });
            
            processedCount++;
          } catch (messageError) {
            console.error(`❌ Error processing message ${messageIndex + 1}:`, messageError);
          }
        });
      } catch (threadError) {
        console.error(`❌ Error processing thread ${threadIndex + 1}:`, threadError);
      }
    });
    
    const result = {
      processedEmails: processedCount,
      savedAttachments: attachmentCount,
      emailsFound: emailsFound,
      attachments: attachmentCount,
      flowName: payload.userConfig.flowName,
      userEmail: payload.userEmail,
      authMethod: 'two-layer-secret-payload',
      searchQuery: searchQuery,
      processedAttachments: processedAttachments,
      debugInfo: {
        userEmail: payload.userEmail,
        searchQuery: searchQuery,
        emailsFound: emailsFound,
        processedEmails: processedCount,
        savedAttachments: attachmentCount,
        driveFolder: payload.userConfig.driveFolder,
        allowedFileTypes: payload.userConfig.fileTypes,
        payloadProcessing: 'two-layer-format',
        requestId: payload.debug_info?.request_id || 'unknown'
      },
      processing_time: Date.now() - startTime
    };
    
    console.log('✅ Gmail flow completed successfully with two-layer format:', {
      processedEmails: result.processedEmails,
      savedAttachments: result.savedAttachments,
      emailsFound: result.emailsFound,
      authMethod: result.authMethod
    });
    
    return createFrontendResponse('success', `Processed ${processedCount} emails and saved ${attachmentCount} attachments for ${payload.userEmail}`, result);
      
  } catch (error) {
    console.error('❌ Error processing Gmail flow with two-layer payload:', error);
    return createFrontendResponse('error', 'Failed to process Gmail flow: ' + error.toString());
  }
}

function buildSearchQuery(userConfig, userEmail) {
  let searchQuery = '';
  
  console.log('🔧 Building search query with:', {
    senders: userConfig.senders,
    userEmail: userEmail
  });
  
  // Start with the senders configuration
  if (userConfig.senders && userConfig.senders.trim()) {
    const senders = userConfig.senders.split(',').map(s => s.trim()).filter(s => s);
    console.log('📧 Using configured senders:', senders);
    
    if (senders.length === 1) {
      searchQuery = `from:${senders[0]}`;
    } else if (senders.length > 1) {
      searchQuery = `(${senders.map(s => `from:${s}`).join(' OR ')})`;
    }
  } else if (userEmail) {
    // If no specific senders configured, use the user's own email
    console.log('🔧 No senders specified, using user email for filtering');
    searchQuery = `from:${userEmail}`;
  }
  
  // Add attachment filter and recent emails
  if (searchQuery) {
    searchQuery += ' has:attachment newer_than:7d';
  } else {
    searchQuery = 'has:attachment newer_than:7d';
  }
  
  console.log('🔍 Final search query:', searchQuery);
  return searchQuery;
}

function shouldProcessFileType(attachment, allowedTypes) {
  if (!allowedTypes || allowedTypes.length === 0) {
    console.log('📎 No file type restrictions, processing all attachments');
    return true;
  }
  
  const fileName = attachment.getName().toLowerCase();
  const mimeType = attachment.getContentType().toLowerCase();
  
  console.log('📎 Checking file type:', {
    fileName: fileName,
    mimeType: mimeType,
    allowedTypes: allowedTypes
  });
  
  const shouldProcess = allowedTypes.some(type => {
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
  
  console.log('📎 File type check result:', shouldProcess);
  return shouldProcess;
}

function getOrCreateFolder(folderPath) {
  console.log('📁 Getting or creating folder:', folderPath);
  
  const pathParts = folderPath.split('/').filter(part => part.trim() !== '');
  let currentFolder = DriveApp.getRootFolder();
  
  pathParts.forEach(folderName => {
    const existingFolders = currentFolder.getFoldersByName(folderName);
    
    if (existingFolders.hasNext()) {
      currentFolder = existingFolders.next();
      console.log('📁 Found existing folder:', folderName);
    } else {
      currentFolder = currentFolder.createFolder(folderName);
      console.log('📁 Created new folder:', folderName);
    }
  });
  
  console.log('📁 Final folder ID:', currentFolder.getId());
  return currentFolder;
}

function createFrontendResponse(status, message, data = null) {
  const response = {
    status: status,
    message: message,
    timestamp: new Date().toISOString(),
    version: 'V.06-FRONTEND-COMPATIBLE-TWO-LAYER'
  };
  
  if (data) {
    response.data = data;
  }
  
  console.log('📤 Creating frontend response:', {
    status: response.status,
    hasData: !!data,
    version: response.version,
    messageLength: message?.length || 0
  });
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function createSuccessResponse(data) {
  const response = {
    status: 'success',
    data: data,
    timestamp: new Date().toISOString()
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(message) {
  const errorResponse = {
    status: 'error',
    message: message,
    timestamp: new Date().toISOString()
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(errorResponse))
    .setMimeType(ContentService.MimeType.JSON);
}

// Test function for manual testing
function testFunction() {
  console.log('✅ Apps Script is working correctly with shared secret authentication!');
  console.log('🔧 Testing configuration...');
  
  const secret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET');
  console.log('🔑 Secret configured:', !!secret, 'Length:', secret?.length || 0);
  
  return 'Test successful - Apps Script is ready!';
}

// Health check function for external monitoring
function healthCheck() {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET');
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      hasSecret: !!secret,
      version: 'shared-secret-v2'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}
