// models/Property.js
import mongoose from "mongoose";

export const PROPERTY_TYPES = [
  'House', 'House and Lot', 'Apartment', 'Condominium', 'Townhouse', 
  'Dormitory', 'Bedspace', 'Studio Unit', 'Lot', 'Land', 
  'Commercial Space', 'Office Space', 'Warehouse', 'Building', 
  'Bungalow', 'Duplex', 'Triplex', 'Inner Lot', 'Corner Lot'
];

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
    trim: true,
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
    enum: ['Fully Furnished', 'Semi-Furnished', 'Unfurnished', 'Brand New', 'Pre-owned / Resale', ''],
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
    trim: true,
  },
  landmarks: {
    type: String,
    default: "",
    trim: true,
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
  // Monetization for panoramic uploads
  paidForPano: {
    type: Boolean,
    default: false
  },
  // panoCount is a virtual derived from panorama360Images length
  status: {
    type: String,
    enum: ['approved', 'pending', 'rejected', 'archived'],
    default: 'approved',
    index: true
  },
  availabilityStatus: {
    type: String,
    enum: ['Available', 'Not Available'],
    default: 'Available',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save middleware for new documents
propertySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Handle propertyCondition based on listing type
  if (this.listingType === 'For Rent') {
    this.propertyCondition = '';
  } else if (this.listingType === 'For Sale' && (!this.propertyCondition || this.propertyCondition.trim() === '')) {
    this.propertyCondition = 'Brand New';
  }
  
  next();
});

// Pre-findOneAndUpdate middleware for updates - SIMPLIFIED
propertySchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // Always set updatedAt
  if (update.$set) {
    update.$set.updatedAt = Date.now();
  } else {
    this.setUpdate({ ...update, updatedAt: Date.now() });
  }
  
  next();
});

// Virtual for formatted price
propertySchema.virtual('formattedPrice').get(function() {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(this.price);
});

// Virtual for panoCount (derived from panorama360Images)
propertySchema.virtual('panoCount').get(function() {
  return (this.panorama360Images && Array.isArray(this.panorama360Images)) ? this.panorama360Images.length : 0;
});

// Virtual for full address
propertySchema.virtual('fullAddress').get(function() {
  return `${this.address}, ${this.barangay}, San Jose del Monte, Bulacan`;
});

// Indexes for better query performance
propertySchema.index({ landlord: 1 });
propertySchema.index({ status: 1, availabilityStatus: 1 });
propertySchema.index({ listingType: 1 });
propertySchema.index({ propertyType: 1 });
propertySchema.index({ barangay: 1 });
propertySchema.index({ price: 1 });
propertySchema.index({ createdAt: -1 });

// Transform output to include virtuals
propertySchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

propertySchema.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

// Static method to find available properties
propertySchema.statics.findAvailable = function(query = {}) {
  return this.find({
    ...query,
    status: 'approved',
    availabilityStatus: 'Available'
  });
};

// Instance method to check if property belongs to user
propertySchema.methods.isOwnedBy = function(userId) {
  return this.landlord.toString() === userId.toString();
};

export default mongoose.model("Property", propertySchema);