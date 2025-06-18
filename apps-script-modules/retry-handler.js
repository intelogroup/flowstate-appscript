
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
