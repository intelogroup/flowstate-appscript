/**
 * Apps Script Web App Template for Gmail to Drive Flow
 * PRODUCTION VERSION WITH HARDENING PATTERNS AND WEBHOOK NOTIFICATIONS
 * V.06 MODULAR ARCHITECTURE WITH REAL-TIME UPDATES
 */

// Import all modules (in Apps Script, these would be separate .gs files)
// For this template, we'll include them inline but organized

/**
 * WebhookNotifier Module - Real-time Status Updates
 */
const WebhookNotifier = {
  DEFAULT_TIMEOUT: 5000,
  MAX_RETRIES: 2,
  
  sendStatusUpdate: function(status, message, data, webhookUrl, requestId, userContext) {
    try {
      if (!webhookUrl || !webhookUrl.trim()) {
        return { success: true, skipped: true, reason: 'No webhook URL provided' };
      }
      
      console.log(`📡 [WEBHOOK] Sending status update: ${status} - ${message}`);
      
      const statusUpdate = {
        type: 'status_update',
        status: status,
        message: message,
        timestamp: new Date().toISOString(),
        requestId: requestId,
        authenticatedUser: userContext ? userContext.email : null,
        version: 'V.06-MODULAR-WEBHOOK',
        data: data || {}
      };
      
      const result = this.makeWebhookCall(webhookUrl, statusUpdate);
      console.log(`📡 [WEBHOOK] Status update result:`, { status: status, success: result.success });
      return result;
      
    } catch (error) {
      console.error('❌ [WEBHOOK] Failed to send status update:', error);
      return { success: false, error: error.toString() };
    }
  },
  
  sendProgressUpdate: function(current, total, message, webhookUrl, requestId, userContext, additionalData) {
    try {
      const percentage = Math.round((current / total) * 100);
      const progressData = {
        progress: { current: current, total: total, percentage: percentage, stage: message },
        ...additionalData
      };
      
      return this.sendStatusUpdate('processing', 
        `${message} (${current}/${total} - ${percentage}%)`, 
        progressData, webhookUrl, requestId, userContext);
    } catch (error) {
      console.error('❌ [WEBHOOK] Failed to send progress update:', error);
      return { success: false, error: error.toString() };
    }
  },
  
  sendFlowStarted: function(webhookUrl, requestId, userContext, config) {
    try {
      const startedData = {
        flow: {
          name: config.flowName || 'Gmail Processing Flow',
          authenticatedUser: userContext.email,
          searchFilter: config.senders,
          targetFolder: config.driveFolder,
          maxEmails: config.maxEmails,
          fileTypes: config.fileTypes
        }
      };
      
      return this.sendStatusUpdate('started', 
        `Flow started for ${userContext.email}`, 
        startedData, webhookUrl, requestId, userContext);
    } catch (error) {
      console.error('❌ [WEBHOOK] Failed to send flow started:', error);
      return { success: false, error: error.toString() };
    }
  },
  
  sendSearchCompleted: function(emailsFound, webhookUrl, requestId, userContext, searchQuery) {
    try {
      const searchData = {
        search: {
          query: searchQuery,
          emailsFound: emailsFound,
          nextStep: emailsFound > 0 ? 'Processing attachments' : 'Completed - no emails found'
        }
      };
      
      const message = emailsFound > 0 ? 
        `Found ${emailsFound} emails, processing attachments...` : 
        `No emails found matching search criteria`;
      
      return this.sendStatusUpdate('processing', message, searchData, webhookUrl, requestId, userContext);
    } catch (error) {
      console.error('❌ [WEBHOOK] Failed to send search completed:', error);
      return { success: false, error: error.toString() };
    }
  },
  
  sendAttachmentProcessed: function(fileName, fileSize, webhookUrl, requestId, userContext, totalProcessed, totalFound) {
    try {
      const attachmentData = {
        attachment: {
          fileName: fileName,
          fileSize: this.formatFileSize(fileSize),
          totalProcessed: totalProcessed,
          totalFound: totalFound
        }
      };
      
      return this.sendProgressUpdate(totalProcessed, totalFound, 
        `Processed attachment: ${fileName}`, 
        webhookUrl, requestId, userContext, attachmentData);
    } catch (error) {
      console.error('❌ [WEBHOOK] Failed to send attachment processed:', error);
      return { success: false, error: error.toString() };
    }
  },
  
  sendFlowCompleted: function(results, webhookUrl, requestId, userContext) {
    try {
      const completedData = {
        results: {
          emailsFound: results.emailsFound,
          emailsProcessed: results.processedEmails,
          attachmentsSaved: results.savedAttachments,
          processingTime: results.processing_time + 'ms'
        },
        files: results.processedAttachments || []
      };
      
      const message = `Flow completed: ${results.savedAttachments} attachments saved`;
      return this.sendStatusUpdate('completed', message, completedData, webhookUrl, requestId, userContext);
    } catch (error) {
      console.error('❌ [WEBHOOK] Failed to send flow completed:', error);
      return { success: false, error: error.toString() };
    }
  },
  
  makeWebhookCall: function(webhookUrl, payload) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = UrlFetchApp.fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FlowState-AppsScript-Webhook/V.06',
            'X-Request-ID': payload.requestId || 'unknown'
          },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
          timeout: this.DEFAULT_TIMEOUT
        });
        
        const responseCode = response.getResponseCode();
        
        if (responseCode >= 200 && responseCode < 300) {
          return { success: true, responseCode: responseCode, attempt: attempt };
        } else {
          lastError = `HTTP ${responseCode}`;
        }
        
      } catch (fetchError) {
        lastError = fetchError.toString();
        if (attempt < this.MAX_RETRIES) {
          Utilities.sleep(1000 * attempt);
        }
      }
    }
    
    return { success: false, error: lastError, attempts: this.MAX_RETRIES };
  },
  
  formatFileSize: function(bytes) {
    try {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    } catch (error) {
      return bytes + ' bytes';
    }
  }
};

// Helper function to extract webhook URL from request payload
function getWebhookUrl(payload) {
  try {
    return payload.webhookUrl || payload.webhook_url || null;
  } catch (error) {
    return null;
  }
}

// Helper function to safely send webhook updates
function safeWebhookUpdate(status, message, data, webhookUrl, requestId, userContext) {
  try {
    if (webhookUrl) {
      WebhookNotifier.sendStatusUpdate(status, message, data, webhookUrl, requestId, userContext);
    }
  } catch (error) {
    console.error('❌ Safe webhook update failed:', error);
  }
}

/**
 * Configuration Module
 */
class Config {
  static get RETRY_CONFIG() {
    return {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      exponentialBackoff: true
    };
  }

  static get RATE_LIMIT_CONFIG() {
    return {
      gmailApiCallsPerMinute: 250,
      driveApiCallsPerMinute: 1000,
      batchSize: 10,
      delayBetweenBatches: 2000
    };
  }

  static get CIRCUIT_BREAKER_CONFIG() {
    return {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringWindow: 300000
    };
  }

  static get VERSION() {
    return 'V.06-PRODUCTION-MODULAR-WEBHOOK';
  }

  static getSecret() {
    return PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET');
  }

  static validateSecret(receivedSecret) {
    const storedSecret = this.getSecret();
    if (!storedSecret) {
      throw new Error('APPS_SCRIPT_SECRET not configured in Apps Script properties');
    }
    return receivedSecret === storedSecret;
  }
}

/**
 * Rate Limiter Module
 * Manages API call rates to avoid quota limits
 */

class RateLimiter {
  constructor() {
    this.apiCalls = {
      gmail: [],
      drive: []
    };
  }

  async checkGmailRate() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old calls
    this.apiCalls.gmail = this.apiCalls.gmail.filter(timestamp => timestamp > oneMinuteAgo);
    
    if (this.apiCalls.gmail.length >= Config.RATE_LIMIT_CONFIG.gmailApiCallsPerMinute) {
      const waitTime = 60000 - (now - this.apiCalls.gmail[0]);
      console.log(`⏱️ Gmail rate limit reached, waiting ${waitTime}ms`);
      await this.delay(waitTime);
      return this.checkGmailRate(); // Recursive check after wait
    }
    
    this.apiCalls.gmail.push(now);
    return true;
  }

  async checkDriveRate() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old calls
    this.apiCalls.drive = this.apiCalls.drive.filter(timestamp => timestamp > oneMinuteAgo);
    
    if (this.apiCalls.drive.length >= Config.RATE_LIMIT_CONFIG.driveApiCallsPerMinute) {
      const waitTime = 60000 - (now - this.apiCalls.drive[0]);
      console.log(`⏱️ Drive rate limit reached, waiting ${waitTime}ms`);
      await this.delay(waitTime);
      return this.checkDriveRate(); // Recursive check after wait
    }
    
    this.apiCalls.drive.push(now);
    return true;
  }

  delay(ms) {
    return new Promise(resolve => {
      Utilities.sleep(ms);
      resolve();
    });
  }
}

/**
 * Retry Handler Module
 * Implements exponential backoff retry logic for API failures
 */

class RetryHandler {
  static async executeWithRetry(operation, context = '', maxRetries = null) {
    const config = Config.RETRY_CONFIG;
    const attempts = maxRetries || config.maxRetries;
    
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`🔄 Executing ${context}, attempt ${attempt}/${attempts}`);
        return await operation();
      } catch (error) {
        console.error(`❌ ${context} failed on attempt ${attempt}:`, error.message);
        
        if (attempt === attempts) {
          throw new Error(`${context} failed after ${attempts} attempts: ${error.message}`);
        }
        
        // Calculate delay with exponential backoff
        const delay = config.exponentialBackoff 
          ? Math.min(config.baseDelay * Math.pow(2, attempt - 1), config.maxDelay)
          : config.baseDelay;
        
        console.log(`⏱️ Retrying ${context} in ${delay}ms...`);
        Utilities.sleep(delay);
      }
    }
  }

  static isRetryableError(error) {
    const retryableErrors = [
      'Rate limit exceeded',
      'Service unavailable',
      'Temporary failure',
      'Timeout',
      'Network error'
    ];
    
    return retryableErrors.some(retryableError => 
      error.message.toLowerCase().includes(retryableError.toLowerCase())
    );
  }
}

/**
 * Gmail Processor Module with Webhook Integration
 */
class GmailProcessor {
  constructor() {
    this.rateLimiter = new RateLimiter();
  }

  async searchEmailsWithRetry(searchQuery, maxEmails = 10) {
    return await RetryHandler.executeWithRetry(async () => {
      await this.rateLimiter.checkGmailRate();
      return GmailApp.search(searchQuery, 0, maxEmails);
    }, `Gmail search for query: ${searchQuery}`);
  }

  async processEmailsBatch(threads, userConfig, startTime, webhookUrl, requestId, userContext) {
    const batchSize = Config.RATE_LIMIT_CONFIG.batchSize;
    const results = {
      processedEmails: 0,
      savedAttachments: 0,
      processedAttachments: [],
      errors: []
    };

    console.log(`📧 Processing ${threads.length} threads in batches of ${batchSize}`);
    
    let totalAttachments = 0;
    let processedAttachments = 0;

    // Count total attachments first for progress tracking
    for (const thread of threads) {
      const messages = thread.getMessages();
      for (const message of messages) {
        totalAttachments += message.getAttachments().length;
      }
    }

    for (let i = 0; i < threads.length; i += batchSize) {
      const batch = threads.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1} (${batch.length} threads)`);

      try {
        const batchResults = await this.processBatch(batch, userConfig, webhookUrl, requestId, userContext, processedAttachments, totalAttachments);
        results.processedEmails += batchResults.processedEmails;
        results.savedAttachments += batchResults.savedAttachments;
        results.processedAttachments.push(...batchResults.processedAttachments);
        processedAttachments += batchResults.savedAttachments;
      } catch (error) {
        console.error(`❌ Batch processing error:`, error);
        results.errors.push({
          batchIndex: Math.floor(i/batchSize) + 1,
          error: error.message
        });
      }

      if (i + batchSize < threads.length) {
        Utilities.sleep(Config.RATE_LIMIT_CONFIG.delayBetweenBatches);
      }
    }

    return results;
  }

  async processBatch(threads, userConfig, webhookUrl, requestId, userContext, startingCount, totalAttachments) {
    const batchResults = {
      processedEmails: 0,
      savedAttachments: 0,
      processedAttachments: []
    };

    let attachmentCount = startingCount;

    for (const thread of threads) {
      try {
        const threadResults = await this.processThread(thread, userConfig, webhookUrl, requestId, userContext, attachmentCount, totalAttachments);
        batchResults.processedEmails += threadResults.processedEmails;
        batchResults.savedAttachments += threadResults.savedAttachments;
        batchResults.processedAttachments.push(...threadResults.processedAttachments);
        attachmentCount += threadResults.savedAttachments;
      } catch (error) {
        console.error(`❌ Thread processing error:`, error);
      }
    }

    return batchResults;
  }

  async processThread(thread, userConfig, webhookUrl, requestId, userContext, startingCount, totalAttachments) {
    return await RetryHandler.executeWithRetry(async () => {
      await this.rateLimiter.checkGmailRate();
      
      const messages = thread.getMessages();
      const threadResults = {
        processedEmails: 0,
        savedAttachments: 0,
        processedAttachments: []
      };

      let attachmentCount = startingCount;

      for (const message of messages) {
        const messageResults = await this.processMessage(message, userConfig, webhookUrl, requestId, userContext, attachmentCount, totalAttachments);
        threadResults.processedEmails++;
        threadResults.savedAttachments += messageResults.savedAttachments;
        threadResults.processedAttachments.push(...messageResults.processedAttachments);
        attachmentCount += messageResults.savedAttachments;
      }

      return threadResults;
    }, `Processing thread with ${thread.getMessages().length} messages`);
  }

  async processMessage(message, userConfig, webhookUrl, requestId, userContext, startingCount, totalAttachments) {
    const attachments = message.getAttachments();
    const messageResults = {
      savedAttachments: 0,
      processedAttachments: []
    };

    let attachmentCount = startingCount;

    for (const attachment of attachments) {
      try {
        if (this.shouldProcessFileType(attachment, userConfig.fileTypes)) {
          const savedAttachment = await this.saveAttachment(attachment, userConfig);
          if (savedAttachment) {
            messageResults.savedAttachments++;
            messageResults.processedAttachments.push(savedAttachment);
            attachmentCount++;
            
            // Send webhook update for each processed attachment
            safeWebhookUpdate('processing', 
              `Processed attachment: ${attachment.getName()}`, 
              {
                attachment: {
                  fileName: attachment.getName(),
                  fileSize: WebhookNotifier.formatFileSize(attachment.getSize())
                },
                progress: {
                  current: attachmentCount,
                  total: totalAttachments,
                  percentage: Math.round((attachmentCount / totalAttachments) * 100)
                }
              }, 
              webhookUrl, requestId, userContext);
          }
        }
      } catch (error) {
        console.error(`❌ Attachment processing error:`, error);
      }
    }

    return messageResults;
  }

  async saveAttachment(attachment, userConfig) {
    return await RetryHandler.executeWithRetry(async () => {
      await this.rateLimiter.checkDriveRate();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${userConfig.flowName}_${timestamp}_${attachment.getName()}`;
      
      const folder = await this.getOrCreateFolder(userConfig.driveFolder);
      const file = folder.createFile(attachment.copyBlob().setName(fileName));
      
      return {
        originalName: attachment.getName(),
        savedName: fileName,
        size: attachment.getSize(),
        type: attachment.getContentType(),
        fileId: file.getId(),
        fileUrl: file.getUrl()
      };
    }, `Saving attachment: ${attachment.getName()}`);
  }

  shouldProcessFileType(attachment, allowedTypes) {
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

  async getOrCreateFolder(folderPath) {
    return await RetryHandler.executeWithRetry(async () => {
      await this.rateLimiter.checkDriveRate();
      
      const pathParts = folderPath.split('/').filter(part => part.trim() !== '');
      let currentFolder = DriveApp.getRootFolder();
      
      for (const folderName of pathParts) {
        const existingFolders = currentFolder.getFoldersByName(folderName);
        
        if (existingFolders.hasNext()) {
          currentFolder = existingFolders.next();
        } else {
          currentFolder = currentFolder.createFolder(folderName);
        }
      }
      
      return currentFolder;
    }, `Creating/accessing folder: ${folderPath}`);
  }

  buildSearchQuery(userConfig, userEmail) {
    let searchQuery = '';
    
    if (userConfig.senders && userConfig.senders.trim()) {
      const senders = userConfig.senders.split(',').map(s => s.trim()).filter(s => s);
      
      if (senders.length === 1) {
        searchQuery = `from:${senders[0]}`;
      } else if (senders.length > 1) {
        searchQuery = `(${senders.map(s => `from:${s}`).join(' OR ')})`;
      }
    } else if (userEmail) {
      searchQuery = `from:${userEmail}`;
    }
    
    if (searchQuery) {
      searchQuery += ' has:attachment newer_than:7d';
    } else {
      searchQuery = 'has:attachment newer_than:7d';
    }
    
    return searchQuery;
  }
}

/**
 * Circuit Breaker Module
 * Implements circuit breaker pattern for graceful degradation
 */

class CircuitBreaker {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.config = Config.CIRCUIT_BREAKER_CONFIG;
  }

  async execute(operation, fallback = null) {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        console.log(`🔄 Circuit breaker for ${this.serviceName} entering HALF_OPEN state`);
      } else {
        console.log(`⚡ Circuit breaker for ${this.serviceName} is OPEN, using fallback`);
        return fallback ? fallback() : this.getDefaultFallback();
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) {
        console.log(`🔄 Operation failed, using fallback for ${this.serviceName}`);
        return fallback();
      }
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    console.log(`✅ Circuit breaker for ${this.serviceName} reset to CLOSED`);
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
      console.log(`🚨 Circuit breaker for ${this.serviceName} opened after ${this.failureCount} failures`);
    }
  }

  shouldAttemptReset() {
    return Date.now() - this.lastFailureTime > this.config.resetTimeout;
  }

  getDefaultFallback() {
    return {
      status: 'error',
      message: `Service ${this.serviceName} is temporarily unavailable`,
      fallback: true,
      data: {
        processedEmails: 0,
        savedAttachments: 0,
        emailsFound: 0
      }
    };
  }
}

/**
 * Response Builder Module
 * Standardizes response formatting for the frontend
 */

class ResponseBuilder {
  static createSuccessResponse(message, data = null, processingTime = 0) {
    const response = {
      status: 'success',
      message: message,
      timestamp: new Date().toISOString(),
      version: Config.VERSION,
      processing_time: processingTime
    };
    
    if (data) {
      response.data = data;
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  }

  static createErrorResponse(message, details = null, processingTime = 0) {
    const response = {
      status: 'error',
      message: message,
      timestamp: new Date().toISOString(),
      version: Config.VERSION,
      processing_time: processingTime
    };
    
    if (details) {
      response.details = details;
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  }

  static createHealthCheckResponse() {
    return this.createSuccessResponse('Apps Script is healthy and ready', {
      version: Config.VERSION,
      auth_method: 'two-layer-secret-payload',
      features: [
        'retry-logic',
        'rate-limiting', 
        'circuit-breaker',
        'batch-processing',
        'modular-architecture'
      ]
    });
  }
}

// Global circuit breakers
const gmailCircuitBreaker = new CircuitBreaker('Gmail API');
const driveCircuitBreaker = new CircuitBreaker('Drive API');

function doPost(e) {
  const startTime = Date.now();
  
  try {
    console.log(`📨 Received POST request - ${Config.VERSION}`);
    
    if (!e.postData || !e.postData.contents) {
      console.error('❌ No post data received');
      return ResponseBuilder.createErrorResponse('No request body received');
    }
    
    let requestData;
    try {
      requestData = JSON.parse(e.postData.contents);
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError);
      return ResponseBuilder.createErrorResponse('Invalid JSON in request body');
    }
    
    if (!requestData.secret || !requestData.payload) {
      console.error('❌ Missing secret or payload in top-level structure');
      return ResponseBuilder.createErrorResponse('Missing secret or payload in top-level structure');
    }
    
    try {
      if (!Config.validateSecret(requestData.secret)) {
        console.error('❌ Authentication failed: Invalid secret');
        return ResponseBuilder.createErrorResponse('Authentication failed: Invalid secret token');
      }
    } catch (authError) {
      console.error('❌ Authentication error:', authError);
      return ResponseBuilder.createErrorResponse(authError.message);
    }
    
    console.log('✅ Two-layer authentication successful');
    
    const payload = requestData.payload;
    
    if (!payload.action) {
      console.error('❌ Missing action in payload');
      return ResponseBuilder.createErrorResponse('Missing action in payload');
    }
    
    if (payload.action === 'process_gmail_flow') {
      return handleGmailFlowWithHardening(payload, startTime);
    } else if (payload.action === 'health_check') {
      return ResponseBuilder.createHealthCheckResponse();
    } else {
      console.error('❌ Unknown action in payload:', payload.action);
      return ResponseBuilder.createErrorResponse('Unknown action: ' + payload.action);
    }
    
  } catch (error) {
    console.error('❌ Error in doPost:', error);
    const processingTime = Date.now() - startTime;
    return ResponseBuilder.createErrorResponse('Internal server error: ' + error.toString(), null, processingTime);
  }
}

async function handleGmailFlowWithHardening(payload, startTime) {
  try {
    console.log('📧 Processing Gmail flow with webhook notifications');
    
    if (!payload.userConfig || !payload.userConfig.driveFolder || !payload.userConfig.flowName) {
      return ResponseBuilder.createErrorResponse('Missing required userConfig fields');
    }
    
    const webhookUrl = getWebhookUrl(payload);
    const requestId = payload.debug_info?.request_id || 'unknown';
    const userContext = { email: payload.userEmail };
    
    // Send flow started webhook
    safeWebhookUpdate('started', `Flow started for ${payload.userEmail}`, {
      flow: {
        name: payload.userConfig.flowName,
        driveFolder: payload.userConfig.driveFolder,
        senders: payload.userConfig.senders
      }
    }, webhookUrl, requestId, userContext);
    
    const processor = new GmailProcessor();
    const searchQuery = processor.buildSearchQuery(payload.userConfig, payload.userEmail);
    
    console.log('🔍 Gmail search query:', searchQuery);
    
    const threads = await gmailCircuitBreaker.execute(
      async () => await processor.searchEmailsWithRetry(searchQuery, payload.userConfig.maxEmails || 10),
      () => []
    );
    
    const emailsFound = threads.length;
    console.log(`📨 Found ${emailsFound} email threads`);
    
    // Send search completed webhook
    safeWebhookUpdate('processing', 
      emailsFound > 0 ? `Found ${emailsFound} emails, processing attachments...` : 'No emails found',
      {
        search: {
          query: searchQuery,
          emailsFound: emailsFound,
          nextStep: emailsFound > 0 ? 'Processing attachments' : 'Completed - no emails found'
        }
      }, 
      webhookUrl, requestId, userContext);
    
    if (emailsFound === 0) {
      const processingTime = Date.now() - startTime;
      
      // Send completion webhook
      safeWebhookUpdate('completed', 'No emails found matching criteria', {
        results: {
          emailsFound: 0,
          attachmentsSaved: 0,
          processingTime: processingTime + 'ms'
        }
      }, webhookUrl, requestId, userContext);
      
      return ResponseBuilder.createSuccessResponse('No emails found matching the search criteria', {
        processedEmails: 0,
        savedAttachments: 0,
        emailsFound: 0,
        attachments: 0,
        flowName: payload.userConfig.flowName,
        userEmail: payload.userEmail,
        searchQuery: searchQuery
      }, processingTime);
    }
    
    const results = await driveCircuitBreaker.execute(
      async () => await processor.processEmailsBatch(threads, payload.userConfig, startTime, webhookUrl, requestId, userContext),
      () => ({
        processedEmails: emailsFound,
        savedAttachments: 0,
        processedAttachments: [],
        errors: ['Drive service temporarily unavailable']
      })
    );
    
    const processingTime = Date.now() - startTime;
    
    // Send completion webhook
    safeWebhookUpdate('completed', `Flow completed: ${results.savedAttachments} attachments saved`, {
      results: {
        emailsFound: emailsFound,
        emailsProcessed: results.processedEmails,
        attachmentsSaved: results.savedAttachments,
        processingTime: processingTime + 'ms'
      },
      files: results.processedAttachments || []
    }, webhookUrl, requestId, userContext);
    
    const responseData = {
      processedEmails: results.processedEmails,
      savedAttachments: results.savedAttachments,
      emailsFound: emailsFound,
      attachments: results.savedAttachments,
      flowName: payload.userConfig.flowName,
      userEmail: payload.userEmail,
      authMethod: 'two-layer-secret-payload',
      searchQuery: searchQuery,
      processedAttachments: results.processedAttachments
    };
    
    console.log('✅ Gmail flow completed successfully with webhook notifications');
    
    return ResponseBuilder.createSuccessResponse(
      `Processed ${results.processedEmails} emails and saved ${results.savedAttachments} attachments for ${payload.userEmail}`,
      responseData,
      processingTime
    );
      
  } catch (error) {
    console.error('❌ Error processing Gmail flow:', error);
    const processingTime = Date.now() - startTime;
    
    // Send error webhook
    const webhookUrl = getWebhookUrl(payload);
    const requestId = payload.debug_info?.request_id || 'unknown';
    const userContext = { email: payload.userEmail };
    
    safeWebhookUpdate('error', error.toString(), {
      error: {
        message: error.toString(),
        timestamp: new Date().toISOString()
      }
    }, webhookUrl, requestId, userContext);
    
    return ResponseBuilder.createErrorResponse('Failed to process Gmail flow: ' + error.toString(), null, processingTime);
  }
}

// Test function for manual testing
function testFunction() {
  console.log(`✅ Apps Script is working correctly with production hardening patterns!`);
  console.log(`🔧 Version: ${Config.VERSION}`);
  
  const secret = Config.getSecret();
  console.log('🔑 Secret configured:', !!secret, 'Length:', secret?.length || 0);
  
  return `Test successful - Apps Script ${Config.VERSION} is ready with production hardening!`;
}

// Health check function for external monitoring
function healthCheck() {
  try {
    const secret = Config.getSecret();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      hasSecret: !!secret,
      version: Config.VERSION,
      features: [
        'retry-logic',
        'rate-limiting', 
        'circuit-breaker',
        'batch-processing',
        'modular-architecture'
      ]
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.toString(),
      timestamp: new Date().toISOString(),
      version: Config.VERSION
    };
  }
}
