const moment = require('moment');

/**
 * Validates the hotel search parameters
 * @param {Object} params - The search parameters
 * @returns {Object} Validation result with isValid flag and errors
 */
function validateSearchParams(params) {
  const { cityName, hotelName, checkInDate, checkOutDate, rooms } = params;
  const errors = [];

  // Validate that at least one search criteria is provided
  if (!cityName && !hotelName) {
    errors.push('Either city name or hotel name must be provided');
  }

  // Validate cityName only if provided
  if (cityName !== undefined && (typeof cityName !== 'string' || cityName.trim() === '')) {
    errors.push('City name must be a non-empty string if provided');
  }

  // Validate hotelName only if provided
  if (hotelName !== undefined && (typeof hotelName !== 'string' || hotelName.trim() === '')) {
    errors.push('Hotel name must be a non-empty string if provided');
  }

  // Validate check-in date
  if (!checkInDate) {
    errors.push('Check-in date is required');
  } else if (!isValidDate(checkInDate)) {
    errors.push('Invalid check-in date format. Use YYYY-MM-DD');
  } else if (moment(checkInDate).isBefore(moment().startOf('day'))) {
    errors.push('Check-in date cannot be in the past');
  }

  // Validate check-out date
  if (!checkOutDate) {
    errors.push('Check-out date is required');
  } else if (!isValidDate(checkOutDate)) {
    errors.push('Invalid check-out date format. Use YYYY-MM-DD');
  } else if (
    isValidDate(checkInDate) && 
    isValidDate(checkOutDate) && 
    moment(checkOutDate).isSameOrBefore(moment(checkInDate))
  ) {
    errors.push('Check-out date must be after check-in date');
  }

  // Validate rooms
  if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
    errors.push('At least one room is required');
  } else {
    // Validate each room - handle both GraphQL and REST API formats
    rooms.forEach((room, index) => {
      // Handle both NoOfAdults (GraphQL) and adults (REST) formats
      const adultsCount = room.NoOfAdults || room.adults || 0;
      const childrenCount = room.NoOfChild || room.children || 0;
      const childrenAges = room.ChildAge || room.childrenAges || [];

      if (!adultsCount || adultsCount < 1) {
        errors.push(`Room ${index + 1}: At least one adult is required`);
      }
      
      if (childrenCount > 0 && (!childrenAges || !Array.isArray(childrenAges))) {
        errors.push(`Room ${index + 1}: Child ages are required when children are present`);
      } else if (childrenCount > 0) {
        if (childrenAges.length !== childrenCount) {
          errors.push(`Room ${index + 1}: Number of child ages must match number of children`);
        }
        
        childrenAges.forEach((age, ageIndex) => {
          if (typeof age !== 'number' || age < 0 || age > 17) {
            errors.push(`Room ${index + 1}: Child ${ageIndex + 1} age must be a number between 0 and 17`);
          }
        });
      }

      // Validate maximum occupancy per room
      if (adultsCount + childrenCount > 6) {
        errors.push(`Room ${index + 1}: Maximum 6 guests per room allowed`);
      }
    });
  }

  // Validate maximum stay duration (optional business rule)
  if (isValidDate(checkInDate) && isValidDate(checkOutDate)) {
    const nights = calculateNights(checkInDate, checkOutDate);
    if (nights > 30) {
      errors.push('Maximum stay duration is 30 nights');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Checks if a string is a valid date in YYYY-MM-DD format
 * @param {string} dateString - The date string to validate
 * @returns {boolean} Whether the date is valid
 */
function isValidDate(dateString) {
  if (!dateString) return false;
  
  // Check format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  
  // Check if it's a valid date
  const date = moment(dateString, 'YYYY-MM-DD', true);
  return date.isValid();
}

/**
 * Calculates the number of nights between two dates
 * @param {string} checkInDate - Check-in date (YYYY-MM-DD)
 * @param {string} checkOutDate - Check-out date (YYYY-MM-DD)
 * @returns {number} Number of nights
 */
function calculateNights(checkInDate, checkOutDate) {
  if (!isValidDate(checkInDate) || !isValidDate(checkOutDate)) {
    return 0;
  }
  
  const checkIn = moment(checkInDate);
  const checkOut = moment(checkOutDate);
  
  return checkOut.diff(checkIn, 'days');
}

/**
 * Normalizes room data to handle both REST and GraphQL formats
 * @param {Array} rooms - Array of room objects
 * @returns {Array} Normalized room data
 */
function normalizeRoomData(rooms) {
  if (!Array.isArray(rooms)) return [];
  
  return rooms.map(room => ({
    adults: room.NoOfAdults || room.adults || 1,
    children: room.NoOfChild || room.children || 0,
    childrenAges: room.ChildAge || room.childrenAges || []
  }));
}

module.exports = {
  validateSearchParams,
  isValidDate,
  calculateNights,
  normalizeRoomData
};