
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
