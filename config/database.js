import mariadb from 'mariadb';
import logger from '../utils/logger.js';

let pool;

/**
 * Setup MariaDB connection pool
 * @returns {Promise<void>}
 */
export const setupMariaDBPool = async () => {
  try {
    pool = mariadb.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'hypermiles',
      connectionLimit: 5,
      acquireTimeout: 30000
    });

    // Test the connection
    const connection = await pool.getConnection();
    logger.info('MariaDB connection established');
    connection.release();

  } catch (error) {
    logger.error('Failed to connect to the database:', { error: error.message });
    throw error;
  }
};

/**
 * Get MariaDB connection pool
 * @returns {mariadb.Pool} MariaDB connection pool
 */
export const getDBPool = () => {
  if (!pool) {
    throw new Error('MariaDB pool not initialized');
  }
  return pool;
};

/**
 * Get hotel codes for a city from database
 * @param {string} city - City name
 * @returns {Promise<Array<string>>} Array of hotel codes
 */
export const getHotelCodesFromDB = async (city) => {
  let conn;
  try {
    conn = await getDBPool().getConnection();
    const rows = await conn.query(
      'SELECT hotel_code FROM tbo_master_hotel_details WHERE city_Name = ?',
      [city]
    );

    const hotelCodes = rows.map(row => row.hotel_code); // ensure this matches your column name
    logger.info(`Retrieved ${hotelCodes.length} hotel codes for ${city} from database`);

    return hotelCodes;
  } catch (error) {
    logger.error('Failed to get hotel codes from database', { city, error: error.message });
    throw error;
  } finally {
    if (conn) conn.release();
  }
};
