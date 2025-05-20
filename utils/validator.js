const moment = require('moment');

/**
 * Validates the hotel search parameters
 * @param {Object} params - The search parameters
 * @returns {Object} Validation result with isValid flag and errors
 */
function validateSearchParams(params) {
  const { cityName, checkInDate, checkOutDate, rooms } = params;
  const errors = [];

  // Validate city name
  if (!cityName || typeof cityName !== 'string' || cityName.trim() === '') {
    errors.push('City name is required');
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
    // Validate each room
    rooms.forEach((room, index) => {
      if (!room.NoOfAdults || room.NoOfAdults < 1) {
        errors.push(`Room ${index + 1}: At least one adult is required`);
      }
      
      if (room.NoOfChild > 0 && (!room.ChildAge || !Array.isArray(room.ChildAge))) {
        errors.push(`Room ${index + 1}: Child ages are required when children are present`);
      } else if (room.NoOfChild > 0) {
        if (room.ChildAge.length !== room.NoOfChild) {
          errors.push(`Room ${index + 1}: Number of child ages must match number of children`);
        }
        
        room.ChildAge.forEach((age, ageIndex) => {
          if (age < 0 || age > 17) {
            errors.push(`Room ${index + 1}: Child ${ageIndex + 1} age must be between 0 and 17`);
          }
        });
      }
    });
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

module.exports = {
  validateSearchParams,
  isValidDate,
  calculateNights
};