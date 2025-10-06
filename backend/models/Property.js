import mongoose from "mongoose";

const propertySchema = new mongoose.Schema({
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
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
  category: {
    type: String,
    required: true,
    enum: ["Apartment", "Dorm", "House", "Condominium", "Studio"], // Optional: Restrict category options
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
  // Number of currently available units for rent. Kept in sync with totalUnits when creating/updating.
  availableUnits: {
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
    enum: ['Available','Fully Occupied','Not Yet Ready'],
    default: 'Available',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Property", propertySchema);
