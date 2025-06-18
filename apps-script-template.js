/**
 * Apps Script Web App Template for Gmail to Drive Flow
 * PRODUCTION VERSION WITH HARDENING PATTERNS
 * V.06 MODULAR ARCHITECTURE
 */

// Import all modules (in Apps Script, these would be separate .gs files)
// For this template, we'll include them inline but organized

/**
 * Configuration Module
 * Centralized configuration management for the Gmail processing system
 */

class Config {
  static get RETRY_CONFIG() {
    return {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      exponentialBackoff: true
    };
  }

  static get RATE_LIMIT_CONFIG() {
    return {
      gmailApiCallsPerMinute: 250, // Gmail API quota is 250/min
      driveApiCallsPerMinute: 1000, // Drive API quota is 1000/min
      batchSize: 10, // Process emails in batches
      delayBetweenBatches: 2000 // 2 seconds between batches
    };
  }

  static get CIRCUIT_BREAKER_CONFIG() {
    return {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringWindow: 300000 // 5 minutes
    };
  }

  static get VERSION() {
    return 'V.06-PRODUCTION-MODULAR';
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
 * Gmail Processor Module
 * Handles Gmail API operations with retry logic and rate limiting
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

  async processEmailsBatch(threads, userConfig, startTime) {
    const batchSize = Config.RATE_LIMIT_CONFIG.batchSize;
    const results = {
      processedEmails: 0,
      savedAttachments: 0,
      processedAttachments: [],
      errors: []
    };

    console.log(`📧 Processing ${threads.length} threads in batches of ${batchSize}`);

    for (let i = 0; i < threads.length; i += batchSize) {
      const batch = threads.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1} (${batch.length} threads)`);

      try {
        const batchResults = await this.processBatch(batch, userConfig);
        results.processedEmails += batchResults.processedEmails;
        results.savedAttachments += batchResults.savedAttachments;
        results.processedAttachments.push(...batchResults.processedAttachments);
      } catch (error) {
        console.error(`❌ Batch processing error:`, error);
        results.errors.push({
          batchIndex: Math.floor(i/batchSize) + 1,
          error: error.message
        });
      }

      // Delay between batches to avoid overwhelming APIs
      if (i + batchSize < threads.length) {
        console.log(`⏱️ Waiting ${Config.RATE_LIMIT_CONFIG.delayBetweenBatches}ms between batches...`);
        Utilities.sleep(Config.RATE_LIMIT_CONFIG.delayBetweenBatches);
      }
    }

    return results;
  }

  async processBatch(threads, userConfig) {
    const batchResults = {
      processedEmails: 0,
      savedAttachments: 0,
      processedAttachments: []
    };

    for (const thread of threads) {
      try {
        const threadResults = await this.processThread(thread, userConfig);
        batchResults.processedEmails += threadResults.processedEmails;
        batchResults.savedAttachments += threadResults.savedAttachments;
        batchResults.processedAttachments.push(...threadResults.processedAttachments);
      } catch (error) {
        console.error(`❌ Thread processing error:`, error);
        // Continue processing other threads even if one fails
      }
    }

    return batchResults;
  }

  async processThread(thread, userConfig) {
    return await RetryHandler.executeWithRetry(async () => {
      await this.rateLimiter.checkGmailRate();
      
      const messages = thread.getMessages();
      const threadResults = {
        processedEmails: 0,
        savedAttachments: 0,
        processedAttachments: []
      };

      for (const message of messages) {
        const messageResults = await this.processMessage(message, userConfig);
        threadResults.processedEmails++;
        threadResults.savedAttachments += messageResults.savedAttachments;
        threadResults.processedAttachments.push(...messageResults.processedAttachments);
      }

      return threadResults;
    }, `Processing thread with ${thread.getMessages().length} messages`);
  }

  async processMessage(message, userConfig) {
    const attachments = message.getAttachments();
    const messageResults = {
      savedAttachments: 0,
      processedAttachments: []
    };

    for (const attachment of attachments) {
      try {
        if (this.shouldProcessFileType(attachment, userConfig.fileTypes)) {
          const savedAttachment = await this.saveAttachment(attachment, userConfig);
          if (savedAttachment) {
            messageResults.savedAttachments++;
            messageResults.processedAttachments.push(savedAttachment);
          }
        }
      } catch (error) {
        console.error(`❌ Attachment processing error:`, error);
        // Continue processing other attachments
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
    
    // Add attachment filter and recent emails
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
      console.log('📋 Request parsed:', {
        hasSecret: !!requestData.secret,
        hasPayload: !!requestData.payload,
        topLevelKeys: Object.keys(requestData || {}),
        payloadKeys: requestData.payload ? Object.keys(requestData.payload) : []
      });
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError);
      return ResponseBuilder.createErrorResponse('Invalid JSON in request body');
    }
    
    // Validate two-layer structure
    if (!requestData.secret) {
      console.error('❌ Missing secret in top-level structure');
      return ResponseBuilder.createErrorResponse('Authentication failed: Missing secret in top-level structure');
    }
    
    if (!requestData.payload) {
      console.error('❌ Missing payload in top-level structure');
      return ResponseBuilder.createErrorResponse('Missing payload in top-level structure');
    }
    
    // Validate authentication with circuit breaker
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
    
    // Validate payload structure
    if (!payload.action) {
      console.error('❌ Missing action in payload');
      return ResponseBuilder.createErrorResponse('Missing action in payload');
    }
    
    console.log('📧 Processing payload with action:', {
      action: payload.action,
      hasUserConfig: !!payload.userConfig,
      hasUserEmail: !!payload.userEmail,
      hasDebugInfo: !!payload.debug_info
    });
    
    // Handle different actions from payload
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
    console.log('📧 Processing Gmail flow with production hardening patterns');
    
    // Enhanced validation
    if (!payload.userConfig) {
      return ResponseBuilder.createErrorResponse('User configuration is required in payload');
    }
    
    if (!payload.userConfig.driveFolder) {
      return ResponseBuilder.createErrorResponse('Drive folder is required in payload userConfig');
    }
    
    if (!payload.userConfig.flowName) {
      return ResponseBuilder.createErrorResponse('Flow name is required in payload userConfig');
    }
    
    const processor = new GmailProcessor();
    
    // Build search query
    const searchQuery = processor.buildSearchQuery(payload.userConfig, payload.userEmail);
    console.log('🔍 Gmail search query:', searchQuery);
    
    // Search for emails with circuit breaker and retry logic
    const threads = await gmailCircuitBreaker.execute(
      async () => await processor.searchEmailsWithRetry(searchQuery, payload.userConfig.maxEmails || 10),
      () => {
        console.log('🔄 Gmail search fallback: returning empty results');
        return [];
      }
    );
    
    const emailsFound = threads.length;
    console.log(`📨 Found ${emailsFound} email threads`);
    
    if (emailsFound === 0) {
      const processingTime = Date.now() - startTime;
      return ResponseBuilder.createSuccessResponse('No emails found matching the search criteria', {
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
          hardeningFeatures: ['retry-logic', 'rate-limiting', 'circuit-breaker', 'batch-processing']
        }
      }, processingTime);
    }
    
    // Process emails with batch processing and circuit breaker
    const results = await driveCircuitBreaker.execute(
      async () => await processor.processEmailsBatch(threads, payload.userConfig, startTime),
      () => {
        console.log('🔄 Drive processing fallback: returning partial results');
        return {
          processedEmails: emailsFound,
          savedAttachments: 0,
          processedAttachments: [],
          errors: ['Drive service temporarily unavailable - attachments not saved']
        };
      }
    );
    
    const processingTime = Date.now() - startTime;
    
    const responseData = {
      processedEmails: results.processedEmails,
      savedAttachments: results.savedAttachments,
      emailsFound: emailsFound,
      attachments: results.savedAttachments,
      flowName: payload.userConfig.flowName,
      userEmail: payload.userEmail,
      authMethod: 'two-layer-secret-payload',
      searchQuery: searchQuery,
      processedAttachments: results.processedAttachments,
      debugInfo: {
        userEmail: payload.userEmail,
        searchQuery: searchQuery,
        emailsFound: emailsFound,
        processedEmails: results.processedEmails,
        savedAttachments: results.savedAttachments,
        driveFolder: payload.userConfig.driveFolder,
        allowedFileTypes: payload.userConfig.fileTypes,
        hardeningFeatures: ['retry-logic', 'rate-limiting', 'circuit-breaker', 'batch-processing'],
        requestId: payload.debug_info?.request_id || 'unknown',
        errors: results.errors || []
      }
    };
    
    console.log('✅ Gmail flow completed successfully with production hardening:', {
      processedEmails: results.processedEmails,
      savedAttachments: results.savedAttachments,
      emailsFound: emailsFound,
      authMethod: responseData.authMethod,
      errors: results.errors?.length || 0
    });
    
    return ResponseBuilder.createSuccessResponse(
      `Processed ${results.processedEmails} emails and saved ${results.savedAttachments} attachments for ${payload.userEmail}`,
      responseData,
      processingTime
    );
      
  } catch (error) {
    console.error('❌ Error processing Gmail flow with hardening:', error);
    const processingTime = Date.now() - startTime;
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
