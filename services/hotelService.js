import { getCachedHotelCodes, cacheHotelCodes, getHotelByName, getCityIdByName } from '../config/redis.js';
import { getHotelCodesFromDB } from '../config/database.js';
import { searchHotelAvailability } from './tboService.js';
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
    logger.info('Searching hotels by city', { 
      city, 
      checkIn, 
      checkOut, 
      paxRooms,
      paxRoomsCount: paxRooms?.length || 0
    });
    
    // Validate inputs
    if (!city || !checkIn || !checkOut || !paxRooms || paxRooms.length === 0) {
      throw new Error('Missing required parameters: city, checkIn, checkOut, and paxRooms are required');
    }

    // Validate paxRooms structure
    for (let i = 0; i < paxRooms.length; i++) {
      const room = paxRooms[i];
      if (!room.hasOwnProperty('Adults') && !room.hasOwnProperty('adults')) {
        throw new Error(`paxRooms[${i}] is missing Adults field`);
      }
      
      // Ensure Adults is at least 1
      const adults = room.Adults || room.adults;
      if (!adults || adults < 1) {
        throw new Error(`paxRooms[${i}] must have at least 1 adult`);
      }

      // Validate children ages if children are specified
      const children = room.Children || room.children || 0;
      const childrenAges = room.ChildrenAges || room.childrenAges || [];
      
      if (children > 0 && childrenAges.length !== children) {
        logger.warn(`paxRooms[${i}]: Children count (${children}) doesn't match ChildrenAges array length (${childrenAges.length})`);
      }
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
    
    // Step 4: Call TBO API with hotel codes using parallel requests
    const CHUNK_SIZE = 10; // Smaller chunk size for better reliability
    const MAX_PARALLEL_REQUESTS = 10; // Limit concurrent requests to avoid overwhelming the API
    
    // Split hotel codes into chunks
    const hotelCodeChunks = [];
    for (let i = 0; i < hotelCodes.length; i += CHUNK_SIZE) {
      hotelCodeChunks.push(hotelCodes.slice(i, i + CHUNK_SIZE));
    }
    
    logger.info('Hotel code chunks created', {
      totalHotelCodes: hotelCodes.length,
      chunkSize: CHUNK_SIZE,
      totalChunks: hotelCodeChunks.length,
      maxParallelRequests: MAX_PARALLEL_REQUESTS
    });
    
    let allResults = [];
    
    // Process chunks in batches to avoid overwhelming the API
    for (let i = 0; i < hotelCodeChunks.length; i += MAX_PARALLEL_REQUESTS) {
      const batchChunks = hotelCodeChunks.slice(i, i + MAX_PARALLEL_REQUESTS);
      
      logger.info('Processing batch of chunks', {
        batchNumber: Math.floor(i / MAX_PARALLEL_REQUESTS) + 1,
        totalBatches: Math.ceil(hotelCodeChunks.length / MAX_PARALLEL_REQUESTS),
        chunksInBatch: batchChunks.length
      });
      
      // Create promises for parallel execution
      const chunkPromises = batchChunks.map(async (chunk, index) => {
        try {
          logger.info('Starting parallel request', {
            chunkIndex: i + index,
            chunkSize: chunk.length,
            hotelCodes: chunk.slice(0, 3) // Log first 3 codes for reference
          });
          
          const apiResponse = await searchHotelAvailability(
            chunk,
            checkIn,
            checkOut,
            paxRooms
          );
          
          const resultCount = apiResponse.HotelResult ? apiResponse.HotelResult.length : 0;
          logger.info('Parallel request completed', {
            chunkIndex: i + index,
            resultCount: resultCount
          });
          
          return {
            success: true,
            results: apiResponse.HotelResult || [],
            chunkIndex: i + index
          };
        } catch (error) {
          logger.error('Error in parallel request', {
            chunkIndex: i + index,
            chunkSize: chunk.length,
            error: error.message
          });
          
          return {
            success: false,
            results: [],
            chunkIndex: i + index,
            error: error.message
          };
        }
      });
      
      // Wait for all parallel requests in this batch to complete
      try {
        const batchResults = await Promise.allSettled(chunkPromises);
        
        // Process results from this batch
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.success) {
            allResults = [...allResults, ...result.value.results];
          } else if (result.status === 'rejected') {
            logger.error('Promise rejected in batch', {
              batchIndex: i + index,
              reason: result.reason
            });
          } else if (result.status === 'fulfilled' && !result.value.success) {
            logger.warn('Request failed but promise fulfilled', {
              batchIndex: i + index,
              error: result.value.error
            });
          }
        });
        
        logger.info('Batch completed', {
          batchNumber: Math.floor(i / MAX_PARALLEL_REQUESTS) + 1,
          successfulRequests: batchResults.filter(r => r.status === 'fulfilled' && r.value.success).length,
          failedRequests: batchResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length,
          totalResultsSoFar: allResults.length
        });
        
        // Add a small delay between batches to be respectful to the API
        if (i + MAX_PARALLEL_REQUESTS < hotelCodeChunks.length) {
          logger.info('Waiting before next batch...');
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
        
      } catch (error) {
        logger.error('Error processing batch', {
          batchNumber: Math.floor(i / MAX_PARALLEL_REQUESTS) + 1,
          error: error.message
        });
      }
    }
    
    // Step 5: Return results
    if (allResults.length === 0) {
      return { 
        success: false, 
        message: `No available hotels found in ${city} for the given dates and room configuration` 
      };
    }
    
    logger.info(`Found ${allResults.length} available hotels in ${city}`);
    return { 
      success: true, 
      searchType: 'city',
      results: allResults,
      totalResults: allResults.length
    };
  } catch (error) {
    logger.error('Error in searchHotelsByCity', { 
      city, 
      checkIn,
      checkOut,
      paxRooms,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Search hotel by hotel name (get specific hotel and its rooms)
 * @param {string} hotelName - Hotel name
 * @param {string} checkIn - Check-in date (YYYY-MM-DD)
 * @param {string} checkOut - Check-out date (YYYY-MM-DD)
 * @param {Array<Object>} paxRooms - Array of room configurations
 * @returns {Promise<Object>} Search results
 */
// export const searchHotelByName = async (hotelName, checkIn, checkOut, paxRooms) => {
//   try {
//     logger.info('Searching hotel by name', { 
//       hotelName, 
//       checkIn, 
//       checkOut, 
//       paxRooms,
//       paxRoomsCount: paxRooms?.length || 0
//     });
    
//     // Validate inputs
//     if (!hotelName || !checkIn || !checkOut || !paxRooms || paxRooms.length === 0) {
//       throw new Error('Missing required parameters: hotelName, checkIn, checkOut, and paxRooms are required');
//     }

//     // Validate paxRooms structure (same as city search)
//     for (let i = 0; i < paxRooms.length; i++) {
//       const room = paxRooms[i];
//       if (!room.hasOwnProperty('Adults') && !room.hasOwnProperty('adults')) {
//         throw new Error(`paxRooms[${i}] is missing Adults field`);
//       }
      
//       const adults = room.Adults || room.adults;
//       if (!adults || adults < 1) {
//         throw new Error(`paxRooms[${i}] must have at least 1 adult`);
//       }
//     }

//     // Step 1: Get hotel data by name from Redis
//     const hotelData = await getHotelByName(hotelName);
    
//     if (!hotelData || !hotelData.HotelCode) {
//       return { 
//         success: false, 
//         message: `No hotel found matching "${hotelName}"` 
//       };
//     }

//     logger.info(`Hotel found: ${hotelData.HotelName} (Code: ${hotelData.HotelCode})`);

//     // Step 2: Get hotel rates using the hotel code
//     const apiResponse = await searchHotelAvailability(
//       [hotelData.HotelCode], // Single hotel code in array
//       checkIn,
//       checkOut,
//       paxRooms
//     );

//     // Step 3: Process API response
//     if (!apiResponse.HotelResult || apiResponse.HotelResult.length === 0) {
//       return { 
//         success: false, 
//         message: `No rooms available for "${hotelData.HotelName}" for the selected dates and room configuration` 
//       };
//     }

//     const hotelResult = apiResponse.HotelResult[0]; // Should be only one hotel

//     // logger.info(`Found rooms for hotel: ${hotelData.HotelName}`, {
//     //   roomsCount: hotelResult.Rooms ? hotelResult.Rooms.length : 0
//     // });
//     // Log room information
// logger.info(`Found rooms for hotel: ${hotelData.HotelName}`, {
//   roomsCount: hotelResult?.Rooms?.length || 0
// });

// // Step 4: Return hotel details with available rooms
// return {
//   success: true,
//   searchType: 'hotel',
//   hotel: {
//     HotelCode: hotelData.HotelCode,
//     HotelName: hotelData.HotelName,
//     // Add other hotel details from API response
//     HotelPicture: hotelResult.HotelPicture,
//     HotelDescription: hotelResult.HotelDescription,
//     Address: hotelResult.Address,
//     StarRating: hotelResult.StarRating,
//     // Spread other fields from TBO API response
//     ...hotelResult
//   },
//   rooms: hotelResult.Rooms || [],
//   totalRooms: hotelResult.Rooms ? hotelResult.Rooms.length : 0
// };

//   } catch (error) {
//     logger.error('Error in searchHotelByName', { 
//       hotelName, 
//       checkIn,
//       checkOut,
//       paxRooms,
//       error: error.message,
//       stack: error.stack
//     });
//     throw error;
//   }
// };
export const searchHotelByName = async (hotelName, checkIn, checkOut, paxRooms) => {
  try {
    logger.info('Searching hotel by name', { 
      hotelName, 
      checkIn, 
      checkOut, 
      paxRooms,
      paxRoomsCount: paxRooms?.length || 0
    });

    // Validate inputs
    if (!hotelName || !checkIn || !checkOut || !paxRooms || paxRooms.length === 0) {
      throw new Error('Missing required parameters: hotelName, checkIn, checkOut, and paxRooms are required');
    }

    // Validate paxRooms structure (same as city search)
    for (let i = 0; i < paxRooms.length; i++) {
      const room = paxRooms[i];
      if (!room.hasOwnProperty('Adults') && !room.hasOwnProperty('adults')) {
        throw new Error(`paxRooms[${i}] is missing Adults field`);
      }
      const adults = room.Adults || room.adults;
      if (!adults || adults < 1) {
        throw new Error(`paxRooms[${i}] must have at least 1 adult`);
      }
    }

    // --- Debug logs for hotel name search ---
    const normalizedHotelName = hotelName.toLowerCase().replace(/\s+/g, '_');
    console.log('Searching hotel name:', hotelName);
    console.log('Normalized key:', `hotelname:${normalizedHotelName}`);
    // If you use Redis directly, you might use:
    // const hotelCodes = await redisClient.sMembers(`hotelname:${normalizedHotelName}`);
    // console.log('Hotel codes found:', hotelCodes);
    // But since you use getHotelByName, log what it returns:
    const hotelData = await getHotelByName(hotelName);
    console.log('Hotel data from cache:', hotelData);

    if (!hotelData || !hotelData.HotelCode) {
      return { 
        success: false, 
        message: `No hotel found matching "${hotelName}"` 
      };
    }

    logger.info(`Hotel found: ${hotelData.HotelName} (Code: ${hotelData.HotelCode})`);

    // Step 2: Get hotel rates using the hotel code
    const apiResponse = await searchHotelAvailability(
      [hotelData.HotelCode], // Single hotel code in array
      checkIn,
      checkOut,
      paxRooms
    );

    // Step 3: Process API response
    if (!apiResponse.HotelResult || apiResponse.HotelResult.length === 0) {
      return { 
        success: false, 
        message: `No rooms available for "${hotelData.HotelName}" for the selected dates and room configuration` 
      };
    }

    const hotelResult = apiResponse.HotelResult[0]; // Should be only one hotel

    logger.info(`Found rooms for hotel: ${hotelData.HotelName}`, {
      roomsCount: hotelResult?.Rooms?.length || 0
    });

    // Step 4: Return hotel details with available rooms
    return {
      success: true,
      searchType: 'hotel',
      hotel: {
        HotelCode: hotelData.HotelCode,
        HotelName: hotelData.HotelName,
        // Add other hotel details from API response
        HotelPicture: hotelResult.HotelPicture,
        HotelDescription: hotelResult.HotelDescription,
        Address: hotelResult.Address,
        StarRating: hotelResult.StarRating,
        // Spread other fields from TBO API response
        ...hotelResult
      },
      rooms: hotelResult.Rooms || [],
      totalRooms: hotelResult.Rooms ? hotelResult.Rooms.length : 0
    };

  } catch (error) {
    logger.error('Error in searchHotelByName', { 
      hotelName, 
      checkIn,
      checkOut,
      paxRooms,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Smart search - handles both city and hotel name searches
 * @param {string} searchText - Search text (city name or hotel name)
 * @param {string} checkIn - Check-in date (YYYY-MM-DD)
 * @param {string} checkOut - Check-out date (YYYY-MM-DD)
 * @param {Array<Object>} paxRooms - Array of room configurations
 * @returns {Promise<Object>} Search results
 */
export const searchHotelsSmart = async (searchText, checkIn, checkOut, paxRooms) => {
  try {
    logger.info('Smart hotel search initiated', { 
      searchText, 
      checkIn, 
      checkOut, 
      paxRooms,
      paxRoomsCount: paxRooms?.length || 0
    });

    if (!searchText || typeof searchText !== "string" || !checkIn || !checkOut || !Array.isArray(paxRooms)) {
      return { success: false, message: "Missing or invalid required parameters." };
    }

    const normalizedSearchText = searchText.trim().toLowerCase();

    // Step 1: First try to identify if it's a city
    const cityId = await getCityIdByName(normalizedSearchText);
    
    if (cityId) {
      // ✅ Case 1: It's a valid city - return all hotels in that city
      logger.info(`Identified "${searchText}" as a city. Fetching hotels...`);
      return await searchHotelsByCity(normalizedSearchText, checkIn, checkOut, paxRooms);
    }

    // Step 2: If not a city, treat it as a hotel name
    logger.info(`Treating "${searchText}" as a hotel name. Fetching hotel and room details...`);
    return await searchHotelByName(searchText, checkIn, checkOut, paxRooms);

  } catch (error) {
    logger.error('Error in smart hotel search', { 
      searchText, 
      checkIn,
      checkOut,
      paxRooms,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};