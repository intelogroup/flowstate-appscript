
/**
 * Apps Script Web App Template for Gmail to Drive Flow
 * Updated for Body-Based Authentication (Compatible with Apps Script limitations)
 * 
 * Instructions:
 * 1. Create a new Google Apps Script project
 * 2. Copy this code into the Code.gs file
 * 3. Enable Gmail API and Drive API in the Apps Script project
 * 4. Deploy as a web app with execution as "User accessing the web app"
 * 5. Copy the web app URL and add it to your Supabase Edge Function environment variables
 */

function doPost(e) {
  try {
    // Parse the request body
    const requestData = JSON.parse(e.postData.contents);
    const { auth_token, action, userConfig, googleTokens } = requestData;
    
    console.log('Received request:', { 
      action, 
      userConfig: userConfig?.flowName,
      hasAuthToken: !!auth_token,
      authMethod: 'body-based'
    });
    
    // Validate authentication token from request body
    if (auth_token) {
      // You can set your expected token here or validate against a stored value
      const expectedToken = 'your-secret-token-here'; // Replace with your actual secret
      
      if (auth_token !== expectedToken) {
        console.error('Authentication failed: Invalid auth token');
        return ContentService
          .createTextOutput(JSON.stringify({ 
            error: 'Authentication failed', 
            details: 'Invalid auth token provided in request body'
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      console.log('Authentication successful via request body');
    } else {
      console.log('No auth token provided - proceeding without authentication');
    }
    
    if (action === 'process_gmail_flow') {
      return processGmailFlow(userConfig, googleTokens);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error in doPost:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ 
        error: 'Internal server error', 
        details: error.toString(),
        note: 'Check Apps Script execution transcript for details'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function processGmailFlow(userConfig, googleTokens) {
  try {
    console.log('Processing Gmail flow for:', userConfig.flowName);
    
    // Set up OAuth2 access
    const accessToken = googleTokens.access_token;
    
    if (!accessToken) {
      throw new Error('No access token provided for Gmail/Drive access');
    }
    
    // Search for emails using the user's filter
    const threads = GmailApp.search(userConfig.emailFilter, 0, 50);
    let processedCount = 0;
    let attachmentCount = 0;
    
    console.log(`Found ${threads.length} email threads matching filter`);
    
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
              
              console.log(`Saved attachment: ${fileName}`);
              attachmentCount++;
              
            } catch (attachmentError) {
              console.error('Error processing attachment:', attachmentError);
            }
          }
        });
        
        processedCount++;
      });
    });
    
    const result = {
      success: true,
      message: `Processed ${processedCount} emails and saved ${attachmentCount} attachments`,
      processedEmails: processedCount,
      savedAttachments: attachmentCount,
      flowName: userConfig.flowName,
      authMethod: 'body-based'
    };
    
    console.log('Flow completed:', result);
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error processing Gmail flow:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ 
        error: 'Failed to process Gmail flow', 
        details: error.toString(),
        troubleshooting: 'Check Gmail and Drive API permissions, and verify access token is valid'
      }))
      .setMimeType(ContentService.MimeType.JSON);
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

// Test function - you can run this to test your setup
function testFunction() {
  console.log('Apps Script is working correctly with body-based authentication!');
  return 'Success';
}

/**
 * SETUP INSTRUCTIONS FOR BODY-BASED AUTHENTICATION:
 * 
 * 1. Replace 'your-secret-token-here' with your actual secret token from Supabase
 * 2. Deploy this script as a Web App with:
 *    - Execute as: "User accessing the web app"
 *    - Who has access: "Anyone"
 * 3. Copy the Web App URL to your Supabase APPS_SCRIPT_WEB_APP_URL secret
 * 4. The auth_token will be sent in the request body, which Apps Script can access
 * 5. This method is compatible with Apps Script limitations on header access
 */
