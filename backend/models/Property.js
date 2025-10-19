import mongoose from "mongoose";

const PROPERTY_TYPES = ['House','House and Lot','Apartment','Condominium','Townhouse','Dormitory','Bedspace','Studio Unit','Lot','Land','Commercial Space','Office Space','Warehouse','Building','Bungalow','Duplex','Triplex','Inner Lot','Corner Lot'];

const propertySchema = new mongoose.Schema({
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
    enum: PROPERTY_TYPES,
    trim: true,
  },
  address: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  barangay: {
    type: String,
    required: true,
  },
  propertyType: {
    type: String,
    required: true,
    enum: ["For Rent", "For Sale"],
    default: "For Rent"
  },
  numberOfRooms: {
    type: Number,
    min: 0,
    default: 0,
  },
  areaSqm: {
    type: Number,
    min: 0,
    default: 0,
  },
  petFriendly: {
    type: Boolean,
    default: false,
  },
  allowedPets: {
    type: [String],
    default: []
  },
  billsIncluded: {
    type: [String],
    default: []
  },
  propertyCondition: {
    type: String,
    enum: ['Fully Furnished','Semi-Furnished','Unfurnished','Brand New','Pre-owned / Resale'],
    default: ''
  },
  marketHighlights: {
    type: [String],
    default: []
  },
  occupancy: {
    type: Number,
    required: true,
    default: 1, 
  },
  parking: {
    type: Boolean,
    default: false,
  },
  rules: {
    type: String,
    default: "",
  },
  landmarks: {
    type: String,
    default: "",
  },
  images: {
    type: [String],
    default: [],
  },
  latitude: {
    type: Number,
    default: null,
  },
  longitude: {
    type: Number,
    default: null,
  },
  video: {
    type: String,
    default: "",
  },
  panorama360: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    enum: ['approved','pending','rejected','archived'],
    default: 'approved',
    index: true
  },
  availabilityStatus: {
    type: String,
    enum: ['Available','Not Available'],
    default: 'Available',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Property", propertySchema);