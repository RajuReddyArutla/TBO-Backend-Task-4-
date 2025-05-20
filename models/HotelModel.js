const db = require('../config/db');
const { getAsync, setAsync } = require('../config/redis');

class HotelModel {
  // Get hotel codes by city name
  async getHotelCodesByCity(cityName) {
    try {
      const cacheKey = `hotel_codes:${cityName.toLowerCase()}`;
      const cachedData = await getAsync(cacheKey);

      if (cachedData) {
        console.log(`Retrieved hotel codes for ${cityName} from cache`);
        return JSON.parse(cachedData);
      }

      console.log(`Fetching hotel codes for ${cityName} from database`);
      const query = `
        SELECT hotel_code 
        FROM tbo_master_hotel_details 
        WHERE city_name = ?
      `;

      const hotelCodes = await db.query(query, [cityName]);

      const hotelCodeArray = hotelCodes.map(hotel => hotel.hotel_code);

      if (hotelCodeArray.length > 0) {
        await setAsync(cacheKey, JSON.stringify(hotelCodeArray), 24 * 60 * 60); // 24 hours
      }

      return hotelCodeArray;
    } catch (error) {
      console.error('Error fetching hotel codes:', error);
      throw error;
    }
  }

  // Save or update hotel details in the database
  async saveHotelDetails(hotelDetails) {
    try {
      const query = `
        INSERT INTO tbo_master_hotel_details 
        (hotel_code, hotel_name, city_name, country_name, address, hotel_desc, latitude, longitude) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        hotel_name = VALUES(hotel_name),
        city_name = VALUES(city_name),
        country_name = VALUES(country_name),
        address = VALUES(address),
        hotel_desc = VALUES(hotel_desc),
        latitude = VALUES(latitude),
        longitude = VALUES(longitude)
      `;

      const result = await db.query(query, [
        hotelDetails.hotel_code,
        hotelDetails.hotel_name,
        hotelDetails.city_name,
        hotelDetails.country_name,
        hotelDetails.address,
        hotelDetails.hotel_desc,
        hotelDetails.latitude,
        hotelDetails.longitude
      ]);

      return result;
    } catch (error) {
      console.error('Error saving hotel details:', error);
      throw error;
    }
  }

  // Create the hotel details table if it doesn't exist
  async createHotelDetailsTableIfNotExists() {
    try {
      const query = `
        CREATE TABLE IF NOT EXISTS tbo_master_hotel_details (
          id INT AUTO_INCREMENT PRIMARY KEY,
          booking_source VARCHAR(100),
          unique_code VARCHAR(100),
          hotel_code VARCHAR(50) NOT NULL UNIQUE,
          country_name VARCHAR(100),
          city_name VARCHAR(100) NOT NULL,
          country_code VARCHAR(10),
          city_code VARCHAR(10),
          state VARCHAR(100),
          hotel_name VARCHAR(255) NOT NULL,
          address TEXT,
          phone_number VARCHAR(20),
          fax VARCHAR(20),
          email VARCHAR(100),
          website VARCHAR(255),
          star_rating DECIMAL(2,1),
          latitude DECIMAL(10,8),
          longitude DECIMAL(11,8),
          hotel_desc TEXT,
          room_faci TEXT,
          hotel_faci TEXT,
          attractions TEXT,
          accomodation_type_code VARCHAR(50),
          link VARCHAR(255),
          image TEXT,
          thumb_image TEXT,
          images TEXT,
          trip_adv_rating DECIMAL(3,2),
          status VARCHAR(50),
          image_status VARCHAR(50),
          chain_code VARCHAR(50),
          chain_desc TEXT,
          accommodation_code VARCHAR(50),
          near_by_location TEXT,
          license VARCHAR(100),
          exclusiveDeal BOOLEAN,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_city_name (city_name),
          INDEX idx_hotel_code (hotel_code)
        )
      `;

      await db.query(query);
      console.log('Hotel details table created or already exists');
    } catch (error) {
      console.error('Error creating hotel details table:', error);
      throw error;
    }
  }
}

module.exports = new HotelModel();
