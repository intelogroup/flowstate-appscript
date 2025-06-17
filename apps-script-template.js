/**
 * Apps Script Web App Template for Gmail to Drive Flow
 * SIMPLIFIED DEV MODE VERSION
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
    const receivedSecret = requestData.secret;
    const payload = requestData.payload;
    
    console.log('📋 Request parsed:', {
      hasSecret: !!receivedSecret,
      hasPayload: !!payload,
      action: payload?.action,
      devMode: payload?.userConfig?.devMode
    });
    
    // DEV MODE: Skip authentication if devMode is enabled
    if (payload?.userConfig?.devMode || payload?.debug_info?.dev_mode) {
      console.log('🚧 DEV MODE: Skipping authentication checks');
      return processGmailFlowDevMode(payload.userConfig);
    }
    
    // PRODUCTION MODE: Check authentication
    if (!SCRIPT_SECRET) {
      console.error('❌ APPS_SCRIPT_SECRET not configured');
      return createErrorResponse('Server configuration error');
    }
    
    if (receivedSecret !== SCRIPT_SECRET) {
      console.error('❌ Authentication failed: Invalid secret');
      return createErrorResponse('Unauthorized: Invalid authentication secret');
    }
    
    console.log('✅ Authentication successful');
    
    // Route to appropriate handler
    if (payload.action === 'process_gmail_flow') {
      return processGmailFlow(payload.userConfig, payload.googleTokens);
    } else {
      return createErrorResponse('Unknown action: ' + payload.action);
    }
    
  } catch (error) {
    console.error('❌ Error in doPost:', error);
    return createErrorResponse('Internal server error: ' + error.toString());
  }
}

function processGmailFlowDevMode(userConfig) {
  try {
    console.log('🚧 Processing Gmail flow in DEV MODE');
    console.log('📧 User config:', {
      senders: userConfig?.senders,
      driveFolder: userConfig?.driveFolder,
      flowName: userConfig?.flowName
    });
    
    // Build Gmail search query
    let searchQuery = '';
    if (userConfig.senders && userConfig.senders.trim()) {
      const senders = userConfig.senders.split(',').map(s => s.trim()).filter(s => s);
      if (senders.length === 1) {
        searchQuery = `from:${senders[0]}`;
      } else if (senders.length > 1) {
        searchQuery = `(${senders.map(s => `from:${s}`).join(' OR ')})`;
      }
    }
    
    // Add attachment filter and recent emails
    if (searchQuery) {
      searchQuery += ' has:attachment newer_than:7d';
    } else {
      searchQuery = 'has:attachment newer_than:7d';
    }
    
    console.log('🔍 Gmail search query:', searchQuery);
    
    // Search for emails
    const threads = GmailApp.search(searchQuery, 0, userConfig.maxEmails || 10);
    let processedCount = 0;
    let attachmentCount = 0;
    let emailsFound = threads.length;
    
    console.log(`📨 Found ${emailsFound} email threads`);
    
    threads.forEach(thread => {
      const messages = thread.getMessages();
      
      messages.forEach(message => {
        const attachments = message.getAttachments();
        
        attachments.forEach(attachment => {
          if (shouldProcessFileType(attachment, userConfig.fileTypes)) {
            try {
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
      message: `DEV MODE: Processed ${processedCount} emails and saved ${attachmentCount} attachments`,
      data: {
        processedEmails: processedCount,
        savedAttachments: attachmentCount,
        emailsFound: emailsFound,
        attachments: attachmentCount,
        flowName: userConfig.flowName,
        authMethod: 'dev-mode',
        searchQuery: searchQuery,
        debugInfo: {
          devMode: true,
          searchQuery: searchQuery,
          emailsFound: emailsFound,
          processedEmails: processedCount,
          savedAttachments: attachmentCount
        }
      }
    };
    
    console.log('✅ DEV MODE Gmail flow completed:', result);
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('❌ Error in DEV MODE Gmail flow:', error);
    return createErrorResponse('DEV MODE: Failed to process Gmail flow: ' + error.toString());
  }
}

function processGmailFlow(userConfig, googleTokens) {
  try {
    console.log('📧 Processing Gmail flow for:', userConfig?.flowName);
    
    const accessToken = googleTokens?.access_token;
    
    if (!accessToken) {
      console.error('❌ No access token provided');
      return createErrorResponse('Google OAuth access token required');
    }
    
    console.log('🔑 Using Google access token:', accessToken.substring(0, 20) + '...');
    
    // Build Gmail search query
    let searchQuery = '';
    if (userConfig.senders && userConfig.senders.trim()) {
      const senders = userConfig.senders.split(',').map(s => s.trim()).filter(s => s);
      if (senders.length === 1) {
        searchQuery = `from:${senders[0]}`;
      } else if (senders.length > 1) {
        searchQuery = `(${senders.map(s => `from:${s}`).join(' OR ')})`;
      }
    }
    
    if (searchQuery) {
      searchQuery += ' has:attachment';
    } else {
      searchQuery = 'has:attachment';
    }
    
    console.log('🔍 Gmail search query:', searchQuery);
    
    const threads = GmailApp.search(searchQuery, 0, userConfig.maxEmails || 50);
    let processedCount = 0;
    let attachmentCount = 0;
    let emailsFound = threads.length;
    
    console.log(`📨 Found ${emailsFound} email threads`);
    
    threads.forEach(thread => {
      const messages = thread.getMessages();
      
      messages.forEach(message => {
        const attachments = message.getAttachments();
        
        attachments.forEach(attachment => {
          if (shouldProcessFileType(attachment, userConfig.fileTypes)) {
            try {
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
        emailsFound: emailsFound,
        attachments: attachmentCount,
        flowName: userConfig.flowName,
        authMethod: 'oauth',
        searchQuery: searchQuery,
        debugInfo: {
          searchQuery: searchQuery,
          emailsFound: emailsFound,
          processedEmails: processedCount,
          savedAttachments: attachmentCount
        }
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
    return true;
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
    timestamp: new Date().toISOString()
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(errorResponse))
    .setMimeType(ContentService.MimeType.JSON);
}

// Test function
function testFunction() {
  console.log('✅ Apps Script is working correctly in DEV MODE!');
  return 'Success';
}
