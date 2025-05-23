const axios = require('axios');
const { getAsync, setAsync } = require('../config/redis');  // destructure getAsync, setAsync
const HotelModel = require('../models/HotelModel');
require('dotenv').config();

class TboApiService {
  constructor() {
    this.baseUrl = process.env.TBO_API_URL;
    this.endUserIp = process.env.END_USER_IP || '172.20.20.104';
    this.tokenId = process.env.TBO_TOKEN_ID || '';
    this.chunkSize = 100;
  }

  async getHotelCodesFromCache(cityName) {
    const data = await getAsync(`hotels:${cityName.toLowerCase()}`);  // use getAsync here
    if (!data) return null;
    return JSON.parse(data);
  }

  // NEW: Get hotel codes from cache by hotel name
  async getHotelCodesFromCacheByName(hotelName) {
    const cacheKey = `hotel_codes_by_name:${hotelName.toLowerCase()}`;
    const data = await getAsync(cacheKey);  // use getAsync here
    if (!data) return null;
    return JSON.parse(data);
  }

  // IMPROVED: Main search method with better error handling and logging
  async searchHotels(hotelCodes, checkInDate, checkOutDate, rooms, nationality = 'IN') {
    try {
      // Validate input parameters
      if (!hotelCodes || !Array.isArray(hotelCodes) || hotelCodes.length === 0) {
        throw new Error('Hotel codes are required and must be a non-empty array');
      }

      if (!checkInDate || !checkOutDate) {
        throw new Error('Check-in and check-out dates are required');
      }

      if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
        throw new Error('Rooms data is required and must be a non-empty array');
      }

      const chunks = this.chunkArray(hotelCodes, this.chunkSize);

      console.log(`Starting hotel search with ${hotelCodes.length} hotel codes in ${chunks.length} chunks`);
      console.log(' Raw rooms data received:', JSON.stringify(rooms, null, 2));
      
      // Normalize rooms data to handle both REST and GraphQL formats
      const normalizedRooms = this.normalizeRoomsData(rooms);
      console.log('Final normalized rooms:', JSON.stringify(normalizedRooms, null, 2));

      const requests = chunks.map((chunk, index) => {
        const requestData = {
          CheckIn: checkInDate,
          CheckOut: checkOutDate,
          HotelCodes: chunk.join(','),
          GuestNationality: nationality,
          PaxRooms: normalizedRooms,
          ResponseTime: 23,
          IsDetailedResponse: true,
          Filters: {
            Refundable: false,
            NoOfRooms: 0,
            MealType: 0,
            OrderBy: 0,
            StarRating: 0,
            HotelName: null
          }
        };

        console.log(` Sending batch ${index + 1}/${chunks.length} with ${chunk.length} hotel codes`);

        const start = Date.now();
        const authHeader = `Basic ${Buffer.from(`Hypermiles:Hypermiles@1234`).toString('base64')}`;

        return axios.post(`${this.baseUrl}/Search`, requestData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          timeout: 30000 // 30 second timeout
        }).then(res => {
          const duration = Date.now() - start;
          console.log(`Batch ${index + 1} succeeded with status ${res.status} in ${duration}ms`);
          
        // DEBUG: Log full response data
        console.log(` Batch ${index + 1} API response data:`, JSON.stringify(res.data, null, 2));
          // Validate response structure
          if (!res.data || !res.data.HotelSearchResult) {
          const statusMsg = res.data?.Status?.Description || 'Invalid response structure';
          console.warn(` Batch ${index + 1}: ${statusMsg}`);
          return { HotelSearchResult: [] };
        }

          
          return res.data;
        }).catch(err => {
          const duration = Date.now() - start;
          console.error(`Batch ${index + 1} failed after ${duration}ms`);
          
          if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Response Body:', JSON.stringify(err.response.data, null, 2));
          } else if (err.request) {
            console.error('No response received - timeout or network error');
          } else {
            console.error('Error message:', err.message);
          }
          
          // Return empty result instead of null to avoid breaking the combination
          return { HotelSearchResult: [] };
        });
      });

      const results = await Promise.all(requests);
      const combined = results
        .filter(result => result && result.HotelSearchResult)
        .flatMap(r => r.HotelSearchResult || []);

      console.log(` Hotel search completed. Total results: ${combined.length}`);

      return {
        HotelSearchResult: combined
      };
    } catch (error) {
      console.error(' TBO HotelSearch API Error:', error.message);
      throw error;
    }
  }

  // NEW: Normalize rooms data to handle both formats
  normalizeRoomsData(rooms) {
    return rooms.map((room, index) => {
      // Handle both GraphQL (NoOfAdults, NoOfChild, ChildAge) and REST (adults, children, childrenAges) formats
      const normalizedRoom = {
        Adults: room.NoOfAdults || room.adults || 1,
        Children: room.NoOfChild || room.children || 0,
        ChildrenAges: room.ChildAge || room.childrenAges || []
      };
      
      console.log(` Room ${index + 1} normalized:`, normalizedRoom);
      
      // Validation
      if (normalizedRoom.Adults < 1) {
        console.warn(` Room ${index + 1} has invalid adults count (${normalizedRoom.Adults}), defaulting to 1`);
        normalizedRoom.Adults = 1;
      }
      
      if (normalizedRoom.Children > 0 && normalizedRoom.ChildrenAges.length !== normalizedRoom.Children) {
        console.warn(` Room ${index + 1}: Children count (${normalizedRoom.Children}) doesn't match ages array length (${normalizedRoom.ChildrenAges.length})`);
      }
      
      return normalizedRoom;
    });
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // IMPROVED: Get hotel details by city with better error handling
  async getHotelDetailsByCity(cityName, checkInDate, checkOutDate, rooms, nationality = 'IN') {
    try {
      console.log('Getting hotel details by city:', cityName);
      
      if (!rooms || rooms.length === 0) {
        throw new Error('Rooms data is required');
      }

      // Try cache first
      let hotelCodes = await this.getHotelCodesFromCache(cityName);
      
      // If not in cache, try database
      if (!hotelCodes || hotelCodes.length === 0) {
        console.log('Cache miss, fetching from database...');
        hotelCodes = await HotelModel.getHotelCodesByCity(cityName);
      }

      if (!hotelCodes || hotelCodes.length === 0) {
        throw new Error(`No hotel codes found for city: ${cityName}`);
      }

      return this.searchHotels(hotelCodes, checkInDate, checkOutDate, rooms, nationality);
    } catch (error) {
      console.error('Error in getHotelDetailsByCity:', error.message);
      throw error;
    }
  }

  // IMPROVED: Get hotel details by hotel name with better logic
  async getHotelDetailsByHotelName(hotelName, checkInDate, checkOutDate, rooms, nationality = 'IN') {
    try {
      console.log(' Getting hotel details by hotel name:', hotelName);
      
      if (!rooms || rooms.length === 0) {
        throw new Error('Rooms data is required');
      }

      if (!hotelName || typeof hotelName !== 'string' || hotelName.trim() === '') {
        throw new Error('Hotel name is required');
      }

      // Try cache first
      let hotelCodes = await this.getHotelCodesFromCacheByName(hotelName);
      
      // If not in cache, try database
      if (!hotelCodes || hotelCodes.length === 0) {
        console.log('Cache miss, fetching from database...');
        hotelCodes = await HotelModel.getHotelCodesByHotelName(hotelName);
      }

      if (!hotelCodes || hotelCodes.length === 0) {
        throw new Error(`No matching hotel codes found for hotel name: ${hotelName}`);
      }

      console.log(`Found ${hotelCodes.length} hotel codes for "${hotelName}"`);
      return this.searchHotels(hotelCodes, checkInDate, checkOutDate, rooms, nationality);
    } catch (error) {
      console.error('Error in getHotelDetailsByHotelName:', error.message);
      throw error;
    }
  }

  // NEW: Generic search method that can handle both city and hotel name
  async searchHotelsByCriteria(searchCriteria, checkInDate, checkOutDate, rooms, nationality = 'IN') {
    const { cityName, hotelName } = searchCriteria;
    
    if (hotelName) {
      return this.getHotelDetailsByHotelName(hotelName, checkInDate, checkOutDate, rooms, nationality);
    } else if (cityName) {
      return this.getHotelDetailsByCity(cityName, checkInDate, checkOutDate, rooms, nationality);
    } else {
      throw new Error('Either cityName or hotelName must be provided');
    }
  }
}

module.exports = new TboApiService();
