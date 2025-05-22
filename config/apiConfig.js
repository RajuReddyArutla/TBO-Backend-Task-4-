// config/apiConfig.js
export const TBO_CONFIG = {
  // API endpoint and credentials
  API_URL: 'https://affiliate.tektravels.com/HotelAPI/Search',
  USERNAME: 'Hypermiles',
  PASSWORD: 'Hypermiles@1234',
  
  // Request configuration
  CHUNK_SIZE: 10, // Number of hotel codes per request
  MAX_PARALLEL_REQUESTS: 10, // Maximum concurrent requests
  BATCH_DELAY: 1000, // Delay between batches in milliseconds
  REQUEST_TIMEOUT: 30000, // Request timeout in milliseconds
  
  // Default parameters
  DEFAULT_GUEST_NATIONALITY: 'IN',
  DEFAULT_RESPONSE_TIME: 23.0,
  
  // Retry configuration
  MAX_RETRIES: 2,
  RETRY_DELAY: 2000, // Delay between retries in milliseconds
  
  // Rate limiting
  REQUESTS_PER_MINUTE: 60, // Adjust based on TBO API limits
  
  // Logging
  LOG_DETAILED_REQUESTS: true,
  LOG_DETAILED_RESPONSES: false // Set to true for debugging, false for production
};