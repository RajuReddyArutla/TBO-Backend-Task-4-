const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/HotelController');

/**
 * @route   POST /api/hotels/search
 * @desc    Search for available hotels based on criteria
 * @access  Public
 */
router.post('/search', hotelController.searchHotels.bind(hotelController));

module.exports = router;
