import { searchHotelsByCity, searchHotelByName, searchHotelsSmart } from '../services/hotelService.js';
import logger from '../utils/logger.js';

/**
 * Search hotels by city
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const searchHotelsByCityController = async (req, res) => {
  try {
    const { city, checkIn, checkOut, paxRooms } = req.body;
    
    logger.info('Hotel search by city request received', { 
      city, 
      checkIn, 
      checkOut, 
      paxRooms 
    });

    // Validate required fields
    if (!city || !checkIn || !checkOut || !paxRooms) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: city, checkIn, checkOut, and paxRooms are required'
      });
    }

    if (!Array.isArray(paxRooms) || paxRooms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'paxRooms must be a non-empty array'
      });
    }

    const result = await searchHotelsByCity(city, checkIn, checkOut, paxRooms);
    
    if (result.success) {
      res.json({
        success: true,
        searchType: 'city',
        city: city,
        data: result.results,
        totalResults: result.totalResults,
        message: `Found ${result.totalResults} hotels in ${city}`
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    logger.error('Error in searchHotelsByCityController', { 
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while searching hotels by city'
    });
  }
};

/**
 * Search hotel by name
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const searchHotelByNameController = async (req, res) => {
  try {
    const { hotelName, checkIn, checkOut, paxRooms } = req.body;
    
    logger.info('Hotel search by name request received', { 
      hotelName, 
      checkIn, 
      checkOut, 
      paxRooms 
    });

    // Validate required fields
    if (!hotelName || !checkIn || !checkOut || !paxRooms) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: hotelName, checkIn, checkOut, and paxRooms are required'
      });
    }

    if (!Array.isArray(paxRooms) || paxRooms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'paxRooms must be a non-empty array'
      });
    }

    const result = await searchHotelByName(hotelName, checkIn, checkOut, paxRooms);
    
    if (result.success) {
      res.json({
        success: true,
        searchType: 'hotel',
        hotelName: hotelName,
        hotel: result.hotel,
        rooms: result.rooms,
        totalRooms: result.totalRooms,
        message: `Found ${result.totalRooms} rooms for ${result.hotel.HotelName}`
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    logger.error('Error in searchHotelByNameController', { 
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while searching hotel by name'
    });
  }
};

/**
 * Smart search - handles both city and hotel name searches
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const smartSearchController = async (req, res) => {
  try {
    const { searchText, checkIn, checkOut, paxRooms } = req.body;
    
    logger.info('Smart search request received', { 
      searchText, 
      checkIn, 
      checkOut, 
      paxRooms 
    });

    // Validate required fields
    if (!searchText || !checkIn || !checkOut || !paxRooms) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: searchText, checkIn, checkOut, and paxRooms are required'
      });
    }

    if (!Array.isArray(paxRooms) || paxRooms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'paxRooms must be a non-empty array'
      });
    }

    const result = await searchHotelsSmart(searchText, checkIn, checkOut, paxRooms);
    
    if (result.success) {
      if (result.searchType === 'city') {
        // City search result
        res.json({
          success: true,
          searchType: 'city',
          searchText: searchText,
          data: result.results,
          totalResults: result.totalResults,
          message: `Found ${result.totalResults} hotels in ${searchText}`
        });
      } else {
        // Hotel search result
        res.json({
          success: true,
          searchType: 'hotel',
          searchText: searchText,
          hotel: result.hotel,
          rooms: result.rooms,
          totalRooms: result.totalRooms,
          message: `Found ${result.totalRooms} rooms for ${result.hotel.HotelName}`
        });
      }
    } else {
      res.status(404).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    logger.error('Error in smartSearchController', { 
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while performing smart search'
    });
  }
};

// Keep your existing controller for backward compatibility
export const searchHotelsController = smartSearchController;