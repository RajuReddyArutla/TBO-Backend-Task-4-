const axios = require('axios');
const redisClient = require('../config/redis');
require('dotenv').config();

class TboApiService {
  constructor() {
    this.baseUrl = process.env.TBO_API_URL;
    this.endUserIp = process.env.END_USER_IP || '172.20.20.104';
    this.tokenId = process.env.TBO_TOKEN_ID || '';
    this.chunkSize = 100;
  }

  async getHotelCodesFromCache(cityName) {
    const data = await redisClient.get(`hotels:${cityName.toLowerCase()}`);
    if (!data) return null;
    return JSON.parse(data);
  }

  // ✅ Accept nationality as parameter
  async searchHotels(hotelCodes, checkInDate, checkOutDate, rooms, nationality = 'IN') {
    try {
      const chunks = this.chunkArray(hotelCodes, this.chunkSize);

      if (chunks.length === 0) {
        console.warn('⚠️ No hotel codes found to process.');
        return { HotelSearchResult: [] };
      }

      // ✅ Add validation and debugging for rooms
      console.log('🏠 Raw rooms data received:', JSON.stringify(rooms, null, 2));
      
      // ✅ Validate and normalize rooms data
      const normalizedRooms = rooms.map((room, index) => {
        const normalizedRoom = {
          Adults: room.adults || room.Adults || 1, // ✅ Handle both cases + default to 1
          Children: room.children || room.Children || 0,
          ChildrenAges: room.childrenAges || room.ChildrenAges || []
        };
        
        console.log(`🏠 Room ${index + 1} normalized:`, normalizedRoom);
        
        // ✅ Validation
        if (normalizedRoom.Adults < 1) {
          console.warn(`⚠️ Room ${index + 1} has invalid adults count (${normalizedRoom.Adults}), defaulting to 1`);
          normalizedRoom.Adults = 1;
        }
        
        return normalizedRoom;
      });

      console.log('🏠 Final normalized rooms:', JSON.stringify(normalizedRooms, null, 2));

      const requests = chunks.map((chunk, index) => {
        const requestData = {
          CheckIn: checkInDate,
          CheckOut: checkOutDate,
          HotelCodes: chunk.join(','),
          GuestNationality: nationality,
          PaxRooms: normalizedRooms, // ✅ Use normalized rooms
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

        console.log(`➡️ Sending batch ${index + 1}/${chunks.length} with ${chunk.length} hotel codes`);
        console.log(`🧾 Request payload for batch ${index + 1}:`, JSON.stringify(requestData, null, 2));

        const start = Date.now();
        const authHeader = `Basic ${Buffer.from(`Hypermiles:Hypermiles@1234`).toString('base64')}`;

        return axios.post(`${this.baseUrl}/Search`, requestData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          }
        }).then(res => {
          const duration = Date.now() - start;
          console.log(`✅ Batch ${index + 1} succeeded with status ${res.status} in ${duration}ms`);
          console.log('📦 Response:', JSON.stringify(res.data, null, 2));
          return res.data;
        }).catch(err => {
          const duration = Date.now() - start;
          console.error(`❌ Batch ${index + 1} failed after ${duration}ms`);
          if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Response Body:', JSON.stringify(err.response.data, null, 2));
          } else if (err.request) {
            console.error('No response received. Request:', err.request);
          } else {
            console.error('Error message:', err.message);
          }
          return null;
        });
      });

      const results = await Promise.all(requests);

      const combined = results.filter(Boolean).flatMap(r => r.HotelSearchResult || []);

      console.log(`✅ Hotel search completed. Total results: ${combined.length}`);

      return {
        HotelSearchResult: combined
      };
    } catch (error) {
      console.error('❌ TBO HotelSearch API Error:', error.message);
      throw error;
    }
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async getHotelDetailsByCity(cityName, checkInDate, checkOutDate, rooms, nationality = 'IN') {
    // ✅ Add validation before calling searchHotels
    console.log('🏠 Rooms received in getHotelDetailsByCity:', JSON.stringify(rooms, null, 2));
    
    if (!rooms || rooms.length === 0) {
      throw new Error('Rooms data is required');
    }

    const hotelCodes = await this.getHotelCodesFromCache(cityName);
    if (!hotelCodes || hotelCodes.length === 0) {
      throw new Error(`No hotel codes found for city: ${cityName}`);
    }
    return this.searchHotels(hotelCodes, checkInDate, checkOutDate, rooms, nationality);
  }
}

module.exports = new TboApiService();