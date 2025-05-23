const HotelModel = require('../models/HotelModel');
const TboApiService = require('../services/TboApiService');
const { validateSearchParams } = require('../utils/validator');
const logger = require('../utils/logger');

// GraphQL resolvers
const resolvers = {
  searchHotels: async ({ cityName, hotelName, checkInDate, checkOutDate, rooms, nationality }) => {
    try {
      // Validate search parameters including hotelName
      const validationResult = validateSearchParams({ cityName, hotelName, checkInDate, checkOutDate, rooms });
      if (!validationResult.isValid) {
        logger.error('Invalid search parameters', { errors: validationResult.errors });
        return { 
          success: false, 
          message: 'Invalid search parameters', 
          data: [] 
        };
      }

      logger.info('GraphQL search request received', { cityName, hotelName, checkInDate, checkOutDate, rooms });

      let hotelCodes = [];

      if (hotelName) {
        // FIXED: Use correct method name and variable
        console.log('Hotel name received:', hotelName);
        hotelCodes = await HotelModel.getHotelCodesByHotelName(hotelName);
        console.log('Resolved hotelCodes:', hotelCodes);
      } else if (cityName) {
        hotelCodes = await HotelModel.getHotelCodesByCity(cityName);
      } else {
        logger.error('No search criteria provided');
        return { 
          success: false, 
          message: 'Please provide either cityName or hotelName', 
          data: [] 
        };
      }

      if (!hotelCodes || hotelCodes.length === 0) {
        const location = cityName || hotelName;
        logger.warn('No hotels found', { location });
        return { 
          success: true, 
          message: `No hotels found for "${location}"`, 
          data: [] 
        };
      }

      logger.info('Hotel codes retrieved', { count: hotelCodes.length, location: cityName || hotelName });

      // Call Tbo API service to search hotels
      // const searchResults = await TboApiService.searchHotels(
      //   hotelCodes,
      //   checkInDate,
      //   checkOutDate,
      //   rooms
      // );
      const searchResults = await TboApiService.searchHotelsByCriteria(
  { cityName, hotelName }, 
  checkInDate, 
  checkOutDate, 
  rooms, 
  nationality
);
const formattedResults = formatSearchResults(searchResults, nationality);

// Determine the message based on the TBO API response
let message = 'Hotel search completed successfully';
if (
  searchResults?.Status?.Code === 201 &&
  searchResults?.Status?.Description === 'No Available rooms for given criteria'
) {
  message = 'No Available rooms for given criteria';
  logger.warn('No rooms available for given criteria');
}

logger.info('Hotel search completed', { resultsCount: formattedResults.length });

return {
  success: true,
  message,
  data: formattedResults
};

      // const formattedResults = formatSearchResults(searchResults, nationality);

      // logger.info('Hotel search completed', { resultsCount: formattedResults.length });

      // return {
      //   success: true,
      //   message: 'Hotel search completed successfully',
      //   data: formattedResults
      // };
    } catch (error) {
      logger.error('Error in GraphQL searchHotels resolver', { error: error.message, stack: error.stack });
      return {
        success: false,
        message: 'An error occurred while searching for hotels',
        data: []
      };
    }
  }
};

// Helper function: format search results
function formatSearchResults(results, nationality) {
  if (!results || !results.HotelSearchResult || !Array.isArray(results.HotelSearchResult)) {
    return [];
  }

  return results.HotelSearchResult.map(hotel => {
    // Determine price based on nationality
    const price = getPriceByNationality(hotel, nationality);

    return {
      hotelCode: hotel.HotelCode,
      hotelName: hotel.HotelName,
      hotelCategory: hotel.HotelCategory,
      rating: hotel.Rating,
      address: hotel.HotelAddress,
      city: hotel.CityName,
      country: hotel.CountryName,
      price: price,
      currency: hotel.Price ? hotel.Price.CurrencyCode : 'Unknown',
      roomTypes: formatRoomTypes(hotel.RoomTypes),
      amenities: hotel.HotelFacilities || [],
      images: hotel.HotelPicture ? [hotel.HotelPicture] : [],
      latitude: hotel.Latitude,
      longitude: hotel.Longitude,
      cancellationPolicies: hotel.CancellationPolicies || []
    };
  });
}

// Helper function: get price based on nationality
function getPriceByNationality(hotel, nationality) {
  if (!hotel.Price) return 'Price not available';
  
  // Add nationality pricing logic here if needed
  return hotel.Price.OfferedPrice || hotel.Price.PublishedPrice;
}

// Helper function: format room types
function formatRoomTypes(roomTypes) {
  if (!roomTypes || !Array.isArray(roomTypes)) {
    return [];
  }

  return roomTypes.map(room => ({
    roomTypeCode: room.RoomTypeCode,
    roomTypeName: room.RoomTypeName,
    inclusion: room.Inclusion,
    bedType: room.BedType,
    maxOccupancy: {
      adults: room.MaxAdults,
      children: room.MaxChild
    }
  }));
}

module.exports = resolvers;