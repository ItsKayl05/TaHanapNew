import multer from "multer";
import path from 'path';
import fs from 'fs';
import os from 'os';
import { promisify } from 'util';
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);
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

// Improved Multer configuration
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Allow larger per-file size to be safer in dev; server-side Cloudinary uploads still enforce limits
    fileSize: Math.max(config.limits.videoSize, config.limits.imageSize, 100 * 1024 * 1024), // at least 100MB per file
    fieldSize: 200 * 1024 * 1024, // 200MB for fields (total form fields size)
    parts: 400, // Allow more parts
    files: 50 // Maximum number of files
  },
  fileFilter: (req, file, cb) => {
    console.log(`📁 Processing file: ${file.fieldname} - ${file.originalname} - ${file.mimetype}`);

    // Handle image fields
    if (['images', 'panorama360Images', 'panorama360'].includes(file.fieldname)) {
      if (!file.mimetype.startsWith('image/')) {
        console.error(`❌ Invalid image type: ${file.mimetype}`);
        return cb(new Error(`Only image files allowed in ${file.fieldname} field`));
      }
      console.log(`✅ Valid image: ${file.originalname}`);
      return cb(null, true);
    }

    // Handle video field
    if (file.fieldname === 'video') {
      if (!config.allowedVideoTypes.includes(file.mimetype)) {
        console.error(`❌ Invalid video type: ${file.mimetype}`);
        return cb(new Error('Invalid video format. Allowed: mp4, webm, ogg'));
      }
      console.log(`✅ Valid video: ${file.originalname}`);
      return cb(null, true);
    }

    console.warn('⚠️ Unexpected field received:', file.fieldname);
    // Instead of rejecting, accept unexpected fields but don't process them as files
    return cb(null, false);
  }
}).fields([
  { name: 'images', maxCount: config.limits.images },
  { name: 'video', maxCount: 1 },
  { name: 'panorama360Images', maxCount: config.limits.panoramas },
  { name: 'panorama360', maxCount: config.limits.panoramas }
]);

export const uploadMemory = memoryUpload;

// Disk-based uploader for large update requests (avoids storing very large buffers in memory)
const tmpDir = path.join(process.cwd(), 'uploads', 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tmpDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${file.originalname}`)
});

const diskUpload = multer({
  storage: diskStorage,
  limits: {
    // Set per-file size limit to 100MB to match expectations (video up to 50MB, images up to 10MB)
    fileSize: 100 * 1024 * 1024,
    fieldSize: 300 * 1024 * 1024,
    parts: 500,
    files: 60
  },
  fileFilter: (req, file, cb) => {
    // reuse same logic as memory fileFilter
    if (['images', 'panorama360Images', 'panorama360'].includes(file.fieldname)) {
      if (!file.mimetype.startsWith('image/')) return cb(new Error(`Only image files allowed in ${file.fieldname} field`));
      return cb(null, true);
    }
    if (file.fieldname === 'video') {
      if (!config.allowedVideoTypes.includes(file.mimetype)) return cb(new Error('Invalid video format. Allowed: mp4, webm, ogg'));
      return cb(null, true);
    }
    return cb(null, false);
  }
}).fields([
  { name: 'images', maxCount: config.limits.images },
  { name: 'video', maxCount: 1 },
  { name: 'panorama360Images', maxCount: config.limits.panoramas },
  { name: 'panorama360', maxCount: config.limits.panoramas }
]);

export const uploadDisk = diskUpload;

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
  if (typeof value === 'string') {
    // Handle both comma-separated and JSON array strings
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(s => String(s).trim()).filter(Boolean);
      }
    } catch {
      // If not JSON, treat as comma-separated
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [String(value).trim()].filter(Boolean);
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
        console.log(`✅ Deleted Cloudinary asset: ${publicId}`);
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
        // Support both memory-uploaded files (buffer) and disk-uploaded files (path)
        let buffer = file.buffer;
        if (!buffer && file.path) {
          buffer = await readFileAsync(file.path);
        }
        if (!buffer) throw new Error('File buffer unavailable for upload');
        console.log(`☁️ Uploading ${resourceType}: ${file.originalname || file.filename}`);
        const result = await uploadBuffer(buffer, {
          folder: `tahanap/properties/${folder}`,
          resource_type: resourceType
        });
        if (result.secure_url) {
          urls.push(result.secure_url);
          console.log(`✅ Uploaded ${resourceType}: ${result.secure_url}`);
          console.log(`   ↳ Original filename: ${file.originalname || file.filename} -> ${result.secure_url}`);
        }
        // If file was stored on disk, remove temp file after successful upload
        if (file.path) {
          try { await unlinkAsync(file.path); } catch (e) { console.warn('Failed to remove tmp file', file.path, e); }
        }
      } catch (error) {
        console.error(`❌ Cloudinary ${resourceType} upload failed:`, error);
        throw error;
      }
    }

    return resourceType === 'image' ? urls : urls[0] || '';
  } catch (error) {
    console.error('❌ Error in uploadToCloudinary:', error);
    throw error;
  }
};

const formatPropertyResponse = (property) => ({
  ...property._doc,
  images: property.images || [],
  video: property.video || '',
  panorama360Images: property.panorama360Images || [],
  // New: return captions aligned with panorama360Images (if present)
  panorama360Captions: property.panorama360Captions || [],
  // Default to 'For Rent' when listingType is missing to match frontend expectations
  listingType: property.listingType || 'For Rent',
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

  // Validate panorama images - combine both field names
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

  // Handle property condition: accept the provided value regardless of listing type.
  // Previously propertyCondition was cleared for 'For Rent' — keep any provided value.
  if (propertyCondition && propertyCondition.trim() !== '') {
    propertyData.propertyCondition = propertyCondition.trim();
  } else {
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

  // Handle property condition for updates: do not force-clear for 'For Rent'.
  // If the client provided propertyCondition, normalize it; otherwise preserve existing or set empty string.
  const listingType = updates.listingType || existingProperty.listingType;
  if (updates.propertyCondition !== undefined) {
    updates.propertyCondition = String(updates.propertyCondition).trim();
  } else {
    // preserve existing propertyCondition if present, otherwise ensure it's at least an empty string
    updates.propertyCondition = existingProperty.propertyCondition || '';
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

// Enhanced Multer error handler
const handleMulterError = (err) => {
  console.error('❌ Multer Error Details:', {
    name: err.name,
    message: err.message,
    code: err.code,
    stack: err.stack
  });

  if (err.code === 'LIMIT_FILE_SIZE') {
    return 'File size exceeds the allowed limit (Images/Panorama: 10MB, Video: 50MB)';
  }
  if (err.code === 'LIMIT_PART_COUNT') {
    return 'Too many form parts. Please reduce the number of files or fields.';
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return 'Too many files uploaded. Please reduce the number of files.';
  }
  if (err.code === 'LIMIT_FIELD_KEY') {
    return 'Field name too long. Please use shorter field names.';
  }
  if (err.message.includes('Unexpected end of form')) {
    return 'Upload incomplete: request was truncated. This may happen if the request times out or is too large.';
  }
  if (err.message.includes('Multipart: Boundary not found')) {
    return 'Invalid form data format. Please check your request headers.';
  }

  return err.message || 'Error uploading files';
};

// Controller Functions
export const addProperty = async (req, res) => {
  let uploadedFiles = {
    images: [],
    video: '',
    panorama360Images: []
  };

  // Enhanced error handling for client disconnections
  let requestAborted = false;
  req.on('aborted', () => {
    requestAborted = true;
    console.warn('❌ [Upload] Client aborted request while uploading property');
  });

  console.log('🏁 Starting property upload process...');

  uploadMemory(req, res, async (err) => {
    if (requestAborted) {
      console.log('⚠️ Request was aborted by client');
      // Cleanup any uploaded files
      const filesToDelete = [
        ...uploadedFiles.images,
        ...(uploadedFiles.video ? [uploadedFiles.video] : []),
        ...uploadedFiles.panorama360Images
      ].filter(Boolean);

      if (filesToDelete.length > 0) {
        await deleteCloudinaryAssets(filesToDelete);
      }
      return res.status(499).json({ error: 'Client closed request' });
    }

    if (err) {
      const errorMsg = handleMulterError(err);
      console.error('❌ [Multer] AddProperty upload error:', err);
      return res.status(400).json({ error: errorMsg });
    }

    try {
      console.log('📋 Validating property data...');

      // Validate property data
      const validationErrors = validatePropertyData(req.body);
      if (validationErrors.length > 0) {
        console.log('❌ Property validation errors:', validationErrors);
        return res.status(400).json({
          error: 'Please fix the following errors',
          details: validationErrors
        });
      }

      // Validate file uploads
      const fileErrors = validateFileUploads(req.files);
      if (fileErrors.length > 0) {
        console.log('❌ File validation errors:', fileErrors);
        return res.status(400).json({
          error: 'File validation failed',
          details: fileErrors
        });
      }

      const landlord = req.user.id;
      console.log(`👤 Landlord ID: ${landlord}`);

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
        console.log(`📸 Uploading ${req.files.images.length} images...`);
        uploadedFiles.images = await uploadToCloudinary(req.files.images, 'images', 'image');
      }

      // Upload video
      if (req.files?.video && req.files.video.length > 0) {
        console.log('🎥 Uploading video...');
        uploadedFiles.video = await uploadToCloudinary(req.files.video, 'videos', 'video');
      }

      // Upload panorama images - combine both field names
      const panoramaFiles = [
        ...(req.files?.panorama360Images || []),
        ...(req.files?.panorama360 || [])
      ];
      // If client provided a paymentSessionId during creation, verify it and use it to allow additional panoramas
      let creationSessionPaid = false;
      const { paymentSessionId } = req.body || {};
      if (paymentSessionId) {
        try {
          const PaymentSession = (await import('../models/PaymentSession.js')).default;
          const sess = await PaymentSession.findOne({ sessionId: paymentSessionId });
          if (sess && sess.paid) {
            creationSessionPaid = true;
            console.log('✅ Creation payment session verified as paid:', paymentSessionId);
          } else {
            console.log('⚠️ Creation payment session not paid or not found:', paymentSessionId);
          }
        } catch (e) {
          console.warn('Could not verify payment session during property creation', e);
        }
      }

      if (panoramaFiles.length > 0) {
        try {
          console.log(`🔄 Uploading ${panoramaFiles.length} panorama images...`);

          // ✅ IMPROVED PAYMENT LOGIC - Accept frontend payment status
          const { paymentSessionId, paidForPano: frontendPaid } = req.body || {};
          let creationSessionPaid = false;

          // Check payment session
          if (paymentSessionId) {
            try {
              const PaymentSession = (await import('../models/PaymentSession.js')).default;
              const sess = await PaymentSession.findOne({ sessionId: paymentSessionId });
              if (sess && sess.paid) {
                creationSessionPaid = true;
                console.log('✅ Payment session verified:', paymentSessionId);
              } else {
                console.log('⚠️ Payment session not paid or not found:', paymentSessionId);
              }
            } catch (e) {
              console.warn('Payment session check failed:', e);
            }
          }

          // ✅ ACCEPT FRONTEND PAYMENT STATUS TOO
          const isPaid = creationSessionPaid || frontendPaid === 'true' || frontendPaid === true;

          console.log('🔍 ENHANCED Payment Check:', {
            filesCount: panoramaFiles.length,
            creationSessionPaid,
            frontendPaid,
            isPaid
          });

          // ✅ UPDATED PAYMENT REQUIREMENT LOGIC
          // First panorama free, second+ requires payment
          const requiresPayment = panoramaFiles.length > 1 && !isPaid;

          if (requiresPayment) {
            console.log('💰 Payment required for panoramas');
            return res.status(402).json({
              error: 'Payment required to upload panoramic images',
              code: 'PANO_PAYMENT_REQUIRED',
              amount_centavos: 10900,
              message: 'Pay ₱109 one-time to unlock up to 5 panoramic uploads for this property.'
            });
          }

          // ✅ Allow first panorama for free
          if (panoramaFiles.length === 1) {
            console.log('🎉 First panorama free - proceeding with upload');
          } else if (isPaid) {
            console.log('✅ Paid user - proceeding with panorama upload');
          }

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
          console.error('❌ Panorama upload error:', error);
          // Cleanup any uploaded files on error
          const filesToDelete = [
            ...uploadedFiles.images,
            ...(uploadedFiles.video ? [uploadedFiles.video] : []),
            ...uploadedFiles.panorama360Images
          ].filter(Boolean);

          if (filesToDelete.length > 0) {
            await deleteCloudinaryAssets(filesToDelete);
          }
          return res.status(400).json({ error: error.message });
        }
      }

      // Validate image count
      if (uploadedFiles.images.length > config.limits.images) {
        console.error(`❌ Image count exceeded: ${uploadedFiles.images.length} > ${config.limits.images}`);
        await deleteCloudinaryAssets(uploadedFiles.images);
        return res.status(400).json({ error: `Maximum of ${config.limits.images} images exceeded` });
      }

      // Build property data
      console.log('🏗️ Building property data...');
      const propertyData = buildPropertyData(req.body, req.files, landlord);
      propertyData.images = uploadedFiles.images;
      propertyData.video = uploadedFiles.video;
      propertyData.panorama360Images = uploadedFiles.panorama360Images;
      // Persist captions sent from frontend (order-based, joined by '|||')
      try {
        const rawCaptions = req.body.panoramaCaptions;
        let captionsArr = [];
        if (rawCaptions !== undefined && rawCaptions !== null) {
          if (Array.isArray(rawCaptions)) captionsArr = rawCaptions;
          else captionsArr = String(rawCaptions).split('|||');
        }
        // Align captions to uploaded panorama URLs (pad with empty strings if fewer captions)
        if (Array.isArray(propertyData.panorama360Images) && propertyData.panorama360Images.length > 0) {
          const aligned = propertyData.panorama360Images.map((_, idx) => String(captionsArr[idx] || '').trim());
          propertyData.panorama360Captions = aligned;
          propertyData.panoCount = propertyData.panorama360Images.length;
        } else {
          propertyData.panorama360Captions = [];
        }
      } catch (e) {
        console.warn('Could not parse panorama captions:', e);
        propertyData.panorama360Captions = [];
      }

      console.log('💾 Creating property in database...');
      // Create and save property
      const newProperty = new Property(propertyData);
      await newProperty.save();

      // Populate landlord info for response
      await newProperty.populate('landlord', 'fullName username profilePic address contactNumber role landlordVerified');

      const responseProperty = formatPropertyResponse(newProperty);

      console.log('✅ Property created successfully:', responseProperty._id);
      res.status(201).json({
        message: "Property added successfully!",
        property: responseProperty
      });

    } catch (error) {
      console.error("❌ Add Property Error:", error);

      // Clean up uploaded files on error
      const filesToDelete = [
        ...uploadedFiles.images,
        ...(uploadedFiles.video ? [uploadedFiles.video] : []),
        ...uploadedFiles.panorama360Images
      ].filter(Boolean);

      if (filesToDelete.length > 0) {
        try {
          console.log('🧹 Cleaning up uploaded files due to error...');
          await deleteCloudinaryAssets(filesToDelete);
        } catch (cleanupError) {
          console.error("❌ Error cleaning up files:", cleanupError);
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
    console.error('❌ Get Properties Error:', error);
    res.status(500).json({ error: 'Error fetching properties', details: error.message });
  }
};

export const getPropertiesByLandlord = async (req, res) => {
  try {
    const properties = await Property.find({ landlord: req.user.id }).populate('landlord', 'fullName username profilePic landlordVerified contactNumber');
    res.status(200).json(properties.map(property => formatPropertyResponse(property)));
  } catch (error) {
    console.error('❌ Get Landlord Properties Error:', error);
    res.status(500).json({ error: 'Error fetching your properties' });
  }
};

export const getProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate('landlord', 'fullName username profilePic address contactNumber landlordVerified');
    if (!property) return res.status(404).json({ error: 'Property not found' });
    res.status(200).json(formatPropertyResponse(property));
  } catch (error) {
    console.error('❌ Get Property Error:', error);
    res.status(500).json({ error: 'Error retrieving property' });
  }
};

export const updateProperty = async (req, res) => {
  console.log('🔄 Starting property update process...');

  // Track uploaded files for cleanup in case of errors
  let uploadedFiles = {
    images: [],
    video: '',
    panorama360Images: []
  };

  try {
    console.log('📥 Request headers:', req.headers);
    let requestAborted = false;
    req.on('aborted', () => {
      requestAborted = true;
      console.warn('❌ [UpdateProperty] Client aborted request while uploading');
    });

    if (!req.files) {
      console.log('⚠️ No files found on req.files — continuing without uploads');
    }

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

    // ✅ CRITICAL FIX: Preserve the landlord field
    updateData.landlord = property.landlord;
    console.log('🔐 Preserved landlord field:', updateData.landlord);

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
  // Maintain captions aligned with panorama images (if present)
  let updatedPanoramaCaptions = Array.isArray(property.panorama360Captions) ? [...property.panorama360Captions] : [];

    console.log('📁 Current files - Images:', updatedImages.length, 'Video:', !!updatedVideo, 'Panoramas:', updatedPanoramaImages.length);

    // Extra debug logging to help track pano append vs overwrite issues
    try {
      console.log('🔄 UPDATE PROPERTY DEBUG:', {
        propertyId: property?._id?.toString() || req.params?.id,
        existingPanos: (property.panorama360Images || []).length,
        newFiles: req.files ? Object.keys(req.files) : 'none',
        newPanoCount: (req.files?.panorama360Images?.length || req.files?.panorama360?.length || req.files?.panoPhotos?.length || 0)
      });
    } catch (e) { console.warn('Could not print update debug log:', e); }

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
        uploadedFiles.images = newImages;
        updatedImages = [...updatedImages, ...newImages];

        if (updatedImages.length > config.limits.images) {
          const overflow = updatedImages.length - config.limits.images;
          const imagesToDelete = updatedImages.slice(-overflow);
          await deleteCloudinaryAssets(imagesToDelete);
          updatedImages = updatedImages.slice(0, config.limits.images);
        }
      } catch (error) {
        console.error('❌ Image upload failed:', error);
        // Cleanup uploaded files on error
        const filesToDelete = [
          ...uploadedFiles.images,
          ...(uploadedFiles.video ? [uploadedFiles.video] : []),
          ...uploadedFiles.panorama360Images
        ].filter(Boolean);

        if (filesToDelete.length > 0) {
          await deleteCloudinaryAssets(filesToDelete);
        }
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
        const newVideo = await uploadToCloudinary(req.files.video, 'videos', 'video');
        uploadedFiles.video = newVideo;
        updatedVideo = newVideo;
      } catch (error) {
        console.error('❌ Video upload failed:', error);
        // Cleanup uploaded files on error
        const filesToDelete = [
          ...uploadedFiles.images,
          ...(uploadedFiles.video ? [uploadedFiles.video] : []),
          ...uploadedFiles.panorama360Images
        ].filter(Boolean);

        if (filesToDelete.length > 0) {
          await deleteCloudinaryAssets(filesToDelete);
        }
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

    // Handle panorama images - combine both field names (same as addProperty)
    const panoramaFiles = [
      ...(req.files?.panorama360Images || []),
      ...(req.files?.panorama360 || []),
      // Legacy or alternate field name support - do not overwrite existing arrays
      ...(req.files?.panoPhotos || [])
    ];

    if (panoramaFiles.length > 0) {
      try {
        console.log(`🔄 Uploading ${panoramaFiles.length} panorama images...`);

        // Monetization check: allow first pano free; require payment for 2nd unless property.paidForPano
        const existingPanoCount = updatedPanoramaImages.length || 0; // current stored panoramas
        // Allow using a payment session during update to mark the property as paid for this operation
        const { paymentSessionId } = req.body || {};
        if (paymentSessionId && !property.paidForPano) {
          try {
            const PaymentSession = (await import('../models/PaymentSession.js')).default;
            const sess = await PaymentSession.findOne({ sessionId: paymentSessionId });
            if (sess && sess.paid) {
              property.paidForPano = true;
              console.log('✅ Update payment session verified and property marked paid for pano upload');
            }
          } catch (e) {
            console.warn('Could not verify payment session during property update', e);
          }
        }
        const willHave = existingPanoCount + panoramaFiles.length;

        // If after upload we exceed the paid/unpaid rules, block and indicate payment required
        if (!property.paidForPano) {
          // free first pano
          if (existingPanoCount >= 1) {
            // already have at least 1 and not paid — require payment
            return res.status(402).json({
              error: 'Payment required to upload more panoramas',
              code: 'PANO_PAYMENT_REQUIRED',
              amount_centavos: 10900,
              message: 'Pay ₱109 one-time to unlock up to 5 panoramic uploads for this property.'
            });
          }
          // if existingPanoCount === 0 and adding more than 1 file, require payment because second pano triggers payment
          if (existingPanoCount === 0 && willHave > 1) {
            return res.status(402).json({
              error: 'Payment required to upload more panoramas',
              code: 'PANO_PAYMENT_REQUIRED',
              amount_centavos: 10900,
              message: 'Pay ₱109 one-time to unlock up to 5 panoramic uploads for this property.'
            });
          }
        }

        // If property already paid, ensure we don't exceed 5
        if (willHave > config.limits.panoramas) {
          return res.status(400).json({ error: `Upload limit reached. Maximum of ${config.limits.panoramas} panoramic images allowed.` });
        }

        // Validate each panorama file (same validation as addProperty)
        for (const panoramaFile of panoramaFiles) {
          if (panoramaFile.size > config.limits.imageSize) {
            throw new Error(`360° Panorama image "${panoramaFile.originalname}" exceeds ${config.limits.imageSize / 1024 / 1024}MB size limit`);
          }
          if (!panoramaFile.mimetype.startsWith('image/')) {
            throw new Error(`360° Panorama "${panoramaFile.originalname}" must be an image file (JPG, PNG, or WebP)`);
          }
        }

        // Check if total panorama images don't exceed limit
        const totalPanoramasAfterUpload = updatedPanoramaImages.length + panoramaFiles.length;
        if (totalPanoramasAfterUpload > config.limits.panoramas) {
          throw new Error(`Maximum of ${config.limits.panoramas} panoramic images allowed. You currently have ${updatedPanoramaImages.length} and trying to add ${panoramaFiles.length}`);
        }

        // Upload all panorama images
        const newPanoramaImages = await uploadToCloudinary(panoramaFiles, 'panorama', 'image');
        uploadedFiles.panorama360Images = newPanoramaImages;
  updatedPanoramaImages = [...updatedPanoramaImages, ...newPanoramaImages];
  // We'll assign captions for newly uploaded panoramas later (after deletions) by consuming any captions sent in req.body.panoramaCaptions

        // Update panoCount on property (increment by number of newly uploaded panoramas)
        try {
          const added = Array.isArray(newPanoramaImages) ? newPanoramaImages.length : (newPanoramaImages ? 1 : 0);
          if (added > 0) {
            // panoCount is a virtual (derived from panorama360Images.length). No need to persist a separate field.
            console.log(`🔢 Panoramas added: ${added}. New total (derived): ${updatedPanoramaImages.length}`);
          }
        } catch (e) { console.warn('Could not update property panoCount:', e); }

      } catch (error) {
        console.error('❌ Panorama upload error:', error);
        // Cleanup any uploaded files on error
        const filesToDelete = [
          ...uploadedFiles.images,
          ...(uploadedFiles.video ? [uploadedFiles.video] : []),
          ...uploadedFiles.panorama360Images
        ].filter(Boolean);

        if (filesToDelete.length > 0) {
          await deleteCloudinaryAssets(filesToDelete);
        }
        return res.status(400).json({
          error: 'Panorama image upload failed',
          details: [error.message]
        });
      }
    }

    // ✅ FIXED: Handle deleted panoramas with better validation
    if (req.body.deletedPanoramaImages) {
      try {
        console.log('🗑️ Processing deleted panoramas:', req.body.deletedPanoramaImages);

        let deletedPanoramasArray;

        // Handle different input formats
        if (Array.isArray(req.body.deletedPanoramaImages)) {
          deletedPanoramasArray = req.body.deletedPanoramaImages;
        } else if (typeof req.body.deletedPanoramaImages === 'string') {
          // Try to parse as JSON, if it fails treat as single URL
          try {
            deletedPanoramasArray = JSON.parse(req.body.deletedPanoramaImages);
            // Ensure it's an array after parsing
            if (!Array.isArray(deletedPanoramasArray)) {
              deletedPanoramasArray = [deletedPanoramasArray];
            }
          } catch (parseError) {
            // If it's not valid JSON, treat as single URL string
            deletedPanoramasArray = [req.body.deletedPanoramaImages];
          }
        } else {
          throw new Error('Invalid format for deleted panoramas');
        }

        // Validate that we have actual URLs to delete
        const validPanoramasToDelete = deletedPanoramasArray.filter(url =>
          url && typeof url === 'string' && url.trim() !== ''
        );

        if (validPanoramasToDelete.length === 0) {
          console.log('⚠️ No valid panorama URLs provided for deletion');
        } else {
          console.log('🗑️ Deleting panoramas:', validPanoramasToDelete);

          // Find panorama images that match the URLs to delete
          const panoramasToDelete = updatedPanoramaImages.filter(img =>
            validPanoramasToDelete.some(deleted =>
              img && deleted && (img.includes(deleted) || deleted.includes(img))
            )
          );

          console.log('🔍 Found panoramas to delete:', panoramasToDelete);

          if (panoramasToDelete.length > 0) {
            await deleteCloudinaryAssets(panoramasToDelete);
          }

            // Remove deleted panoramas from the array and keep captions aligned
            const deleteSet = new Set(validPanoramasToDelete.map(d => String(d)));

            const filteredPairs = updatedPanoramaImages
              .map((url, idx) => ({ url, caption: updatedPanoramaCaptions[idx] || '' }))
              .filter(pair => {
                // Keep if not in delete set (try substring match as before)
                const shouldDelete = Array.from(deleteSet).some(deleted => (pair.url && pair.url.includes(deleted)) || (deleted && deleted.includes(pair.url)));
                return !shouldDelete;
              });

            updatedPanoramaImages = filteredPairs.map(p => p.url);
            updatedPanoramaCaptions = filteredPairs.map(p => p.caption);

          // Decrement panoCount on the property and persist
          try {
            const removed = panoramasToDelete.length;
            // panoCount is virtual; it will reflect updatedPanoramaImages.length after update.
            console.log(`🔢 Panoramas removed: ${removed}. New total (derived): ${updatedPanoramaImages.length}`);
          } catch (e) {
            console.warn('Could not update property panoCount after deletions:', e);
          }
        }

      } catch (error) {
        console.error('❌ Error processing deleted panoramas:', error);
        // Instead of returning error, just log and continue (don't fail the whole update)
        console.log('⚠️ Continuing update without deleting panoramas due to processing error');
        // Don't return error here - just continue with the update
      }
    }

    // 10. Final update data preparation
    updateData.images = updatedImages;
    updateData.video = updatedVideo;
    updateData.panorama360Images = updatedPanoramaImages;
    // Reconcile captions: keep existing captions for retained URLs, and consume any new captions sent in req.body.panoramaCaptions for newly uploaded images
    try {
      const rawNewCaptions = req.body.panoramaCaptions;
      let newCaptionsArr = [];
      if (rawNewCaptions !== undefined && rawNewCaptions !== null) {
        if (Array.isArray(rawNewCaptions)) newCaptionsArr = rawNewCaptions;
        else newCaptionsArr = String(rawNewCaptions).split('|||');
      }

      // Build map of existing captions from original property
      const existingMap = {};
      if (Array.isArray(property.panorama360Images) && Array.isArray(property.panorama360Captions)) {
        for (let i = 0; i < property.panorama360Images.length; i++) {
          const url = property.panorama360Images[i];
          existingMap[url] = property.panorama360Captions[i] || '';
        }
      }

      let newIndex = 0;
      const finalCaptions = updatedPanoramaImages.map(url => {
        if (existingMap[url]) return existingMap[url];
        const c = newCaptionsArr[newIndex] || '';
        newIndex += 1;
        return String(c || '').trim();
      });

      updateData.panorama360Captions = finalCaptions;
    } catch (e) {
      console.warn('Could not reconcile panorama captions during update:', e);
      updateData.panorama360Captions = updatedPanoramaCaptions || [];
    }
    updateData.updatedAt = new Date();

    // ✅ CRITICAL FIX: Preserve immutable fields
    updateData.landlord = property.landlord;
    updateData.createdAt = property.createdAt;

    console.log('✅ Final update data ready:', {
      fields: Object.keys(updateData),
      images: updateData.images.length,
      panoramas: updateData.panorama360Images.length,
      hasVideo: !!updateData.video,
      hasLandlord: !!updateData.landlord
    });

    // 11. Test the update data against the schema before saving
    try {
      const testProperty = new Property(updateData);
      await testProperty.validate();
    } catch (validationError) {
      console.error('❌ Schema validation failed:', validationError);
      // Cleanup uploaded files on validation error
      const filesToDelete = [
        ...uploadedFiles.images,
        ...(uploadedFiles.video ? [uploadedFiles.video] : []),
        ...uploadedFiles.panorama360Images
      ].filter(Boolean);

      if (filesToDelete.length > 0) {
        await deleteCloudinaryAssets(filesToDelete);
      }

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
      // Cleanup uploaded files if property not found
      const filesToDelete = [
        ...uploadedFiles.images,
        ...(uploadedFiles.video ? [uploadedFiles.video] : []),
        ...uploadedFiles.panorama360Images
      ].filter(Boolean);

      if (filesToDelete.length > 0) {
        await deleteCloudinaryAssets(filesToDelete);
      }
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

    // Cleanup any uploaded files on critical error
    const filesToDelete = [
      ...uploadedFiles.images,
      ...(uploadedFiles.video ? [uploadedFiles.video] : []),
      ...uploadedFiles.panorama360Images
    ].filter(Boolean);

    if (filesToDelete.length > 0) {
      console.log('🧹 Cleaning up uploaded files due to critical error...');
      await deleteCloudinaryAssets(filesToDelete);
    }

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
    console.error("❌ Delete Property Error:", error);
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
    console.error('❌ setPropertyAvailability error', error);
    res.status(500).json({ error: error.message });
  }
};

// New: Check pano upload eligibility for a property
export const checkPanoEligibility = async (req, res) => {
  try {
    const { propertyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    // Re-implement the pano upload logic used on frontend
    const panoCount = property.panorama360Images ? property.panorama360Images.length : 0;
    const paidForPano = !!property.paidForPano;

    let allowed = true;
    let message = 'Allowed';

    if (panoCount < 1) {
      allowed = true;
      message = 'Free upload';
    } else if (panoCount >= 1 && !paidForPano) {
      allowed = false;
      message = 'Show payment modal';
    } else if (panoCount >= MAX_PANORAMAS) {
      allowed = false;
      message = 'Upload limit reached';
    } else {
      allowed = true;
      message = 'Allowed (paid)';
    }

    res.json({
      allowed,
      message,
      panoCount,
      paidForPano,
      maxPanos: MAX_PANORAMAS
    });
  } catch (error) {
    console.error('❌ checkPanoEligibility error:', error);
    res.status(500).json({ error: 'Server error checking eligibility' });
  }
};