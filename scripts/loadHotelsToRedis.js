import redis from 'redis';
import { setupMariaDBPool, getDBPool } from '../config/database.js';

async function loadHotelsToRedis() {
  try {
    // Initialize MariaDB pool first
    await setupMariaDBPool();

    // Get the pool instance
    const db = getDBPool();

    // Query hotel data from MariaDB
    const rows = await db.query(
      'SELECT hotel_code, hotel_name, city_code, city_name FROM tbo_master_hotel_details'
    );

    console.log('Number of hotels fetched:', rows.length);

    // Setup Redis client
    const client = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
      },
    });

    await client.connect();

    for (const hotel of rows) {
      const cityCode = hotel.city_code?.toLowerCase();
      const hotelName = hotel.hotel_name?.toLowerCase().replace(/\s+/g, '_');
      const cityName = hotel.city_name?.toLowerCase().replace(/\s+/g, '_');

      if (!hotelName || !cityCode || !cityName) continue;

      // ✅ Store hotelname -> multiple hotel_codes (Set)
      // await client.del(`hotelname:${hotelName}`);
      // await client.sAdd(`hotelname:${hotelName}`, hotel.hotel_code);
       const keyType = await client.type(`hotelname:${hotelName}`);
        if (keyType !== 'set') {
          await client.del(`hotelname:${hotelName}`);
        }
        await client.sAdd(`hotelname:${hotelName}`, hotel.hotel_code);


      // Store cityname -> hotel_codes[]
      const cityKey = `cityname:${cityName}`;
      const existing = await client.get(cityKey);
      const hotelCodes = existing ? JSON.parse(existing) : [];

      if (!hotelCodes.includes(hotel.hotel_code)) {
        hotelCodes.push(hotel.hotel_code);
        await client.set(cityKey, JSON.stringify(hotelCodes));
      }
    }

    console.log('✅ Redis cache loaded with city names and hotels!');
    await client.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error loading hotels to Redis:', err);
    process.exit(1);
  }
}

loadHotelsToRedis();
