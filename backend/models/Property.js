import mongoose from "mongoose";

const PROPERTY_TYPES = ['House','House and Lot','Apartment','Condominium','Townhouse','Dormitory','Bedspace','Studio Unit','Lot','Land','Commercial Space','Office Space','Warehouse','Building','Bungalow','Duplex','Triplex','Inner Lot','Corner Lot'];

const propertySchema = new mongoose.Schema({
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // `title` stores the enumerated property kind (e.g. House, Apartment, Lot).
  // This is intentionally separate from `propertyType` which stores the listing type (For Rent / For Sale).
  title: {
    type: String,
    required: true,
    enum: PROPERTY_TYPES,
    trim: true,
  },
  description: {
    type: String,
    required: true,
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
    default: 0, // 0 can represent studio / open layout
  },
  areaSqm: {
    type: Number,
    min: 0,
    default: 0,
  },
  // Unit counts for multi-unit properties (e.g., dorms, apartments with multiple rentable units)
  totalUnits: {
    type: Number,
    min: 0,
    default: 1,
  },
  petFriendly: {
    type: Boolean,
    default: false,
  },
  allowedPets: {
    type: String,
    default: "",
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
    type: [String], // Storing image URLs
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
  // Optional single video clip for the property (e.g. walkthrough) – stored as relative path like /uploads/properties/12345.mp4
  video: {
    type: String,
    default: "",
  },
  // Optional 360 panoramic image (equirectangular)
  panorama360: {
    type: String,
    default: "",
  },
  // Admin workflow status (approved/pending/rejected) - kept separate from availability remark
  status: {
    type: String,
    enum: ['approved','pending','rejected','archived'],
    default: 'approved',
    index: true
  },
  // Human-facing availability remark controlled by landlord: Available / Fully Occupied / Not Yet Ready
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
