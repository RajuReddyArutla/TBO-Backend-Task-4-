import axios from 'axios';
import logger from '../utils/logger.js';

// TBO API configuration
const TBO_API_URL = 'https://affiliate.tektravels.com/HotelAPI/Search';
const TBO_USERNAME = 'Hypermiles';
const TBO_PASSWORD = 'Hypermiles@1234';

/**
 * Search for hotel availability using TBO API
 * @param {Array<string>} hotelCodes - Array of hotel codes
 * @param {string} checkIn - Check-in date (YYYY-MM-DD)
 * @param {string} checkOut - Check-out date (YYYY-MM-DD)
 * @param {Array<Object>} paxRooms - Array of room configurations
 * @returns {Promise<Object>} TBO API response
 */
export const searchHotelAvailability = async (hotelCodes, checkIn, checkOut, paxRooms) => {
  try {
    logger.info('Searching hotel availability', { 
      hotelCodesCount: hotelCodes.length, 
      checkIn, 
      checkOut,
      paxRoomsCount: Array.isArray(paxRooms) ? paxRooms.length : 0,
      paxRooms: paxRooms // Log the actual paxRooms data
    });

    // Add this line to log actual hotel codes
    logger.info('Using hotel code(s)', { hotelCodes });

    // Process paxRooms to ensure correct format for TBO API
    const processedPaxRooms = paxRooms.map(room => {
      const adults = room.Adults || room.adults || 1;
      const children = room.Children || room.children || 0;
      const childrenAges = room.ChildrenAges || room.childrenAges || [];
      
      return {
        Adults: adults,
        Children: children,
        // Only include ChildrenAges if there are actually children
        // TBO API expects null when no children, not empty array or [0]
        ChildrenAges: children > 0 && childrenAges.length > 0 ? childrenAges : null
      };
    });

    logger.info('Processed PaxRooms', { processedPaxRooms });

    // Build request payload
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

    logger.info('TBO API Request Payload', { payload });

    // Create Basic Auth header
    const authString = Buffer.from(`${TBO_USERNAME}:${TBO_PASSWORD}`).toString('base64');

    // Make API request
    const response = await axios.post(TBO_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`
      },
      timeout: 30000 // 30 seconds timeout
    });

    logger.info('TBO API Raw Response', { 
      status: response.status,
      statusText: response.statusText,
      responseData: response.data
    });

    // Check if response has the expected structure
    if (!response.data) {
      throw new Error('TBO API returned empty response');
    }

    if (!response.data.Status) {
      logger.error('TBO API response missing Status field', { response: response.data });
      throw new Error('Invalid TBO API response format');
    }

    if (response.data.Status.Code !== 200) {
      logger.error('TBO API error', { 
        statusCode: response.data.Status.Code, 
        description: response.data.Status.Description,
        fullResponse: response.data
      });
      throw new Error(`TBO API error: ${response.data.Status.Description}`);
    }

    logger.info('Hotel availability search successful', {
      resultsCount: response.data?.HotelResult?.length || 0
    });

    return response.data;
  } catch (error) {
    // Handle different types of errors
    if (error.isAxiosError) {
      logger.error('Axios error calling TBO API', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers
      });
      
      if (error.response?.data) {
        throw new Error(`TBO API error: ${error.response.data.Status?.Description || error.response.statusText || 'Unknown API error'}`);
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error('Unable to connect to TBO API server');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('TBO API request timeout');
      } else {
        throw new Error(`Network error: ${error.message}`);
      }
    }
    
    logger.error('Failed to search hotel availability', { 
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};