
/**
 * Apps Script Web App Template for Gmail to Drive Flow
 * SHARED SECRET AUTHENTICATION VERSION WITH ENHANCED TESTING
 */

function doPost(e) {
  const SCRIPT_SECRET = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET');
  
  try {
    console.log('📨 Received POST request');
    
    if (!e.postData || !e.postData.contents) {
      console.error('❌ No post data received');
      return createErrorResponse('No request body received');
    }
    
    const requestData = JSON.parse(e.postData.contents);
    const receivedSecret = requestData.auth_token;
    const userEmail = requestData.userEmail;
    const userConfig = requestData.userConfig;
    
    console.log('📋 Request parsed:', {
      hasSecret: !!receivedSecret,
      hasUserEmail: !!userEmail,
      action: requestData.action,
      flowName: userConfig?.flowName,
      driveFolder: userConfig?.driveFolder,
      senders: userConfig?.senders
    });
    
    // Enhanced authentication checking
    if (!SCRIPT_SECRET) {
      console.error('❌ APPS_SCRIPT_SECRET not configured in Apps Script properties');
      return createErrorResponse('Server configuration error: Missing secret. Please configure APPS_SCRIPT_SECRET in Apps Script Properties.');
    }
    
    if (!receivedSecret) {
      console.error('❌ No auth token provided in request');
      return createErrorResponse('Authentication failed: No auth token provided');
    }
    
    if (receivedSecret !== SCRIPT_SECRET) {
      console.error('❌ Authentication failed: Invalid secret');
      console.log('🔍 Secret comparison:', {
        receivedLength: receivedSecret?.length || 0,
        expectedLength: SCRIPT_SECRET?.length || 0,
        match: receivedSecret === SCRIPT_SECRET
      });
      return createErrorResponse('Authentication failed: Invalid secret token');
    }
    
    console.log('✅ Authentication successful with shared secret');
    
    // Handle different actions
    if (requestData.action === 'process_gmail_flow') {
      return processGmailFlowWithUserEmail(userConfig, userEmail);
    } else if (requestData.action === 'health_check') {
      return createSuccessResponse({
        message: 'Apps Script is healthy and ready',
        timestamp: new Date().toISOString(),
        version: 'shared-secret-v2'
      });
    } else {
      console.error('❌ Unknown action:', requestData.action);
      return createErrorResponse('Unknown action: ' + requestData.action);
    }
    
  } catch (error) {
    console.error('❌ Error in doPost:', error);
    return createErrorResponse('Internal server error: ' + error.toString());
  }
}

function processGmailFlowWithUserEmail(userConfig, userEmail) {
  try {
    console.log('📧 Processing Gmail flow with enhanced validation');
    console.log('📧 User config:', {
      senders: userConfig?.senders,
      driveFolder: userConfig?.driveFolder,
      flowName: userConfig?.flowName,
      fileTypes: userConfig?.fileTypes,
      maxEmails: userConfig?.maxEmails
    });
    console.log('📧 User email:', userEmail);
    
    // Enhanced validation
    if (!userConfig) {
      console.error('❌ No user config provided');
      return createErrorResponse('User configuration is required');
    }
    
    if (!userConfig.driveFolder) {
      console.error('❌ No drive folder specified');
      return createErrorResponse('Drive folder is required');
    }
    
    if (!userConfig.flowName) {
      console.error('❌ No flow name specified');
      return createErrorResponse('Flow name is required');
    }
    
    // Build Gmail search query using the user's email and configuration
    let searchQuery = buildSearchQuery(userConfig, userEmail);
    
    console.log('🔍 Gmail search query:', searchQuery);
    
    // Search for emails with enhanced error handling
    let threads;
    try {
      threads = GmailApp.search(searchQuery, 0, userConfig.maxEmails || 10);
    } catch (gmailError) {
      console.error('❌ Gmail search failed:', gmailError);
      return createErrorResponse('Gmail search failed: ' + gmailError.toString());
    }
    
    let processedCount = 0;
    let attachmentCount = 0;
    let emailsFound = threads.length;
    let processedAttachments = [];
    
    console.log(`📨 Found ${emailsFound} email threads`);
    
    if (emailsFound === 0) {
      return createSuccessResponse({
        processedEmails: 0,
        savedAttachments: 0,
        emailsFound: 0,
        attachments: 0,
        flowName: userConfig.flowName,
        userEmail: userEmail,
        searchQuery: searchQuery,
        message: 'No emails found matching the search criteria',
        debugInfo: {
          userEmail: userEmail,
          searchQuery: searchQuery,
          emailsFound: 0,
          processedEmails: 0,
          savedAttachments: 0
        }
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
                if (shouldProcessFileType(attachment, userConfig.fileTypes)) {
                  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                  const fileName = `${userConfig.flowName}_${timestamp}_${attachment.getName()}`;
                  
                  const folder = getOrCreateFolder(userConfig.driveFolder);
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
      flowName: userConfig.flowName,
      userEmail: userEmail,
      authMethod: 'shared-secret',
      searchQuery: searchQuery,
      processedAttachments: processedAttachments,
      message: `Processed ${processedCount} emails and saved ${attachmentCount} attachments for ${userEmail}`,
      debugInfo: {
        userEmail: userEmail,
        searchQuery: searchQuery,
        emailsFound: emailsFound,
        processedEmails: processedCount,
        savedAttachments: attachmentCount,
        driveFolder: userConfig.driveFolder,
        allowedFileTypes: userConfig.fileTypes
      }
    };
    
    console.log('✅ Gmail flow completed successfully:', {
      processedEmails: result.processedEmails,
      savedAttachments: result.savedAttachments,
      emailsFound: result.emailsFound
    });
    
    return createSuccessResponse(result);
      
  } catch (error) {
    console.error('❌ Error processing Gmail flow:', error);
    return createErrorResponse('Failed to process Gmail flow: ' + error.toString());
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
