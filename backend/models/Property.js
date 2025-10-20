import mongoose from "mongoose";

const PROPERTY_TYPES = ['House','House and Lot','Apartment','Condominium','Townhouse','Dormitory','Bedspace','Studio Unit','Lot','Land','Commercial Space','Office Space','Warehouse','Building','Bungalow','Duplex','Triplex','Inner Lot','Corner Lot'];

const propertySchema = new mongoose.Schema({
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  propertyType: {
    type: String,
    required: true,
    enum: PROPERTY_TYPES,
    trim: true,
  },
  listingType: {
    type: String,
    required: true,
    enum: ["For Rent", "For Sale"],
    default: "For Rent"
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
  floorArea: {
    type: Number,
    min: 0,
    default: 0,
  },
  lotArea: {
    type: Number,
    min: 0,
    default: 0,
  },
  numberOfFloors: {
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
    enum: ['Fully Furnished','Semi-Furnished','Unfurnished','Brand New','Pre-owned / Resale', ''],
    default: ''
  },
  marketHighlights: {
    type: [String],
    default: []
  },
  occupancy: {
    type: Number,
    required: function() {
      return this.listingType === "For Rent";
    },
    default: 1,
    min: 1,
    max: 5
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

// Add pre-save middleware to handle propertyCondition based on listing type
propertySchema.pre('save', function(next) {
  // If listing type is "For Rent", clear propertyCondition
  if (this.listingType === 'For Rent') {
    this.propertyCondition = '';
  }
  // If listing type is "For Sale" and propertyCondition is empty, set a default
  if (this.listingType === 'For Sale' && (!this.propertyCondition || this.propertyCondition.trim() === '')) {
    this.propertyCondition = 'Brand New';
  }
  next();
});

propertySchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  if (update.listingType === 'For Rent') {
    update.propertyCondition = '';
  }
  
  if (update.listingType === 'For Sale' && (!update.propertyCondition || update.propertyCondition.trim() === '')) {
    update.propertyCondition = 'Brand New';
  }
  
  this.setUpdate(update);
  next();
});

export default mongoose.model("Property", propertySchema);