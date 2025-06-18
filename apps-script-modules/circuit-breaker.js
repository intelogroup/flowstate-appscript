
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
