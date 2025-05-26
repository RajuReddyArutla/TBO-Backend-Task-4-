// Import the TBO API function directly from your existing tboService.js file
import axios from 'axios';
import { getCachedHotelCodes, cacheHotelCodes } from '../config/redis.js';
import { getHotelCodesFromDB } from '../config/database.js';
import logger from '../utils/logger.js';

// TBO API configuration
const TBO_API_URL = 'https://affiliate.tektravels.com/HotelAPI/Search';
const TBO_USERNAME = 'Hypermiles';
const TBO_PASSWORD = 'Hypermiles@1234';

// TBO API request function - NOW EXPORTED
export const searchHotelAvailability = async (hotelCodes, checkIn, checkOut, paxRooms) => {
  try {
    logger.info('Searching hotel availability', { hotelCodes, checkIn, checkOut, paxRooms });

    const processedPaxRooms = paxRooms.map(room => {
      const Adults = room.Adults || room.adults || 1;
      const Children = room.Children || room.children || 0;
      const ChildrenAges = Children > 0 && room.ChildrenAges?.length === Children
        ? room.ChildrenAges
        : null;

      return { Adults, Children, ChildrenAges };
    });

    const payload = {
      CheckIn: checkIn,
      CheckOut: checkOut,
      HotelCodes: hotelCodes.join(','),
      GuestNationality: 'IN',
      PaxRooms: processedPaxRooms,
      ResponseTime: 23.0,
      IsDetailedResponse: true,
      Filters: {
        Refundable: false,
        NoOfRooms: 0,
        MealType: 0,
        OrderBy: 0,
        StarRating: 0,
        HotelName: ''
      }
    };

    const authString = Buffer.from(`${TBO_USERNAME}:${TBO_PASSWORD}`).toString('base64');

    const response = await axios.post(TBO_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authString}`
      },
      timeout: 30000
    });

    if (response.data?.Status?.Code !== 200) {
      throw new Error(`TBO API error: ${response.data.Status?.Description || 'Unknown error'}`);
    }

    return response.data;
  } catch (error) {
    logger.error('Error from TBO API', { message: error.message, response: error.response?.data });
    throw error;
  }
};

// Main searchHotelsByCity function
export const searchHotelsByCity = async (city, checkIn, checkOut, paxRooms) => {
  try {
    logger.info('searchHotelsByCity called', { city, checkIn, checkOut, paxRooms });

    if (!city || !checkIn || !checkOut || !Array.isArray(paxRooms) || paxRooms.length === 0) {
      throw new Error('Missing required parameters: city, checkIn, checkOut, and paxRooms must be valid');
    }

    let hotelCodes = await getCachedHotelCodes(city);
    if (!hotelCodes || hotelCodes.length === 0) {
      hotelCodes = await getHotelCodesFromDB(city);
      if (hotelCodes?.length > 0) await cacheHotelCodes(city, hotelCodes);
    }

    if (!hotelCodes || hotelCodes.length === 0) {
      logger.warn(`No hotel codes found for city ${city}`);
      return { success: false, message: `No hotel codes found for city ${city}` };
    }

    const CHUNK_SIZE = 10;
    const MAX_PARALLEL_REQUESTS = 10;
    const chunks = [];
    for (let i = 0; i < hotelCodes.length; i += CHUNK_SIZE) {
      chunks.push(hotelCodes.slice(i, i + CHUNK_SIZE));
    }

    const results = [];
    for (let i = 0; i < chunks.length; i += MAX_PARALLEL_REQUESTS) {
      const batch = chunks.slice(i, i + MAX_PARALLEL_REQUESTS);
      const promises = batch.map(chunk =>
        searchHotelAvailability(chunk, checkIn, checkOut, paxRooms)
          .then(res => res?.HotelResult || [])
          .catch(err => {
            logger.warn('TBO batch request failed', { chunk, error: err.message });
            return [];
          })
      );
      const batchResults = await Promise.all(promises);
      batchResults.forEach(res => results.push(...res));
    }

    return {
      success: true,
      total: results.length,
      results
    };
  } catch (err) {
    logger.error('searchHotelsByCity failed', { error: err.message });
    return { success: false, message: err.message };
  }
};