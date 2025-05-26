import Redis from 'ioredis';
import logger from '../utils/logger.js';

let redisClient;

/**
 * Setup Redis client
 * @returns {Promise<Redis>} Redis client instance
 */
export const setupRedisClient = async () => {
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    // Test connection
    await redisClient.ping();
    
    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed', { error: error.message });
    throw error;
  }
};

/**
 * Get Redis client instance
 * @returns {Redis} Redis client
 */
export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

/**
 * Cache hotel codes for a city
 * @param {string} city - City name
 * @param {Array<string>} hotelCodes - Array of hotel codes
 * @param {number} ttl - Time to live in seconds (default: 24 hours)
 */
export const cacheHotelCodes = async (city, hotelCodes, ttl = 86400) => {
  try {
    const key = `hotel_codes:${city.toLowerCase()}`;
    await getRedisClient().set(key, JSON.stringify(hotelCodes), 'EX', ttl);
    logger.info(`Cached ${hotelCodes.length} hotel codes for ${city}`);
  } catch (error) {
    logger.error('Failed to cache hotel codes', { 
      city, 
      error: error.message 
    });
    throw error;
  }
};

/**
 * Get cached hotel codes for a city
 * @param {string} city - City name
 * @returns {Promise<Array<string>|null>} Array of hotel codes or null if not found
 */
export const getCachedHotelCodes = async (city) => {
  try {
    const key = `hotel_codes:${city.toLowerCase()}`;
    const cachedData = await getRedisClient().get(key);
    
    if (!cachedData) {
      logger.info(`Cache miss for hotel codes in ${city}`);
      return null;
    }
    
    const hotelCodes = JSON.parse(cachedData);
    logger.info(`Cache hit for ${city}: found ${hotelCodes.length} hotel codes`);
    return hotelCodes;
  } catch (error) {
    logger.error('Failed to get cached hotel codes', { 
      city, 
      error: error.message 
    });
    return null;
  }
};

// NEW FUNCTIONS FOR HOTEL NAME SEARCH

/**
 * Cache hotel name to code mapping
 * @param {string} hotelName - Hotel name
 * @param {string} hotelCode - Hotel code
 * @param {number} ttl - Time to live in seconds (default: 24 hours)
 */
export const cacheHotelNameMapping = async (hotelName, hotelCode, ttl = 86400) => {
  try {
    await getRedisClient().hset('hotels_mapping', hotelCode, hotelName);
    logger.info(`Cached hotel name mapping: ${hotelName} -> ${hotelCode}`);
  } catch (error) {
    logger.error('Failed to cache hotel name mapping', { 
      hotelName, 
      hotelCode,
      error: error.message 
    });
    throw error;
  }
};

/**
 * Get hotel code by hotel name (exact and partial match)
 * @param {string} hotelName - Hotel name to search
 * @returns {Promise<Object|null>} Hotel data with code and name, or null if not found
 */
export const getHotelByName = async (hotelName) => {
  try {
    const normalizedHotelName = hotelName.trim().toLowerCase();
    logger.info(`Searching for hotel: ${hotelName}`);
    
    // Get all hotel mappings from Redis
    const allHotels = await getRedisClient().hgetall('hotels_mapping');
    
    if (!allHotels || Object.keys(allHotels).length === 0) {
      logger.warn('No hotel mappings found in Redis');
      return null;
    }
    
    let exactMatch = null;
    let partialMatches = [];
    
    // Search through all hotels
    for (const [hotelCode, storedHotelName] of Object.entries(allHotels)) {
      const normalizedStoredName = storedHotelName.toLowerCase();
      
      // Check for exact match first
      if (normalizedStoredName === normalizedHotelName) {
        exactMatch = {
          HotelCode: hotelCode,
          HotelName: storedHotelName
        };
        break; // Exact match found, no need to continue
      }
      
      // Check for partial match
      if (normalizedStoredName.includes(normalizedHotelName) || 
          normalizedHotelName.includes(normalizedStoredName)) {
        partialMatches.push({
          HotelCode: hotelCode,
          HotelName: storedHotelName
        });
      }
    }
    
    // Return exact match if found, otherwise return first partial match
    const result = exactMatch || (partialMatches.length > 0 ? partialMatches[0] : null);
    
    if (result) {
      logger.info(`Hotel found: ${result.HotelName} (${result.HotelCode}) for search: ${hotelName}`);
    } else {
      logger.warn(`No hotel found for search: ${hotelName}`);
    }
    
    return result;
    
  } catch (error) {
    logger.error('Failed to get hotel by name', { 
      hotelName, 
      error: error.message 
    });
    return null;
  }
};

/**
 * Get city ID by name (existing function - you might already have this)
 * @param {string} cityName - City name
 * @returns {Promise<string|null>} City ID or null if not found
 */
export const getCityIdByName = async (cityName) => {
  try {
    const normalizedCityName = cityName.trim().toLowerCase();
    
    // Check if we have hotel codes for this city (which means it's a valid city)
    const hotelCodes = await getCachedHotelCodes(normalizedCityName);
    
    if (hotelCodes && hotelCodes.length > 0) {
      logger.info(`City found: ${cityName}`);
      return normalizedCityName; // Return city name as ID
    }
    
    logger.info(`City not found: ${cityName}`);
    return null;
  } catch (error) {
    logger.error('Failed to get city ID by name', { 
      cityName, 
      error: error.message 
    });
    return null;
  }
};

/**
 * Bulk cache hotel name mappings
 * @param {Array<Object>} hotelMappings - Array of {hotelCode, hotelName} objects
 */
export const bulkCacheHotelMappings = async (hotelMappings) => {
  try {
    const pipeline = getRedisClient().pipeline();
    
    hotelMappings.forEach(({ hotelCode, hotelName }) => {
      pipeline.hset('hotels_mapping', hotelCode, hotelName);
    });
    
    await pipeline.exec();
    logger.info(`Bulk cached ${hotelMappings.length} hotel name mappings`);
  } catch (error) {
    logger.error('Failed to bulk cache hotel mappings', { 
      count: hotelMappings.length,
      error: error.message 
    });
    throw error;
  }
};