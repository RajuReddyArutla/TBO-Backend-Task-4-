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
      paxRoomsCount: paxRooms.length
    });

    //  Add this line to log actual hotel codes
    logger.info('Using hotel code(s)', { hotelCodes });

    // Build request payload
    const payload = {
      //  "CheckIn": "2025-06-20",
      //     "CheckOut": "2025-06-22",
      //     "HotelCodes": "1279415",
      //     "GuestNationality": "IN",
      //     "PaxRooms": [
      //       {
      //         "Adults": 1,
      //         "Children": 0,
      //         "ChildrenAges": null
      //       }
      //     ],
      //     "ResponseTime": 23.0,
      //     "IsDetailedResponse": true,
      //     "Filters": {
      //       "Refundable": false,
      //       "NoOfRooms": 0,
      //       "MealType": 0,
      //       "OrderBy": 0,
      //       "StarRating": 0,
      //       "HotelName": null
      CheckIn: checkIn,
      CheckOut: checkOut,
      HotelCodes: hotelCodes.join(','),
      GuestNationality: 'IN',
      PaxRooms: paxRooms,
      ResponseTime: 23,
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

    if (response.data?.Status?.Code !== 200) {
      logger.error('TBO API error', { 
        statusCode: response.data.Status.Code, 
        description: response.data.Status.Description 
      });
      throw new Error(`TBO API error: ${response.data.Status.Description}`);
    }

    // if (response.data.Status.Code === 201) {
    //   logger.warn('No available rooms', {
    //     hotelCodes,
    //     checkIn,
    //     checkOut
    //   });
    //   return { HotelResult: [] }; // or return null
    // }


    logger.info('Hotel availability search successful', {
      resultsCount: response.data?.HotelResult?.length || 0
    });

    return response.data;
  } catch (error) {
    logger.error('Failed to search hotel availability', { 
      error: error.message 
    });
    throw error;
  }
};
