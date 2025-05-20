const { buildSchema } = require('graphql');

// Define GraphQL schema
const schema = buildSchema(`
  type Room {
    NoOfAdults: Int!
    NoOfChild: Int!
    ChildAge: [Int]
  }

  type RoomType {
    roomTypeCode: String!
    roomTypeName: String!
    inclusion: String
    bedType: String
    maxOccupancy: Occupancy
  }

  type Occupancy {
    adults: Int!
    children: Int!
  }

  type Price {
    amount: Float!
    currency: String!
  }
  
  type Hotel {
    hotelCode: String!
    hotelName: String!
    hotelCategory: String
    rating: Float
    address: String
    city: String!
    country: String
    price: String
    currency: String
    roomTypes: [RoomType]
    amenities: [String]
    images: [String]
    latitude: Float
    longitude: Float
    cancellationPolicies: [String]
  }

  input RoomInput {
    NoOfAdults: Int!
    NoOfChild: Int!
    ChildAge: [Int]
  }

  type SearchResult {
    success: Boolean!
    message: String!
    data: [Hotel]
  }

  type Query {
    searchHotels(
      cityName: String!, 
      checkInDate: String!, 
      checkOutDate: String!, 
      rooms: [RoomInput]!, 
      nationality: String
    ): SearchResult
  }
`);

module.exports = schema;