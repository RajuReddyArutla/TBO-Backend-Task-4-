const HotelModel = require('../models/HotelModel');
const TboApiService = require('../services/TboApiService');
const { validateSearchParams } = require('../utils/validator');
const logger = require('../utils/logger');

class HotelController {
  // Search for available hotels
  async searchHotels(req, res) {
    try {
      const { cityName, checkInDate, checkOutDate, rooms, nationality } = req.body;

      // Validate search parameters
      const validationResult = validateSearchParams(req.body);
      if (!validationResult.isValid) {
        logger.error('Invalid search parameters', { errors: validationResult.errors });
        return res.status(400).json({
          success: false,
          message: 'Invalid search parameters',
          errors: validationResult.errors,
        });
      }

      logger.info('Search request received', { cityName, checkInDate, checkOutDate, rooms });

      // Get hotel codes for the specified city
      const hotelCodes = await HotelModel.getHotelCodesByCity(cityName);

      if (!hotelCodes || hotelCodes.length === 0) {
        logger.warn('No hotels found for city', { cityName });
        return res.json({
          success: true,
          message: `No hotels found in ${cityName}`,
          data: [],
        });
      }

      logger.info('Hotel codes retrieved', { cityName, count: hotelCodes.length });

      // Search for available hotels using TBO API
      const searchResults = await TboApiService.searchHotels(hotelCodes, checkInDate, checkOutDate, rooms);

      // Process and format the search results
      const formattedResults = this.formatSearchResults(searchResults, nationality);

      logger.info('Hotel search completed', { cityName, resultsCount: formattedResults.length });

      return res.json({
        success: true,
        message: 'Hotel search completed successfully',
        data: formattedResults,
      });
    } catch (error) {
      logger.error('Error searching hotels', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'An error occurred while searching for hotels',
        error: error.message,
      });
    }
  }

  // Format search results
  formatSearchResults(results, nationality) {
    if (!results || !Array.isArray(results.HotelResultList)) {
      return [];
    }

    return results.HotelResultList.map((hotel) => {
      const price = this.getPriceByNationality(hotel, nationality);

      return {
        hotelCode: hotel.HotelCode,
        hotelName: hotel.HotelName,
        hotelCategory: hotel.HotelCategory,
        rating: hotel.Rating,
        address: hotel.HotelAddress,
        city: hotel.CityName,
        country: hotel.CountryName,
        price: price,
        currency: hotel.Price?.CurrencyCode || 'Unknown',
        roomTypes: this.formatRoomTypes(hotel.RoomTypes),
        amenities: hotel.HotelFacilities || [],
        images: hotel.HotelPicture ? [hotel.HotelPicture] : [],
        latitude: hotel.Latitude,
        longitude: hotel.Longitude,
        cancellationPolicies: hotel.CancellationPolicies || [],
      };
    });
  }

  // Get price based on nationality if applicable
  getPriceByNationality(hotel, nationality) {
    if (!hotel.Price) return 'Price not available';

    // Future nationality-based pricing logic can be implemented here
    return hotel.Price.OfferedPrice ?? hotel.Price.PublishedPrice;
  }

  // Format room types
  formatRoomTypes(roomTypes) {
    if (!Array.isArray(roomTypes)) {
      return [];
    }

    return roomTypes.map((room) => ({
      roomTypeCode: room.RoomTypeCode,
      roomTypeName: room.RoomTypeName,
      inclusion: room.Inclusion,
      bedType: room.BedType,
      maxOccupancy: {
        adults: room.MaxAdults,
        children: room.MaxChild,
      },
    }));
  }
}

module.exports = new HotelController();
