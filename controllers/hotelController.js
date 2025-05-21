import { getCachedHotelCodes, cacheHotelCodes } from '../config/redis.js';
import { getHotelCodesFromDB } from '../config/database.js';
import { searchHotelAvailability } from '../services/tboService.js';
import logger from '../utils/logger.js';

/**
 * Search hotels by city
 * @param {string} city - City name
 * @param {string} checkIn - Check-in date (YYYY-MM-DD)
 * @param {string} checkOut - Check-out date (YYYY-MM-DD)
 * @param {Array<Object>} paxRooms - Array of room configurations
 * @returns {Promise<Object>} Search results
 */
export const searchHotelsByCity = async (city, checkIn, checkOut, paxRooms) => {
  try {
    logger.info('Searching hotels by city', { city, checkIn, checkOut });
    
    // Validate inputs
    if (!city || !checkIn || !checkOut || !paxRooms || paxRooms.length === 0) {
      throw new Error('Missing required parameters');
    }

    // Step 1: Try to get hotel codes from Redis cache
    let hotelCodes = await getCachedHotelCodes(city);
    
    // Step 2: If not in cache, get from database
    if (!hotelCodes || hotelCodes.length === 0) {
      logger.info(`Hotel codes for ${city} not found in cache, fetching from database`);
      hotelCodes = await getHotelCodesFromDB(city);
      
      // Step 3: Cache the hotel codes for future use
      if (hotelCodes && hotelCodes.length > 0) {
        await cacheHotelCodes(city, hotelCodes);
      } else {
        logger.warn(`No hotel codes found for ${city}`);
        return { 
          success: false, 
          message: `No hotels found in ${city}` 
        };
      }
    }
    
    // Step 4: Call TBO API with hotel codes
    // For large cities, we may need to split the request into chunks
    const CHUNK_SIZE = 50; // Adjust based on TBO API limits
    const hotelCodeChunks = [];
    
    for (let i = 0; i < hotelCodes.length; i += CHUNK_SIZE) {
      hotelCodeChunks.push(hotelCodes.slice(i, i + CHUNK_SIZE));
    }
    
    let allResults = [];
    
    // Process each chunk sequentially
    for (const chunk of hotelCodeChunks) {
      try {
        const apiResponse = await searchHotelAvailability(
          chunk, 
          checkIn, 
          checkOut
        );
        
        if (apiResponse.HotelResult && apiResponse.HotelResult.length > 0) {
          allResults = [...allResults, ...apiResponse.HotelResult];
        }
      } catch (error) {
        logger.error('Error processing hotel code chunk', { 
          chunkSize: chunk.length,
          error: error.message 
        });
        // Continue with next chunk
      }
    }
    
    // Step 5: Return results
    if (allResults.length === 0) {
      return { 
        success: false, 
        message: `No available hotels found in ${city} for the given dates` 
      };
    }
    
    logger.info(`Found ${allResults.length} available hotels in ${city}`);
    return { 
      success: true, 
      results: allResults
    };
  } catch (error) {
    logger.error('Error in searchHotelsByCity', { 
      city, 
      error: error.message 
    });
    throw error;
  }
};