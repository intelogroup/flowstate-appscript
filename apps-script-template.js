
/**
 * Apps Script Web App Template for Gmail to Drive Flow
 * SIMPLE SHARED SECRET AUTHENTICATION VERSION
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
      flowName: userConfig?.flowName
    });
    
    // Check authentication using shared secret
    if (!SCRIPT_SECRET) {
      console.error('❌ APPS_SCRIPT_SECRET not configured in Apps Script properties');
      return createErrorResponse('Server configuration error: Missing secret');
    }
    
    if (receivedSecret !== SCRIPT_SECRET) {
      console.error('❌ Authentication failed: Invalid secret');
      return createErrorResponse('Authentication failed: Invalid secret token');
    }
    
    console.log('✅ Authentication successful with shared secret');
    
    // Process the Gmail flow with user's email
    if (requestData.action === 'process_gmail_flow') {
      return processGmailFlowWithUserEmail(userConfig, userEmail);
    } else {
      return createErrorResponse('Unknown action: ' + requestData.action);
    }
    
  } catch (error) {
    console.error('❌ Error in doPost:', error);
    return createErrorResponse('Internal server error: ' + error.toString());
  }
}

function processGmailFlowWithUserEmail(userConfig, userEmail) {
  try {
    console.log('📧 Processing Gmail flow with user email:', userEmail);
    console.log('📧 User config:', {
      senders: userConfig?.senders,
      driveFolder: userConfig?.driveFolder,
      flowName: userConfig?.flowName
    });
    
    // Build Gmail search query using the user's email and configuration
    let searchQuery = buildSearchQuery(userConfig, userEmail);
    
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
      message: `Processed ${processedCount} emails and saved ${attachmentCount} attachments for ${userEmail}`,
      data: {
        processedEmails: processedCount,
        savedAttachments: attachmentCount,
        emailsFound: emailsFound,
        attachments: attachmentCount,
        flowName: userConfig.flowName,
        userEmail: userEmail,
        authMethod: 'shared-secret',
        searchQuery: searchQuery,
        debugInfo: {
          userEmail: userEmail,
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

function buildSearchQuery(userConfig, userEmail) {
  let searchQuery = '';
  
  // Start with the senders configuration
  if (userConfig.senders && userConfig.senders.trim()) {
    const senders = userConfig.senders.split(',').map(s => s.trim()).filter(s => s);
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
  
  return searchQuery;
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
  console.log('✅ Apps Script is working correctly with shared secret authentication!');
  return 'Success';
}
