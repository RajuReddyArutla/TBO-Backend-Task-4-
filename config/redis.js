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

import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

await client.connect();
console.log('Redis connected');
export default client;