// models/Property.js
import mongoose from "mongoose";

export const PROPERTY_TYPES = ['House','House and Lot','Apartment','Condominium','Townhouse','Dormitory','Bedspace','Studio Unit','Lot','Land','Commercial Space','Office Space','Warehouse','Building','Bungalow','Duplex','Triplex','Inner Lot','Corner Lot'];

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
    max: 5,
    default: 0,
  },
  areaSqm: {
    type: Number,
    min: 0.1,
    default: 0,
  },
  floorArea: {
    type: Number,
    min: 0.1,
    required: true,
  },
  lotArea: {
    type: Number,
    min: 0.1,
    required: true,
  },
  numberOfFloors: {
    type: Number,
    min: 1,
    max: 5,
    required: true,
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
    validate: {
      validator: function(images) {
        return images.length <= 8;
      },
      message: 'Maximum of 8 images allowed'
    }
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
  panorama360Images: {
    type: [String],
    default: [],
    validate: {
      validator: function(images) {
        return images.length <= 5;
      },
      message: 'Maximum of 5 panoramic images allowed'
    }
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

// Enhanced pre-save middleware
propertySchema.pre('save', function(next) {
  // Clean up numeric fields
  if (this.floorArea && typeof this.floorArea === 'string') {
    this.floorArea = parseFloat(this.floorArea.toString().replace(/,/g, ''));
  }
  if (this.lotArea && typeof this.lotArea === 'string') {
    this.lotArea = parseFloat(this.lotArea.toString().replace(/,/g, ''));
  }
  if (this.numberOfFloors && typeof this.numberOfFloors === 'string') {
    this.numberOfFloors = parseInt(this.numberOfFloors.toString().replace(/,/g, ''), 10);
  }

  // Handle propertyCondition based on listing type
  if (this.listingType === 'For Rent') {
    this.propertyCondition = '';
  } else if (this.listingType === 'For Sale' && (!this.propertyCondition || this.propertyCondition.trim() === '')) {
    this.propertyCondition = 'Brand New';
  }
  
  next();
});

propertySchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // Clean up numeric fields in update
  if (update.$set) {
    if (update.$set.floorArea && typeof update.$set.floorArea === 'string') {
      update.$set.floorArea = parseFloat(update.$set.floorArea.toString().replace(/,/g, ''));
    }
    if (update.$set.lotArea && typeof update.$set.lotArea === 'string') {
      update.$set.lotArea = parseFloat(update.$set.lotArea.toString().replace(/,/g, ''));
    }
    if (update.$set.numberOfFloors && typeof update.$set.numberOfFloors === 'string') {
      update.$set.numberOfFloors = parseInt(update.$set.numberOfFloors.toString().replace(/,/g, ''), 10);
    }
  }
  
  if (update.listingType === 'For Rent') {
    update.propertyCondition = '';
  } else if (update.listingType === 'For Sale' && (!update.propertyCondition || update.propertyCondition.trim() === '')) {
    update.propertyCondition = 'Brand New';
  }
  
  this.setUpdate(update);
  next();
});

export default mongoose.model("Property", propertySchema);