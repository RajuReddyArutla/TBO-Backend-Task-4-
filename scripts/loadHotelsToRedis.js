const redis = require('redis');
const db = require('../config/database.js').getDBPool();

async function loadHotelsToRedis() {
  try {
    const [rows] = await db.query(
      'SELECT hotel_code, hotel_name, city_code, city_name FROM tbo_master_hotel_details'
    );

    const client = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      },
    });

    await client.connect();

    for (const hotel of rows) {
      const hotelName = hotel.hotel_name?.toLowerCase();
      const cityCode = hotel.city_code?.toLowerCase();
      const cityName = hotel.city_name?.toLowerCase();

      if (!hotelName || !cityCode || !cityName) continue;

      // Store hotelname -> hotel_code
      await client.set(`hotelname:${hotelName}`, hotel.hotel_code);

      // Store cityname -> hotel_codes[]
      const cityKey = `cityname:${cityName}`;
      const existing = await client.get(cityKey);
      const hotelCodes = existing ? JSON.parse(existing) : [];

      if (!hotelCodes.includes(hotel.hotel_code)) {
        hotelCodes.push(hotel.hotel_code);
        await client.set(cityKey, JSON.stringify(hotelCodes));
      }
    }

    console.log(' Redis cache loaded with city names and hotels!');
    await client.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(' Error loading hotels to Redis:', err);
    process.exit(1);
  }
}

loadHotelsToRedis();