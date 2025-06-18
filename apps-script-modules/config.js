
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
