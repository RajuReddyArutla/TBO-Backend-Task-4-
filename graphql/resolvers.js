const HotelModel = require('../models/HotelModel');
const TboApiService = require('../services/TboApiService');
const { validateSearchParams } = require('../utils/validator');
const logger = require('../utils/logger');

// GraphQL resolvers
const resolvers = {
  searchHotels: async ({ cityName, checkInDate, checkOutDate, rooms, nationality }) => {
    try {
      // Validate search parameters
      const validationResult = validateSearchParams({ cityName, checkInDate, checkOutDate, rooms });
      if (!validationResult.isValid) {
        logger.error('Invalid search parameters', { errors: validationResult.errors });
        return { 
          success: false, 
          message: 'Invalid search parameters', 
          data: [] 
        };
      }

      logger.info('GraphQL search request received', { 
        cityName, 
        checkInDate, 
        checkOutDate, 
        rooms 
      });

      // Get hotel codes for the specified city
      const hotelCodes = await HotelModel.getHotelCodesByCity(cityName);
      
      if (!hotelCodes || hotelCodes.length === 0) {
        logger.warn('No hotels found for city', { cityName });
        return { 
          success: true, 
          message: `No hotels found in ${cityName}`, 
          data: [] 
        };
      }

      logger.info('Hotel codes retrieved', { 
        cityName, 
        count: hotelCodes.length 
      });

      // Search for available hotels using TBO API
      const searchResults = await TboApiService.searchHotels(
        hotelCodes,
        checkInDate,
        checkOutDate,
        rooms
      );

      // Process and format the search results
      const formattedResults = formatSearchResults(searchResults, nationality);
      
      logger.info('Hotel search completed', { 
        cityName, 
        resultsCount: formattedResults.length 
      });

      return {
        success: true,
        message: 'Hotel search completed successfully',
        data: formattedResults
      };
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

// Format search results (helper function)
function formatSearchResults(results, nationality) {
  if (!results || !results.HotelResultList || !Array.isArray(results.HotelResultList)) {
    return [];
  }

  return results.HotelResultList.map(hotel => {
    // Get the appropriate price based on nationality if applicable
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

// Get price based on nationality (helper function)
function getPriceByNationality(hotel, nationality) {
  if (!hotel.Price) return 'Price not available';
  
  // Apply nationality-based pricing logic here if needed
  return hotel.Price.OfferedPrice || hotel.Price.PublishedPrice;
}

// Format room types (helper function)
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