const axios = require('axios');
const redisClient = require('../config/redis');
require('dotenv').config();

class TboApiService {
  constructor() {
    this.baseUrl = process.env.TBO_API_URL;
    this.endUserIp = process.env.END_USER_IP || '172.20.20.104';
  }

  async getHotelCodesFromCache(cityName) {
    const data = await redisClient.get(`hotels:${cityName.toLowerCase()}`);
    if (!data) return null;
    return JSON.parse(data);
  }

  async searchHotels(hotelCodes, checkInDate, checkOutDate, rooms) {
    try {
      const requestData = {
        EndUserIp: this.endUserIp,
        ResultCount: 0,
        HotelCodes: hotelCodes,
        CheckInDate: checkInDate,
        CheckOutDate: checkOutDate,
        Rooms: rooms,
        MaxRating: 5,
        MinRating: 0,
        ReviewScore: 0,
        IsNearBySearchAllowed: false
      };

      console.log('TBO HotelSearch payload:', requestData);

      const response = await axios.post(`${this.baseUrl}/Search`, requestData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('TBO HotelSearch API Error:', error.message);
      throw error;
    }
  }

  async getHotelDetailsByCity(cityName, checkInDate, checkOutDate, rooms) {
    const hotelCodes = await this.getHotelCodesFromCache(cityName);
    if (!hotelCodes || hotelCodes.length === 0) {
      throw new Error(`No hotel codes found for city: ${cityName}`);
    }
    return this.searchHotels(hotelCodes, checkInDate, checkOutDate, rooms);
  }
}

module.exports = new TboApiService();
