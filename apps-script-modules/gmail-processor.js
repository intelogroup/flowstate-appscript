
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
