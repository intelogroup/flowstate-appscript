
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
