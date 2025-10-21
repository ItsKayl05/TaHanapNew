import multer from "multer";
import mongoose from 'mongoose';
import Property, { PROPERTY_TYPES } from "../models/Property.js";
import User from "../models/User.js";
import { uploadBuffer, extractPublicId } from '../utils/cloudinary.js';

const MAX_IMAGES = 8;
const MAX_PANORAMAS = 5;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

// Configuration
const config = {
  limits: {
    images: MAX_IMAGES,
    panoramas: MAX_PANORAMAS,
    imageSize: MAX_IMAGE_SIZE,
    videoSize: MAX_VIDEO_SIZE
  },
  allowedVideoTypes: ['video/mp4', 'video/webm', 'video/ogg'],
  allowedAvailability: ['Available', 'Not Available'],
  allowedStatus: ['approved', 'pending', 'rejected', 'archived']
};

// Multer configuration
const memoryUpload = multer({
  storage: multer.memoryStorage(),
    // Increase limits to be more forgiving for large uploads and multiple parts
    limits: { 
      fileSize: config.limits.videoSize,      // max file size per file (50MB)
      fieldSize: 100 * 1024 * 1024,          // max field size (100MB)
      parts: 50                                // max number of parts (fields + files)
    },
  fileFilter: (req, file, cb) => {
    // Handle image fields
    if (['images', 'panorama360Images', 'panorama360'].includes(file.fieldname)) {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error(`Only image files allowed in ${file.fieldname} field`));
      }
      return cb(null, true);
    }
    
    // Handle video field
    if (file.fieldname === 'video') {
      if (!config.allowedVideoTypes.includes(file.mimetype)) {
        return cb(new Error('Invalid video format. Allowed: mp4, webm, ogg'));
      }
      return cb(null, true);
    }
    
    console.warn('Unexpected field received:', file.fieldname);
    cb(new Error(`Unexpected field: ${file.fieldname}`));
  }
}).fields([
  { name: 'images', maxCount: config.limits.images },
  { name: 'video', maxCount: 1 },
  { name: 'panorama360Images', maxCount: config.limits.panoramas },
  { name: 'panorama360', maxCount: config.limits.panoramas }
]);

export const uploadMemory = memoryUpload;

// Utility Functions
const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  
  if (Array.isArray(value)) {
    const firstValue = value.find(item => item !== null && item !== undefined && item !== '');
    if (!firstValue) return null;
    value = firstValue;
  }
  
  const stringValue = String(value).replace(/,/g, '').trim();
  if (stringValue === '') return null;
  
  const num = parseFloat(stringValue);
  return isNaN(num) ? null : num;
};

const normalizeList = (value) => {
  if (!value && value !== 0) return [];
  if (Array.isArray(value)) return value.map(s => String(s).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

const deleteCloudinaryAssets = async (urls) => {
  try {
    const { default: cloudinary } = await import('../utils/cloudinary.js');
    
    for (const url of urls) {
      try {
        if (!url || !url.startsWith('http')) continue;
        
        const publicId = extractPublicId(url);
        if (!publicId) continue;

        const resourceType = url.includes('/video/') ? 'video' : 'image';
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      } catch (innerErr) {
        console.error('[Cloudinary Delete] Error processing URL:', url, innerErr);
      }
    }
  } catch (err) {
    console.error('[Cloudinary Delete] Error deleting Cloudinary assets:', err);
  }
};

const uploadToCloudinary = async (files, folder, resourceType = 'image') => {
  try {
    const { default: cloudinary } = await import('../utils/cloudinary.js');
    const urls = [];
    
    for (const file of files) {
      try {
        const result = await uploadBuffer(file.buffer, { 
          folder: `tahanap/properties/${folder}`,
          resource_type: resourceType
        });
        if (result.secure_url) {
          urls.push(result.secure_url);
        }
      } catch (error) {
        console.error(`Cloudinary ${resourceType} upload failed:`, error);
        throw error;
      }
    }
    
    return resourceType === 'image' ? urls : urls[0] || '';
  } catch (error) {
    console.error('Error in uploadToCloudinary:', error);
    throw error;
  }
};

const formatPropertyResponse = (property) => ({
  ...property._doc,
  images: property.images || [],
  video: property.video || '',
  panorama360Images: property.panorama360Images || [],
  listingType: property.listingType || 'For Sale',
  propertyType: property.propertyType,
  floorArea: property.floorArea,
  lotArea: property.lotArea,
  numberOfFloors: property.numberOfFloors,
  latitude: property.latitude,
  longitude: property.longitude,
  landlordProfile: property.landlord ? {
    id: property.landlord._id,
    fullName: property.landlord.fullName || property.landlord.username || 'Landlord',
    username: property.landlord.username || '',
    contactNumber: property.landlord.contactNumber || '',
    address: property.landlord.address || '',
    verified: !!property.landlord.landlordVerified,
    profilePic: property.landlord.profilePic || ''
  } : null
});

const validateFileUploads = (files) => {
  const errors = [];

  // Validate images
  if (files?.images) {
    for (const file of files.images) {
      if (file.size > config.limits.imageSize) {
        errors.push(`Image "${file.originalname}" exceeds ${config.limits.imageSize / 1024 / 1024}MB limit`);
      }
      if (!file.mimetype.startsWith('image/')) {
        errors.push(`File "${file.originalname}" is not a valid image format`);
      }
    }
  }

  // Validate video
  if (files?.video?.[0]) {
    const videoFile = files.video[0];
    if (videoFile.size > config.limits.videoSize) {
      errors.push(`Video file exceeds ${config.limits.videoSize / 1024 / 1024}MB size limit`);
    }
    if (!config.allowedVideoTypes.includes(videoFile.mimetype)) {
      errors.push('Invalid video format. Only MP4, WebM, or OGG formats are allowed');
    }
  }

  // FIXED: Validate panorama images - combine both field names
  const panoramaFiles = [
    ...(files?.panorama360Images || []),
    ...(files?.panorama360 || [])
  ];
  
  if (panoramaFiles.length > 0) {
    if (panoramaFiles.length > config.limits.panoramas) {
      errors.push(`Maximum of ${config.limits.panoramas} panoramic images allowed`);
    }
    
    for (const panoramaFile of panoramaFiles) {
      if (panoramaFile.size > config.limits.imageSize) {
        errors.push(`360° Panorama image "${panoramaFile.originalname}" exceeds ${config.limits.imageSize / 1024 / 1024}MB limit`);
      }
      if (!panoramaFile.mimetype.startsWith('image/')) {
        errors.push(`360° Panorama "${panoramaFile.originalname}" must be an image file`);
      }
    }
  }

  return errors;
};

const validatePropertyData = (data, isUpdate = false) => {
  const errors = [];
  const {
    propertyType,
    address,
    price,
    barangay,
    listingType,
    areaSqm,
    floorArea,
    lotArea,
    numberOfFloors,
    occupancy,
    propertyCondition
  } = data;

  const validations = {
    propertyType: {
      required: true,
      value: propertyType,
      message: "Please select a property type",
      validate: value => PROPERTY_TYPES.includes(value),
      errorMessage: "Invalid property type selected"
    },
    address: {
      required: true,
      value: address,
      message: "Make sure to provide the complete address of your property"
    },
    price: {
      required: true,
      value: price,
      message: "Don't forget to set a price for your property",
      validate: value => !isNaN(parseNumber(value)) && parseNumber(value) > 0,
      errorMessage: "The price should be a valid number greater than 0"
    },
    barangay: {
      required: true,
      value: barangay,
      message: "Please select which barangay your property is located in"
    },
    listingType: {
      required: true,
      value: listingType,
      message: "Please select listing type (For Rent or For Sale)",
      validate: value => ['For Rent', 'For Sale'].includes(value),
      errorMessage: "Listing type must be either 'For Rent' or 'For Sale'"
    },
    areaSqm: {
      required: true,
      value: areaSqm,
      message: "Please provide the floor area (in square meters)",
      validate: value => !isNaN(parseNumber(value)) && parseNumber(value) > 0,
      errorMessage: "Floor area should be a number greater than 0"
    },
    floorArea: {
      required: true,
      value: floorArea,
      message: "Please provide the floor area",
      validate: value => {
        const num = parseNumber(value);
        return num !== null && num > 0;
      },
      errorMessage: "Floor area should be a number greater than 0"
    },
    lotArea: {
      required: true,
      value: lotArea,
      message: "Please provide the lot area",
      validate: value => {
        const num = parseNumber(value);
        return num !== null && num > 0;
      },
      errorMessage: "Lot area should be a number greater than 0"
    },
    numberOfFloors: {
      required: true,
      value: numberOfFloors,
      message: "Please specify the number of floors",
      validate: value => {
        const num = parseNumber(value);
        return num !== null && num >= 1 && num <= 5;
      },
      errorMessage: "Number of floors must be between 1 and 5"
    }
  };

  // Conditional validation based on listing type
  if (listingType === 'For Rent') {
    validations.occupancy = {
      required: true,
      value: occupancy,
      message: "Please specify maximum occupancy",
      validate: value => {
        const num = parseNumber(value);
        return num !== null && num > 0 && num <= 5;
      },
      errorMessage: "Maximum occupancy should be between 1 and 5"
    };
  } else if (listingType === 'For Sale') {
    validations.propertyCondition = {
      required: true,
      value: propertyCondition,
      message: "Please select the property condition"
    };
  }

  // Validate dropdown fields
  if (data.numberOfRooms && (parseNumber(data.numberOfRooms) < 0 || parseNumber(data.numberOfRooms) > 5)) {
    errors.push("Number of rooms must be between 1 and 5");
  }

  for (const [field, validation] of Object.entries(validations)) {
    const value = validation.value;
    
    if (validation.required && (!value || value.toString().trim() === '')) {
      errors.push(validation.message);
      continue;
    }

    if (value && validation.validate && !validation.validate(value)) {
      errors.push(validation.errorMessage || validation.message);
    }
  }

  return errors;
};

const buildPropertyData = (reqBody, files, landlordId) => {
  const {
    propertyType,
    title,
    address,
    price,
    barangay,
    listingType,
    petFriendly,
    allowedPets,
    occupancy,
    parking,
    rules,
    landmarks,
    numberOfRooms,
    areaSqm,
    floorArea,
    lotArea,
    numberOfFloors,
    latitude,
    longitude,
    propertyCondition,
    availabilityStatus,
    billsIncluded,
    marketHighlights
  } = reqBody;

  const actualPropertyType = String(propertyType || '').trim();
  const actualListingType = String(listingType || '').trim();

  const propertyData = {
    landlord: landlordId,
    title: actualPropertyType,
    address: address ? address.trim() : '',
    price: parseNumber(price) || 0,
    barangay: barangay ? barangay.trim() : '',
    propertyType: actualPropertyType,
    listingType: actualListingType,
    petFriendly: petFriendly === 'true' || petFriendly === true,
    allowedPets: normalizeList(allowedPets),
    occupancy: parseNumber(occupancy) || 1,
    parking: parking === 'true' || parking === true,
    rules: rules || '',
    landmarks: landmarks || '',
    numberOfRooms: parseNumber(numberOfRooms) || 0,
    areaSqm: parseNumber(areaSqm) || 0,
    floorArea: parseNumber(floorArea) || 0,
    lotArea: parseNumber(lotArea) || 0,
    numberOfFloors: parseNumber(numberOfFloors) || 0,
    billsIncluded: normalizeList(billsIncluded),
    marketHighlights: normalizeList(marketHighlights),
    images: [],
    video: '',
    panorama360Images: [],
    latitude: latitude ? parseFloat(latitude) : null,
    longitude: longitude ? parseFloat(longitude) : null,
    status: 'approved',
    availabilityStatus: (availabilityStatus && config.allowedAvailability.includes(availabilityStatus)) 
      ? availabilityStatus 
      : 'Available'
  };

  // Handle property condition based on listing type
  if (actualListingType === 'For Sale' && propertyCondition && propertyCondition.trim() !== '') {
    propertyData.propertyCondition = propertyCondition;
  } else if (actualListingType === 'For Rent') {
    propertyData.propertyCondition = '';
  }

  return propertyData;
};

const buildUpdateData = (reqBody, existingProperty) => {
  const updates = {};
  const errors = [];

  // Process numeric fields
  const numericFields = ['price', 'areaSqm', 'floorArea', 'lotArea', 'numberOfFloors', 'numberOfRooms', 'occupancy'];
  numericFields.forEach(field => {
    if (reqBody[field] !== undefined) {
      const parsed = parseNumber(reqBody[field]);
      if (parsed !== null && parsed >= 0) {
        updates[field] = parsed;
      } else if (reqBody[field] !== '' && reqBody[field] !== null) {
        errors.push(`${field} must be a valid number`);
      }
    }
  });

  // Process boolean fields
  if (reqBody.petFriendly !== undefined) {
    updates.petFriendly = reqBody.petFriendly === 'true' || reqBody.petFriendly === true;
  }
  if (reqBody.parking !== undefined) {
    updates.parking = reqBody.parking === 'true' || reqBody.parking === true;
  }

  // Process string fields
  const stringFields = ['propertyType', 'address', 'barangay', 'listingType', 'rules', 'landmarks', 'propertyCondition', 'availabilityStatus'];
  stringFields.forEach(field => {
    if (reqBody[field] !== undefined && reqBody[field] !== null) {
      updates[field] = String(reqBody[field]).trim();
    }
  });

  // Process array fields
  const arrayFields = ['billsIncluded', 'marketHighlights', 'allowedPets'];
  arrayFields.forEach(field => {
    if (reqBody[field] !== undefined) {
      updates[field] = normalizeList(reqBody[field]);
    }
  });

  // Process coordinates
  if (reqBody.latitude !== undefined) {
    const lat = parseNumber(reqBody.latitude);
    updates.latitude = lat !== null ? lat : null;
  }
  if (reqBody.longitude !== undefined) {
    const lng = parseNumber(reqBody.longitude);
    updates.longitude = lng !== null ? lng : null;
  }

  // Handle property condition based on listing type
  const listingType = updates.listingType || existingProperty.listingType;
  if (listingType === 'For Rent') {
    updates.propertyCondition = '';
  } else if (listingType === 'For Sale' && (!updates.propertyCondition || updates.propertyCondition.trim() === '')) {
    updates.propertyCondition = existingProperty.propertyCondition || 'Brand New';
  }

  return { updates, errors };
};

const validateUpdates = (updates) => {
  const errors = [];

  const validations = {
    price: {
      check: value => value >= 0 && !isNaN(value),
      message: 'Price must be a valid positive number'
    },
    floorArea: {
      check: value => value >= 0.1 && !isNaN(value),
      message: 'Floor area must be at least 0.1'
    },
    lotArea: {
      check: value => value >= 0.1 && !isNaN(value),
      message: 'Lot area must be at least 0.1'
    },
    numberOfFloors: {
      check: value => Number.isInteger(value) && value >= 1 && value <= 5,
      message: 'Number of floors must be an integer between 1 and 5'
    },
    occupancy: {
      check: value => Number.isInteger(value) && value >= 1 && value <= 5,
      message: 'Occupancy must be an integer between 1 and 5'
    },
    barangay: {
      check: value => value && value.trim().length > 0,
      message: 'Barangay is required'
    },
    address: {
      check: value => value && value.trim().length > 0,
      message: 'Property address is required'
    }
  };

  Object.keys(updates).forEach(field => {
    if (validations[field] && updates[field] !== undefined) {
      if (!validations[field].check(updates[field])) {
        errors.push(validations[field].message);
      }
    }
  });

  // Additional validation for listing type and property type
  if (updates.listingType && !['For Rent', 'For Sale'].includes(updates.listingType)) {
    errors.push('Listing type must be either "For Rent" or "For Sale"');
  }
  
  if (updates.propertyType && !PROPERTY_TYPES.includes(updates.propertyType)) {
    errors.push('Invalid property type selected');
  }

  // Validate required fields
  const requiredFields = ['listingType', 'propertyType', 'address', 'barangay', 'price'];
  const missingFields = requiredFields.filter(field => !updates[field] || updates[field].toString().trim() === '');
  
  if (missingFields.length > 0) {
    errors.push(...missingFields.map(field => `${field} is required`));
  }

  return errors;
};

// Controller Functions
export const addProperty = async (req, res) => {
  let uploadedFiles = {
    images: [],
    video: '',
    panorama360Images: []
  };

  // Log if client aborts the request during upload
  req.on('aborted', () => {
    console.warn('[Upload] Client aborted request while uploading property');
  });

  uploadMemory(req, res, async (err) => {
    if (err) {
      let errorMsg = "Error uploading media";
      if (err && err.message) {
        if (err.message.includes('Unexpected end of form')) {
          errorMsg = 'Upload incomplete: client disconnected or request truncated';
        } else if (err.message.includes('File too large')) {
          errorMsg = 'File size exceeds the allowed limit (Images/Panorama: 10MB, Video: 50MB)';
        } else if (err.message.includes('Only image files allowed')) {
          errorMsg = 'Invalid file type for images. Only JPG, PNG, and WebP formats are allowed';
        } else if (err.message.includes('Invalid video format')) {
          errorMsg = 'Invalid video format. Only MP4, WebM, and OGG formats are allowed';
        } else {
          errorMsg = err.message;
        }
      }
      console.error('[Multer] AddProperty upload error:', err);
      return res.status(400).json({ error: errorMsg });
    }

    try {
      // Validate property data
      const validationErrors = validatePropertyData(req.body);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          error: 'Please fix the following errors',
          details: validationErrors
        });
      }

      // Validate file uploads
      const fileErrors = validateFileUploads(req.files);
      if (fileErrors.length > 0) {
        return res.status(400).json({
          error: 'File validation failed',
          details: fileErrors
        });
      }

      const landlord = req.user.id;

      // Landlord verification check
      if (process.env.DISABLE_VERIFICATION !== 'true' && req.user.role === 'landlord') {
        const landlordUser = await User.findById(landlord).select('landlordVerified');
        if (!landlordUser || !landlordUser.landlordVerified) {
          return res.status(403).json({ 
            error: 'Landlord not verified. Please upload required IDs and wait for admin approval.' 
          });
        }
      }

      // Upload images
      if (req.files?.images && req.files.images.length > 0) {
        uploadedFiles.images = await uploadToCloudinary(req.files.images, 'images', 'image');
      }

      // Upload video
      if (req.files?.video && req.files.video.length > 0) {
        uploadedFiles.video = await uploadToCloudinary(req.files.video, 'videos', 'video');
      }

      // FIXED: Upload panorama images - combine both field names
      const panoramaFiles = [
        ...(req.files?.panorama360Images || []),
        ...(req.files?.panorama360 || [])
      ];
      if (panoramaFiles.length > 0) {
        try {
          // Validate each panorama file
          for (const panoramaFile of panoramaFiles) {
            if (panoramaFile.size > config.limits.imageSize) {
              throw new Error(`360° Panorama image "${panoramaFile.originalname}" exceeds ${config.limits.imageSize / 1024 / 1024}MB size limit`);
            }
            if (!panoramaFile.mimetype.startsWith('image/')) {
              throw new Error(`360° Panorama "${panoramaFile.originalname}" must be an image file (JPG, PNG, or WebP)`);
            }
          }

          // Check if total panorama images don't exceed limit
          if (panoramaFiles.length > config.limits.panoramas) {
            throw new Error(`Maximum of ${config.limits.panoramas} panoramic images allowed`);
          }

          // Upload all panorama images
          uploadedFiles.panorama360Images = await uploadToCloudinary(panoramaFiles, 'panorama', 'image');
        } catch (error) {
          // Cleanup any uploaded files on error
          if (uploadedFiles.images.length > 0) {
            await deleteCloudinaryAssets(uploadedFiles.images);
          }
          if (uploadedFiles.video) {
            await deleteCloudinaryAssets([uploadedFiles.video]);
          }
          if (uploadedFiles.panorama360Images.length > 0) {
            await deleteCloudinaryAssets(uploadedFiles.panorama360Images);
          }
          return res.status(400).json({ error: error.message });
        }
      }

      // Validate image count
      if (uploadedFiles.images.length > config.limits.images) {
        await deleteCloudinaryAssets(uploadedFiles.images);
        return res.status(400).json({ error: `Maximum of ${config.limits.images} images exceeded` });
      }

      // Build property data
      const propertyData = buildPropertyData(req.body, req.files, landlord);
      propertyData.images = uploadedFiles.images;
      propertyData.video = uploadedFiles.video;
      propertyData.panorama360Images = uploadedFiles.panorama360Images;

      // Create and save property
      const newProperty = new Property(propertyData);
      await newProperty.save();
      
      // Populate landlord info for response
      await newProperty.populate('landlord', 'fullName username profilePic address contactNumber role landlordVerified');
      
      const responseProperty = formatPropertyResponse(newProperty);
      
      console.log('Property created successfully:', responseProperty._id);
      res.status(201).json({ 
        message: "Property added successfully!", 
        property: responseProperty 
      });

    } catch (error) {
      console.error("Add Property Error:", error);
      
      // Clean up uploaded files on error
      const filesToDelete = [
        ...uploadedFiles.images,
        ...(uploadedFiles.video ? [uploadedFiles.video] : []),
        ...uploadedFiles.panorama360Images
      ].filter(Boolean);

      if (filesToDelete.length > 0) {
        try {
          await deleteCloudinaryAssets(filesToDelete);
        } catch (cleanupError) {
          console.error("Error cleaning up files:", cleanupError);
        }
      }

      return res.status(500).json({ 
        error: 'Server error while adding property', 
        detail: error?.message || 'Internal server error'
      });
    }
  });
};

export const getAllProperties = async (req, res) => {
  try {
    const { propertyType } = req.query;
    
    const query = { status: 'approved' };
    if (propertyType && ["For Rent", "For Sale"].includes(propertyType)) {
      query.listingType = propertyType;
    }
    
    const properties = await Property.find(query).populate('landlord', 'fullName username profilePic address contactNumber role landlordVerified');
    const filtered = properties.filter(property => property.landlord !== null);
    
    res.status(200).json(filtered.map(property => formatPropertyResponse(property)));
  } catch (error) {
    console.error('Get Properties Error:', error);
    res.status(500).json({ error: 'Error fetching properties', details: error.message });
  }
};

export const getPropertiesByLandlord = async (req, res) => {
  try {
    const properties = await Property.find({ landlord: req.user.id }).populate('landlord', 'fullName username profilePic landlordVerified contactNumber');
    res.status(200).json(properties.map(property => formatPropertyResponse(property)));
  } catch (error) {
    console.error('Get Landlord Properties Error:', error);
    res.status(500).json({ error: 'Error fetching your properties' });
  }
};

export const getProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate('landlord', 'fullName username profilePic address contactNumber landlordVerified');
    if (!property) return res.status(404).json({ error: 'Property not found' });
    res.status(200).json(formatPropertyResponse(property));
  } catch (error) {
    console.error('Get Property Error:', error);
    res.status(500).json({ error: 'Error retrieving property' });
  }
};

export const updateProperty = async (req, res) => {
  uploadMemory(req, res, async (err) => {
    if (err) {
      console.error("❌ Multer upload error:", err);
      return res.status(400).json({ error: err.message || "Error uploading media" });
    }

    try {
      console.log('🔍 Starting property update process for ID:', req.params.id);
      
      // 1. Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: "Invalid property ID format" });
      }

      // 2. Find property and check ownership
      const property = await Property.findById(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      if (property.landlord.toString() !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // 3. Enhanced data validation with detailed logging
      console.log('📦 Request body analysis:');
      Object.keys(req.body).forEach(key => {
        console.log(`   ${key}:`, req.body[key], `(type: ${typeof req.body[key]})`);
      });

      // 4. Validate required fields before processing
      const requiredFields = ['listingType', 'propertyType', 'address', 'barangay', 'price'];
      const missingFields = requiredFields.filter(field => {
        const value = req.body[field];
        return !value || value.toString().trim() === '';
      });

      if (missingFields.length > 0) {
        console.log('❌ Missing required fields:', missingFields);
        return res.status(400).json({
          error: 'Missing required fields',
          details: missingFields.map(field => `${field} is required`)
        });
      }

      // 5. Validate numeric fields with better error messages
      const numericFields = ['price', 'areaSqm', 'floorArea', 'lotArea', 'numberOfFloors', 'numberOfRooms', 'occupancy'];
      const numericErrors = [];
      
      numericFields.forEach(field => {
        if (req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== '') {
          const parsed = parseNumber(req.body[field]);
          if (parsed === null || isNaN(parsed) || parsed < 0) {
            numericErrors.push(`${field} must be a valid positive number`);
          }
        }
      });

      if (numericErrors.length > 0) {
        console.log('❌ Numeric field errors:', numericErrors);
        return res.status(400).json({
          error: 'Invalid number format',
          details: numericErrors
        });
      }

      // 6. Validate property type and listing type
      if (req.body.propertyType && !PROPERTY_TYPES.includes(req.body.propertyType)) {
        return res.status(400).json({
          error: 'Invalid property type',
          details: [`Property type must be one of: ${PROPERTY_TYPES.join(', ')}`]
        });
      }

      if (req.body.listingType && !['For Rent', 'For Sale'].includes(req.body.listingType)) {
        return res.status(400).json({
          error: 'Invalid listing type',
          details: ['Listing type must be either "For Rent" or "For Sale"']
        });
      }

      // 7. Build update data with enhanced validation
      const { updates: updateData, errors: buildErrors } = buildUpdateData(req.body, property);
      
      console.log('📝 Update data prepared:', {
        ...updateData,
        images: updateData.images ? `Array(${updateData.images.length})` : 'undefined',
        panorama360Images: updateData.panorama360Images ? `Array(${updateData.panorama360Images.length})` : 'undefined'
      });

      if (buildErrors.length > 0) {
        console.log('❌ Build update data errors:', buildErrors);
        return res.status(400).json({
          error: 'Invalid data format',
          details: buildErrors
        });
      }

      // 8. Validate updates with property model schema
      const validationErrors = validateUpdates(updateData);
      if (validationErrors.length > 0) {
        console.log('❌ Update validation errors:', validationErrors);
        return res.status(400).json({
          error: 'Validation failed',
          details: validationErrors
        });
      }

      // 9. Handle file uploads with better error handling
      let updatedImages = [...property.images];
      let updatedVideo = property.video;
      let updatedPanoramaImages = [...(property.panorama360Images || [])];

      console.log('📁 Current files - Images:', updatedImages.length, 'Video:', !!updatedVideo, 'Panoramas:', updatedPanoramaImages.length);

      // Handle deleted images
      if (req.body.deletedImages) {
        try {
          let deletedImagesArray = Array.isArray(req.body.deletedImages) 
            ? req.body.deletedImages 
            : JSON.parse(req.body.deletedImages);

          console.log('🗑️ Deleting images:', deletedImagesArray);

          const imagesToDelete = updatedImages.filter(img => 
            deletedImagesArray.some(deleted => img.includes(deleted))
          );

          if (imagesToDelete.length > 0) {
            await deleteCloudinaryAssets(imagesToDelete);
          }

          updatedImages = updatedImages.filter(img => 
            !deletedImagesArray.some(deleted => img.includes(deleted))
          );
        } catch (error) {
          console.error('❌ Error processing deleted images:', error);
          return res.status(400).json({
            error: 'Invalid deleted images format',
            details: ['Please provide valid image URLs to delete']
          });
        }
      }

      // Handle new images
      if (req.files?.images && req.files.images.length > 0) {
        try {
          console.log('📸 Uploading new images:', req.files.images.length);
          const newImages = await uploadToCloudinary(req.files.images, 'images', 'image');
          updatedImages = [...updatedImages, ...newImages];
          
          if (updatedImages.length > config.limits.images) {
            const overflow = updatedImages.length - config.limits.images;
            const imagesToDelete = updatedImages.slice(-overflow);
            await deleteCloudinaryAssets(imagesToDelete);
            updatedImages = updatedImages.slice(0, config.limits.images);
          }
        } catch (error) {
          console.error('❌ Image upload failed:', error);
          return res.status(400).json({
            error: 'Image upload failed',
            details: [error.message]
          });
        }
      }

      // Handle video
      if (req.files?.video && req.files.video.length > 0) {
        try {
          console.log('🎥 Uploading new video');
          if (updatedVideo) {
            await deleteCloudinaryAssets([updatedVideo]);
          }
          updatedVideo = await uploadToCloudinary(req.files.video, 'videos', 'video');
        } catch (error) {
          console.error('❌ Video upload failed:', error);
          return res.status(400).json({
            error: 'Video upload failed',
            details: [error.message]
          });
        }
      } else if (req.body.removeVideo === 'true') {
        if (updatedVideo) {
          await deleteCloudinaryAssets([updatedVideo]);
        }
        updatedVideo = '';
      }

      // Handle panorama images
      const panoramaFiles = [
        ...(req.files?.panorama360Images || []),
        ...(req.files?.panorama360 || [])
      ];
      
      if (panoramaFiles.length > 0) {
        try {
          console.log('📸 Uploading new panoramas:', panoramaFiles.length);
          const newPanoramaImages = await uploadToCloudinary(panoramaFiles, 'panorama', 'image');
          updatedPanoramaImages = [...updatedPanoramaImages, ...newPanoramaImages];
          
          if (updatedPanoramaImages.length > config.limits.panoramas) {
            const overflow = updatedPanoramaImages.length - config.limits.panoramas;
            const panoramasToDelete = updatedPanoramaImages.slice(-overflow);
            await deleteCloudinaryAssets(panoramasToDelete);
            updatedPanoramaImages = updatedPanoramaImages.slice(0, config.limits.panoramas);
          }
        } catch (error) {
          console.error('❌ Panorama upload failed:', error);
          return res.status(400).json({
            error: 'Panorama image upload failed',
            details: [error.message]
          });
        }
      }

      // Handle deleted panoramas
      if (req.body.deletedPanoramaImages) {
        try {
          let deletedPanoramasArray = Array.isArray(req.body.deletedPanoramaImages)
            ? req.body.deletedPanoramaImages
            : JSON.parse(req.body.deletedPanoramaImages);

          console.log('🗑️ Deleting panoramas:', deletedPanoramasArray);

          const panoramasToDelete = updatedPanoramaImages.filter(img => 
            deletedPanoramasArray.some(deleted => img.includes(deleted))
          );

          if (panoramasToDelete.length > 0) {
            await deleteCloudinaryAssets(panoramasToDelete);
          }

          updatedPanoramaImages = updatedPanoramaImages.filter(img => 
            !deletedPanoramasArray.some(deleted => img.includes(deleted))
          );
        } catch (error) {
          console.error('❌ Error processing deleted panoramas:', error);
          return res.status(400).json({
            error: 'Invalid deleted panoramas format',
            details: ['Please provide valid panorama URLs to delete']
          });
        }
      }

      // 10. Final update data preparation
      updateData.images = updatedImages;
      updateData.video = updatedVideo;
      updateData.panorama360Images = updatedPanoramaImages;
      updateData.updatedAt = new Date();

      console.log('✅ Final update data ready:', {
        fields: Object.keys(updateData),
        images: updateData.images.length,
        panoramas: updateData.panorama360Images.length,
        hasVideo: !!updateData.video
      });

      // 11. Test the update data against the schema before saving
      try {
        const testProperty = new Property(updateData);
        await testProperty.validate();
      } catch (validationError) {
        console.error('❌ Schema validation failed:', validationError);
        const errorDetails = Object.values(validationError.errors).map(err => err.message);
        return res.status(400).json({
          error: 'Data validation failed',
          details: errorDetails
        });
      }

      // 12. Perform the actual update
      console.log('💾 Saving to database...');
      const updatedProperty = await Property.findByIdAndUpdate(
        req.params.id, 
        { $set: updateData },
        { 
          new: true, 
          runValidators: true 
        }
      ).populate('landlord', 'fullName username profilePic address contactNumber landlordVerified');

      if (!updatedProperty) {
        console.error('❌ Property not found after update');
        return res.status(404).json({ error: "Property not found after update" });
      }

      console.log('🎉 Property updated successfully:', updatedProperty._id);
      console.log('📊 Final state - Images:', updatedProperty.images.length, 'Panoramas:', updatedProperty.panorama360Images.length);
      
      return res.json({
        success: true,
        message: 'Property updated successfully',
        property: formatPropertyResponse(updatedProperty)
      });

    } catch (error) {
      console.error("❌ UpdateProperty critical error:", error);
      
      // Detailed error analysis
      console.error('🔍 Error analysis:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      // Handle specific error types
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }));
        return res.status(400).json({
          error: 'Database validation failed',
          details: validationErrors
        });
      }
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Invalid data type',
          details: [`Field '${error.path}' must be ${error.kind}`]
        });
      }

      // Generic error response
      res.status(500).json({ 
        error: 'Internal server error while updating property',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
      });
    }
  });
};

export const setPropertyStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { id } = req.params;
    const { status } = req.body;
    
    if (!config.allowedStatus.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const property = await Property.findByIdAndUpdate(id, { status }, { new: true });
    if (!property) return res.status(404).json({ error: 'Property not found' });
    
    res.json({ 
      message: 'Status updated', 
      property: formatPropertyResponse(property)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: "Property not found" });

    if (property.landlord.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const assetsToDelete = [
      ...property.images,
      ...(property.video ? [property.video] : []),
      ...(property.panorama360Images || [])
    ].filter(Boolean);

    await deleteCloudinaryAssets(assetsToDelete);
    await property.deleteOne();
    
    res.status(200).json({ message: "Property deleted successfully" });

  } catch (error) {
    console.error("Delete Property Error:", error);
    res.status(500).json({ error: "Error deleting property" });
  }
};

export const setPropertyAvailability = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    
    if (property.landlord.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updates = {};
    if (req.body.availabilityStatus && config.allowedAvailability.includes(req.body.availabilityStatus)) {
      updates.availabilityStatus = req.body.availabilityStatus;
    }

    const updated = await Property.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json({ 
      message: 'Availability updated', 
      property: formatPropertyResponse(updated) 
    });
  } catch (error) {
    console.error('setPropertyAvailability error', error);
    res.status(500).json({ error: error.message });
  }
};