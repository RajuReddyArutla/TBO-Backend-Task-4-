const { createClient } = require('redis');
require('dotenv').config();

const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

redisClient.on('error', (err) => {
  console.error('Redis client error:', err);
});

// Connect Redis client once
(async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      console.log('Redis client connected');
    }
  } catch (err) {
    console.error('Redis connection error:', err);
  }
})();

// Async get method
const getAsync = async (key) => {
  try {
    return await redisClient.get(key);
  } catch (err) {
    console.error(`Error getting key "${key}" from Redis:`, err);
    throw err;
  }
};

// Async set method with optional expiry (seconds)
const setAsync = async (key, value, expiry = null) => {
  try {
    if (expiry) {
      return await redisClient.set(key, value, { EX: expiry });
    }
    return await redisClient.set(key, value);
  } catch (err) {
    console.error(`Error setting key "${key}" in Redis:`, err);
    throw err;
  }
};

module.exports = {
  redisClient,
  getAsync,
  setAsync,
};
