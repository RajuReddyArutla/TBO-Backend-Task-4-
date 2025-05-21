import { 
  GraphQLObjectType, 
  GraphQLString, 
  GraphQLList, 
  GraphQLInt, 
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLSchema,
  GraphQLNonNull
} from 'graphql';
import { searchHotelsByCity } from '../controllers/hotelController.js';

// Types
const RoomType = new GraphQLObjectType({
  name: 'Room',
  fields: () => ({
    Name: { type: new GraphQLList(GraphQLString) },
    BookingCode: { type: GraphQLString },
    Inclusion: { type: GraphQLString },
    TotalFare: { type: GraphQLFloat },
    TotalTax: { type: GraphQLFloat },
    MealType: { type: GraphQLString },
    IsRefundable: { type: GraphQLBoolean },
    CancelPolicies: { type: new GraphQLList(CancelPolicyType) },
    RoomPromotion: { type: new GraphQLList(GraphQLString) }
  })
});

const CancelPolicyType = new GraphQLObjectType({
  name: 'CancelPolicy',
  fields: () => ({
    FromDate: { type: GraphQLString },
    ChargeType: { type: GraphQLString },
    CancellationCharge: { type: GraphQLFloat }
  })
});

const HotelResultType = new GraphQLObjectType({
  name: 'HotelResult',
  fields: () => ({
    HotelCode: { type: GraphQLString },
    Currency: { type: GraphQLString },
    Rooms: { type: new GraphQLList(RoomType) }
  })
});

const SearchResultType = new GraphQLObjectType({
  name: 'SearchResult',
  fields: () => ({
    success: { type: GraphQLBoolean },
    message: { type: GraphQLString },
    results: { type: new GraphQLList(HotelResultType) }
  })
});

const PaxRoomInputType = new GraphQLObjectType({
  name: 'PaxRoomInput',
  fields: () => ({
    Adults: { type: GraphQLInt },
    Children: { type: GraphQLInt },
    ChildrenAges: { type: new GraphQLList(GraphQLInt) }
  })
});

// Root Query
const RootQuery = new GraphQLObjectType({
  name: 'RootQueryType',
  fields: {
    searchHotels: {
      type: SearchResultType,
      args: {
        city: { type: new GraphQLNonNull(GraphQLString) },
        checkIn: { type: new GraphQLNonNull(GraphQLString) },
        checkOut: { type: new GraphQLNonNull(GraphQLString) },
        adults: { type: new GraphQLNonNull(GraphQLInt) },
        children: { type: GraphQLInt }
      },
      resolve: async (parent, args) => {
        const { city, checkIn, checkOut, adults, children = 0 } = args;
        
        // Create PaxRooms array
        const paxRooms = [{
          Adults: adults,
          Children: children,
          ChildrenAges: null
        }];
        
        return await searchHotelsByCity(city, checkIn, checkOut, paxRooms);
      }
    }
  }
});

export default new GraphQLSchema({
  query: RootQuery
});