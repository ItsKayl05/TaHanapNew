import fs from "fs/promises"; // Use async file operations
import path from "path";
import multer from "multer";
import mongoose from 'mongoose';
import Property from "../models/Property.js";
import User from "../models/User.js";

// Constants
const MAX_IMAGES = 8; // Align with frontend limit

// Memory-based multer for Cloudinary uploads (exported for routes)
const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'images' || file.fieldname === 'panorama360') {
            if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files allowed in ' + file.fieldname + ' field'));
            return cb(null, true);
        }
        if (file.fieldname === 'video') {
            const allowedVideo = ['video/mp4', 'video/webm', 'video/ogg'];
            if (!allowedVideo.includes(file.mimetype)) return cb(new Error('Invalid video format. Allowed: mp4, webm, ogg'));
            return cb(null, true);
        }
        cb(new Error('Unexpected field: ' + file.fieldname));
    }
}).fields([
    { name: 'images', maxCount: MAX_IMAGES },
    { name: 'video', maxCount: 1 },
    { name: 'panorama360', maxCount: 1 }
]);

export const uploadMemory = memoryUpload;

// Helper: Build absolute media URL (for Cloudinary URLs, return as-is)
const toAbsolute = (req, url) => url ? (url.startsWith('http') ? url : `${req.protocol}://${req.get('host')}${url}`) : '';

// Helper: Format image paths for frontend
const formatImagePaths = (req, images) => images.map(img => toAbsolute(req, img));

// Helper: safe number coercion
const num = (v, def = 0) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : def;
};

// Helper function to delete Cloudinary assets
const deleteCloudinaryAssets = async (urls) => {
    try {
        const { extractPublicId, default: cloudinary } = await import('../utils/cloudinary.js');
        
        for (const url of urls) {
            try {
                if (!url || !url.startsWith('http')) continue;
                
                const publicId = extractPublicId(url);
                if (!publicId) continue;

                console.log('[Cloudinary Delete] Attempting to delete:', publicId);
                
                // Determine resource type based on URL path
                const resourceType = url.includes('/video/') ? 'video' : 'image';
                
                await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
                    .then(result => {
                        console.log('[Cloudinary Delete] Deleted:', publicId, result);
                    })
                    .catch(err => {
                        console.error('[Cloudinary Delete] Failed to delete', publicId, err.message);
                    });
            } catch (innerErr) {
                console.error('[Cloudinary Delete] Error processing URL for deletion:', innerErr);
            }
        }
    } catch (err) {
        console.error('[Cloudinary Delete] Error deleting Cloudinary assets:', err);
    }
};

// Helper function to upload files to Cloudinary
const uploadToCloudinary = async (files, folder, resourceType = 'image') => {
    try {
        const { uploadBuffer, default: cloudinary } = await import('../utils/cloudinary.js');
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
            } catch (e) {
                console.error(`Cloudinary ${resourceType} upload failed:`, e);
                throw e; // Re-throw to be caught by outer try-catch
            }
        }
        
        return resourceType === 'image' ? urls : urls[0] || '';
    } catch (error) {
        console.error('Error in uploadToCloudinary:', error);
        throw error; // Re-throw to be handled by the calling function
    }
};

// 🏡 Add Property
export const addProperty = async (req, res) => {
    uploadMemory(req, res, async (err) => {
        if (err) {
            let errorMsg = "Error uploading media";
            if (err.message) {
                if (err.message.includes('File too large')) {
                    errorMsg = 'File size exceeds the allowed limit (Images/Panorama: 10MB, Video: 50MB)';
                } else if (err.message.includes('Only image files allowed')) {
                    errorMsg = 'Invalid file type for images. Only JPG, PNG, and WebP formats are allowed';
                } else if (err.message.includes('Invalid video format')) {
                    errorMsg = 'Invalid video format. Only MP4, WebM, and OGG formats are allowed';
                } else {
                    errorMsg = err.message;
                }
            }
            return res.status(400).json({ error: errorMsg });
        }

        try {
            const { title, description, address, price, barangay, category, petFriendly, allowedPets, occupancy, parking, rules, landmarks, numberOfRooms, areaSqm, latitude, longitude } = req.body;

            // Define field validations with friendly messages
            const validations = {
                title: {
                    required: true,
                    message: "Don't forget to add a title for your property"
                },
                description: {
                    required: true,
                    message: "Please add a description to help people understand your property better"
                },
                address: {
                    required: true,
                    message: "Make sure to provide the complete address of your property"
                },
                price: {
                    required: true,
                    message: "Don't forget to set a price for your property",
                    validate: value => !isNaN(Number(value)) && Number(value) > 0,
                    errorMessage: "The price should be a valid number greater than 0"
                },
                barangay: {
                    required: true,
                    message: "Please select which barangay your property is located in"
                },
                category: {
                    required: true,
                    message: "Don't forget to specify what type of property you're listing"
                },
                numberOfRooms: {
                    required: false,
                    message: "You haven't specified how many rooms the property has",
                    validate: value => !value || (!isNaN(Number(value)) && Number(value) >= 0),
                    errorMessage: "Number of rooms should be 0 or more"
                },
                occupancy: {
                    required: false,
                    message: "Consider specifying the maximum number of occupants allowed",
                    validate: value => !value || (!isNaN(Number(value)) && Number(value) > 0),
                    errorMessage: "Maximum occupancy should be greater than 0"
                },
                areaSqm: {
                    required: false,
                    message: "Adding the floor area will help people better understand the property size",
                    validate: value => !value || (!isNaN(Number(value)) && Number(value) > 0),
                    errorMessage: "Floor area should be greater than 0 square meters"
                },
                landmarks: {
                    required: false,
                    message: "Consider adding nearby landmarks to help people locate your property"
                },
                rules: {
                    required: false,
                    message: "You might want to add some house rules for your property"
                },
                allowedPets: {
                    required: false,
                    dependsOn: 'petFriendly',
                    message: "Since this is a pet-friendly property, you might want to specify which pets are allowed"
                }
            };

            // Collect all validation errors
            const errors = [];
            const suggestions = [];

            // Check required fields and validations
            for (const [field, validation] of Object.entries(validations)) {
                const value = req.body[field];
                
                // Check required fields
                if (validation.required && (!value || value.toString().trim() === '')) {
                    errors.push(validation.message);
                    continue;
                }

                // Check dependent fields
                if (validation.dependsOn && req.body[validation.dependsOn] === true && (!value || value.toString().trim() === '')) {
                    suggestions.push(validation.message);
                }

                // Check validations if value is provided
                if (value && validation.validate && !validation.validate(value)) {
                    errors.push(validation.errorMessage || validation.message);
                }

                // Add suggestions for empty optional fields
                if (!validation.required && !value && !validation.dependsOn) {
                    suggestions.push(validation.message);
                }
            }

            // Return if there are any validation errors
            if (errors.length > 0) {
                return res.status(400).json({
                    errors: errors, // Send just the array of error messages
                    suggestions: suggestions
                });
            }

            const landlord = req.user.id;

            // Verification gating (temporarily disabled if feature flag set)
            if (process.env.DISABLE_VERIFICATION !== 'true') {
                if (req.user.role === 'landlord') {
                    if (req.user.landlordVerified === false || req.user.landlordVerified === undefined) {
                        const { default: User } = await import('../models/User.js');
                        const landlordUser = await User.findById(landlord).select('landlordVerified');
                        if (!landlordUser || !landlordUser.landlordVerified) {
                            return res.status(403).json({ error: 'Landlord not verified. Please upload required IDs and wait for admin approval.' });
                        }
                    } else if (!req.user.landlordVerified) {
                        return res.status(403).json({ error: 'Landlord not verified. Please upload required IDs and wait for admin approval.' });
                    }
                }
            } // else bypass verification

            let images = [];
            let video = '';
            let panorama360 = '';

            // Upload all media to Cloudinary
            // Handle media uploads
            // Handle image uploads
            if (req.files?.images && req.files.images.length > 0) {
                try {
                    // Check file sizes and types before uploading
                    for (const file of req.files.images) {
                        if (file.size > 10 * 1024 * 1024) {
                            throw new Error(`Image "${file.originalname}" exceeds 10MB limit`);
                        }
                        if (!file.mimetype.startsWith('image/')) {
                            throw new Error(`File "${file.originalname}" is not a valid image format`);
                        }
                    }
                    images = await uploadToCloudinary(req.files.images, 'images', 'image');
                } catch (error) {
                    // Clean up any uploaded files if there was an error
                    if (images.length > 0) {
                        await deleteCloudinaryAssets(images);
                    }
                    return res.status(400).json({ error: error.message });
                }
            }
            
            // Handle video upload
            if (req.files?.video && req.files.video.length > 0) {
                try {
                    const videoFile = req.files.video[0];
                    if (videoFile.size > 50 * 1024 * 1024) {
                        throw new Error('Video file exceeds 50MB size limit');
                    }
                    if (!['video/mp4', 'video/webm', 'video/ogg'].includes(videoFile.mimetype)) {
                        throw new Error('Invalid video format. Only MP4, WebM, or OGG formats are allowed');
                    }
                    video = await uploadToCloudinary(req.files.video, 'videos', 'video');
                } catch (error) {
                    // Clean up any uploaded files if there was an error
                    if (images.length > 0) {
                        await deleteCloudinaryAssets(images);
                    }
                    return res.status(400).json({ error: error.message });
                }
            }
            
            // Handle panorama upload
            if (req.files?.panorama360 && req.files.panorama360.length > 0) {
                try {
                    const panoramaFile = req.files.panorama360[0];
                    if (panoramaFile.size > 10 * 1024 * 1024) {
                        throw new Error('360° Panorama image exceeds 10MB size limit');
                    }
                    if (!panoramaFile.mimetype.startsWith('image/')) {
                        throw new Error('360° Panorama must be an image file (JPG, PNG, or WebP)');
                    }
                    const panoramaResult = await uploadToCloudinary(req.files.panorama360, 'panorama', 'image');
                    panorama360 = panoramaResult[0] || '';
                } catch (error) {
                    // Clean up any uploaded files if there was an error
                    if (images.length > 0) {
                        await deleteCloudinaryAssets(images);
                    }
                    if (video) {
                        await deleteCloudinaryAssets([video]);
                    }
                    return res.status(400).json({ error: error.message });
                }
            }

            if (images.length > MAX_IMAGES) {
                // Clean up uploaded images if we exceed the limit
                await deleteCloudinaryAssets(images);
                return res.status(400).json({ error: `Maximum of ${MAX_IMAGES} images exceeded` });
            }

            const allowedAvailability = ['Available','Fully Occupied','Not Yet Ready'];

            // ensure availabilityStatus defaults to 'Available' unless explicitly set by landlord to a valid option
            const availabilityStatus = (req.body.availabilityStatus && allowedAvailability.includes(req.body.availabilityStatus)) ? req.body.availabilityStatus : 'Available';

            // Ensure numeric unit counts
            const totalUnitsNum = num(req.body.totalUnits, 1);
            const availableUnitsInit = typeof req.body.availableUnits !== 'undefined' ? num(req.body.availableUnits, totalUnitsNum) : totalUnitsNum;

            const newProperty = new Property({
                landlord,
                title,
                description,
                address,
                price: num(price),
                barangay,
                category,
                petFriendly: petFriendly === 'true' || petFriendly === true,
                allowedPets,
                occupancy: num(occupancy, 1),
                parking: parking === 'true' || parking === true,
                rules,
                landmarks,
                numberOfRooms: num(numberOfRooms, 0),
                areaSqm: num(areaSqm, 0),
                images,
                video,
                panorama360,
                latitude: latitude ? Number(latitude) : null,
                longitude: longitude ? Number(longitude) : null,
                status: 'approved', // auto-approved to avoid admin bottleneck
                availabilityStatus,
                totalUnits: totalUnitsNum,
                availableUnits: availableUnitsInit
            });

            await newProperty.save();
            
            // Return Cloudinary URLs directly - no need for formatting
            const responseProperty = {
                ...newProperty._doc,
                images: newProperty.images, // Already Cloudinary URLs
                video: newProperty.video, // Already Cloudinary URL
                panorama360: newProperty.panorama360 // Already Cloudinary URL
            };
            
            res.status(201).json({ message: "Property added successfully!", property: responseProperty });

        } catch (error) {
            console.error("Add Property Error:", error);
            // Clean up any uploaded files in case of error
            const filesToDelete = [
                ...(images || []),
                ...(video ? [video] : []),
                ...(panorama360 ? [panorama360] : [])
            ].filter(Boolean);

            if (filesToDelete.length > 0) {
                try {
                    await deleteCloudinaryAssets(filesToDelete);
                } catch (cleanupError) {
                    console.error("Error cleaning up files:", cleanupError);
                }
            }
            
            res.status(500).json({ error: "Server error while adding property" });
        }
    });
};

// 🏡 Get All Properties
export const getAllProperties = async (req, res) => {
    try {
        const { propertyType } = req.query;
        
        // Build query object
        const query = {};
        if (propertyType && ["For Rent", "For Sale"].includes(propertyType)) {
            query.propertyType = propertyType;
        }
        
        const properties = await Property.find(query).populate('landlord', 'fullName username profilePic address contactNumber role landlordVerified');
        // Filter out properties whose landlord is null (deleted)
        const filtered = properties.filter(property => property.landlord !== null);
        
        res.status(200).json(filtered.map(property => ({
            ...property._doc,
            images: property.images, // Cloudinary URLs - return as-is
            video: property.video, // Cloudinary URL - return as-is
            panorama360: property.panorama360, // Cloudinary URL - return as-is
            latitude: property.latitude,
            longitude: property.longitude,
            landlordProfile: property.landlord ? {
                id: property.landlord._id,
                fullName: property.landlord.fullName || property.landlord.username || 'Landlord',
                username: property.landlord.username || '',
                contactNumber: property.landlord.contactNumber || '',
                address: property.landlord.address || '',
                verified: !!property.landlord.landlordVerified,
                profilePic: property.landlord.profilePic || '' // Cloudinary URL or empty
            } : null
        })));
    } catch (error) {
        console.error('Get Properties Error:', error);
        if (error instanceof mongoose.Error) {
            console.error('Mongoose Error Details:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
                errors: error.errors
            });
        }
        res.status(500).json({ error: 'Error fetching properties', details: error.message });
    }
};

// 🏡 Get Properties by Landlord
export const getPropertiesByLandlord = async (req, res) => {
    try {
        const properties = await Property.find({ landlord: req.user.id }).populate('landlord', 'fullName username profilePic landlordVerified contactNumber');
        res.status(200).json(properties.map(p => ({
            ...p._doc,
            images: p.images || [], // Cloudinary URLs - return as-is
            video: p.video, // Cloudinary URL - return as-is
            panorama360: p.panorama360, // Cloudinary URL - return as-is
            landlordProfile: p.landlord ? {
                id: p.landlord._id,
                fullName: p.landlord.fullName || p.landlord.username || 'You',
                username: p.landlord.username || '',
                contactNumber: p.landlord.contactNumber || '',
                verified: !!p.landlord.landlordVerified,
                profilePic: p.landlord.profilePic || '' // Cloudinary URL or empty
            } : null
        })));
    } catch (error) {
        console.error('Get Landlord Properties Error:', error);
        res.status(500).json({ error: 'Error fetching your properties' });
    }
};

// 🏡 Get Single Property
export const getProperty = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id).populate('landlord', 'fullName username profilePic address contactNumber landlordVerified');
        if (!property) return res.status(404).json({ error: 'Property not found' });
        res.status(200).json({
            ...property._doc,
            images: property.images, // Cloudinary URLs - return as-is
            video: property.video, // Cloudinary URL - return as-is
            panorama360: property.panorama360, // Cloudinary URL - return as-is
            landlordProfile: property.landlord ? {
                id: property.landlord._id,
                fullName: property.landlord.fullName || property.landlord.username || 'Landlord',
                username: property.landlord.username || '',
                contactNumber: property.landlord.contactNumber || '',
                address: property.landlord.address || '',
                verified: !!property.landlord.landlordVerified,
                profilePic: property.landlord.profilePic || '' // Cloudinary URL or empty
            } : null
        });
    } catch (error) {
        console.error('Get Property Error:', error);
        res.status(500).json({ error: 'Error retrieving property' });
    }
};

// 🏡 Update Property
export const updateProperty = async (req, res) => {
    uploadMemory(req, res, async (err) => {
        if (err) {
            console.error("Multer upload error:", err);
            return res.status(400).json({ error: err.message || "Error uploading media" });
        }

        try {
            const property = await Property.findById(req.params.id);
            if (!property) {
                console.error("Property not found for update, id:", req.params.id);
                return res.status(404).json({ error: "Property not found" });
            }

            if (property.landlord.toString() !== req.user.id) {
                return res.status(403).json({ error: "Unauthorized" });
            }

            const updates = { ...req.body };
            
            // Remove protected fields
            delete updates.landlord;
            delete updates.status;

            // Define validations with friendly messages for update
            const validations = {
                title: {
                    required: true,
                    message: "The property title cannot be empty"
                },
                description: {
                    required: true,
                    message: "Please provide a description for your property"
                },
                address: {
                    required: true,
                    message: "The property address cannot be empty"
                },
                price: {
                    required: true,
                    message: "Don't forget to set a price",
                    validate: value => !isNaN(Number(value)) && Number(value) > 0,
                    errorMessage: "The price should be a valid number greater than 0"
                },
                barangay: {
                    required: true,
                    message: "Please select a barangay for your property"
                },
                category: {
                    required: true,
                    message: "The property type cannot be empty"
                },
                numberOfRooms: {
                    required: false,
                    message: "You might want to specify the number of rooms",
                    validate: value => !value || (!isNaN(Number(value)) && Number(value) >= 0),
                    errorMessage: "Number of rooms should be 0 or more"
                },
                occupancy: {
                    required: false,
                    message: "Consider adding the maximum occupancy allowed",
                    validate: value => !value || (!isNaN(Number(value)) && Number(value) > 0),
                    errorMessage: "Maximum occupancy should be greater than 0"
                },
                areaSqm: {
                    required: false,
                    message: "Adding the floor area helps people understand the property size",
                    validate: value => !value || (!isNaN(Number(value)) && Number(value) > 0),
                    errorMessage: "Floor area should be greater than 0 square meters"
                },
                landmarks: {
                    required: false,
                    message: "You might want to add nearby landmarks"
                },
                rules: {
                    required: false,
                    message: "Consider adding some property rules"
                },
                allowedPets: {
                    required: false,
                    dependsOn: 'petFriendly',
                    message: "Since this is pet-friendly, you might want to specify which pets are allowed"
                }
            };

            // Collect validation errors and suggestions
            const errors = [];
            const suggestions = [];

            // Handle boolean conversions first
            if (typeof updates.petFriendly === 'string') {
                updates.petFriendly = updates.petFriendly === 'true';
            }
            if (typeof updates.parking === 'string') {
                updates.parking = updates.parking === 'true';
            }

            // Validate fields that are being updated
            for (const [field, validation] of Object.entries(validations)) {
                if (field in updates) {
                    const value = updates[field];

                    // Check required fields
                    if (validation.required && (!value || value.toString().trim() === '')) {
                        errors.push(validation.message);
                        continue;
                    }

                    // Check validations if value is provided
                    if (value && validation.validate && !validation.validate(value)) {
                        errors.push(validation.errorMessage || validation.message);
                    }
                }

                // Check dependent fields
                if (validation.dependsOn && 
                    updates[validation.dependsOn] === true && 
                    (!updates[field] || updates[field].toString().trim() === '')) {
                    suggestions.push(validation.message);
                }
            }

            // Return if there are any validation errors
            if (errors.length > 0) {
                return res.status(400).json({
                    errors: errors, // Send just the array of error messages
                    suggestions: suggestions
                });
            }

            let updatedImages = [...property.images];
            let updatedVideo = property.video || '';
            let updatedPanorama = property.panorama360 || '';

            // Remove deleted images from the property
            if (req.body.deletedImages) {
                const imagesToDelete = updatedImages.filter(img => 
                    req.body.deletedImages.some(deleted => img.includes(deleted))
                );
                
                // Delete images from Cloudinary
                await deleteCloudinaryAssets(imagesToDelete);
                
                // Remove from the array
                updatedImages = updatedImages.filter(img => 
                    !req.body.deletedImages.some(deleted => img.includes(deleted))
                );
            }

            // Handle new image uploads
            if (req.files?.images && req.files.images.length > 0) {
                const newImages = await uploadToCloudinary(req.files.images, 'images', 'image');
                updatedImages = [...updatedImages, ...newImages];
            }

            if (updatedImages.length > MAX_IMAGES) {
                // Delete just-uploaded new images to avoid orphan files in Cloudinary
                const overflow = updatedImages.length - MAX_IMAGES;
                const imagesToDelete = updatedImages.slice(-overflow);
                await deleteCloudinaryAssets(imagesToDelete);
                return res.status(400).json({ error: `Maximum of ${MAX_IMAGES} images allowed` });
            }

            // Handle video upload / replacement
            if (req.files?.video && req.files.video.length > 0) {
                // Delete previous video from Cloudinary if exists
                if (updatedVideo) {
                    await deleteCloudinaryAssets([updatedVideo]);
                }
                updatedVideo = await uploadToCloudinary(req.files.video, 'videos', 'video');
            }

            // Allow explicit video removal
            if (req.body.removeVideo === 'true' && updatedVideo) {
                await deleteCloudinaryAssets([updatedVideo]);
                updatedVideo = '';
            }

            // Handle panorama360 upload/replacement
            if (req.files?.panorama360 && req.files.panorama360.length > 0) {
                // Delete previous panorama from Cloudinary if exists
                if (updatedPanorama) {
                    await deleteCloudinaryAssets([updatedPanorama]);
                }
                const newPanorama = await uploadToCloudinary(req.files.panorama360, 'panorama', 'image');
                updatedPanorama = newPanorama[0] || '';
            }

            // Allow explicit panorama removal
            if (req.body.removePanorama === 'true' && updatedPanorama) {
                await deleteCloudinaryAssets([updatedPanorama]);
                updatedPanorama = '';
            }

            // Prevent landlords from arbitrarily changing admin workflow status
            if (req.body.status) delete req.body.status;

            // Allow landlords to change availabilityStatus but validate values
            const allowedAvailability = ['Available','Fully Occupied','Not Yet Ready'];
            let availabilityStatus;
            if (req.body.availabilityStatus && allowedAvailability.includes(req.body.availabilityStatus)) {
                availabilityStatus = req.body.availabilityStatus;
            }

            // Handle totalUnits / availableUnits adjustments
            const updatedData = {
                ...req.body,
                ...(availabilityStatus ? { availabilityStatus } : {}),
                price: req.body.price !== undefined ? num(req.body.price) : property.price,
                occupancy: req.body.occupancy !== undefined ? num(req.body.occupancy, 1) : property.occupancy,
                petFriendly: req.body.petFriendly !== undefined ? (req.body.petFriendly === 'true' || req.body.petFriendly === true) : property.petFriendly,
                parking: req.body.parking !== undefined ? (req.body.parking === 'true' || req.body.parking === true) : property.parking,
                numberOfRooms: req.body.numberOfRooms ? num(req.body.numberOfRooms, 0) : (property.numberOfRooms || 0),
                areaSqm: req.body.areaSqm ? num(req.body.areaSqm, 0) : (property.areaSqm || 0),
                images: updatedImages,
                video: updatedVideo,
                panorama360: updatedPanorama
            };

            // If landlord provided totalUnits, reconcile availableUnits
            if (req.body.totalUnits !== undefined) {
                const newTotal = num(req.body.totalUnits, property.totalUnits || 1);
                // compute delta
                const delta = newTotal - (property.totalUnits || 0);
                let newAvailable = property.availableUnits || 0;
                if (delta > 0) {
                    // add newly created units to available pool
                    newAvailable = newAvailable + delta;
                } else if (delta < 0) {
                    // If total decreased, reduce available units but never below 0
                    newAvailable = Math.max(0, newAvailable + delta);
                }
                // If landlord explicitly sets availableUnits, honor but clamp
                if (req.body.availableUnits !== undefined) {
                    newAvailable = Math.min(newTotal, Math.max(0, num(req.body.availableUnits, newAvailable)));
                }
                updatedData.totalUnits = newTotal;
                updatedData.availableUnits = newAvailable;
                // Keep availabilityStatus consistent with availableUnits
                if (newAvailable <= 0) updatedData.availabilityStatus = 'Fully Occupied';
                else updatedData.availabilityStatus = updatedData.availabilityStatus || 'Available';
            } else if (req.body.availableUnits !== undefined) {
                // If only availableUnits was provided, clamp to existing totalUnits
                const clamped = Math.min(property.totalUnits || 0, Math.max(0, num(req.body.availableUnits, property.availableUnits || 0)));
                updatedData.availableUnits = clamped;
                if (clamped <= 0) updatedData.availabilityStatus = 'Fully Occupied';
                else updatedData.availabilityStatus = updatedData.availabilityStatus || 'Available';
            }

            const updatedProperty = await Property.findByIdAndUpdate(req.params.id, updatedData, { new: true });

            res.json({
                ...updatedProperty._doc,
                images: updatedProperty.images, // Cloudinary URLs - return as-is
                video: updatedProperty.video, // Cloudinary URL - return as-is
                panorama360: updatedProperty.panorama360 // Cloudinary URL - return as-is
            });
        } catch (error) {
            console.error("UpdateProperty error:", error);
            res.status(500).json({ error: error.message, stack: error.stack });
        }
    });
};

// 🛡️ Admin: update status
export const setPropertyStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const { id } = req.params;
        const { status } = req.body;
        const allowed = ['approved','pending','rejected','archived'];
        if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
        const property = await Property.findByIdAndUpdate(id, { status }, { new: true });
        if (!property) return res.status(404).json({ error: 'Property not found' });
        res.json({ message:'Status updated', property: {
            ...property._doc,
            images: property.images, // Cloudinary URLs - return as-is
            video: property.video // Cloudinary URL - return as-is
        }});
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// 🏡 Delete Property
export const deleteProperty = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);
        if (!property) return res.status(404).json({ error: "Property not found" });

        if (property.landlord.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: "Unauthorized" });
        }

        // Remove all media from Cloudinary
        const assetsToDelete = [
            ...property.images,
            property.video,
            property.panorama360
        ].filter(Boolean); // Remove empty strings

        await deleteCloudinaryAssets(assetsToDelete);

        await property.deleteOne();
        res.status(200).json({ message: "Property deleted successfully" });

    } catch (error) {
        console.error("Delete Property Error:", error);
        res.status(500).json({ error: "Error deleting property" });
    }
};

// Landlord: adjust availability or availableUnits manually
export const setPropertyAvailability = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);
        if (!property) return res.status(404).json({ error: 'Property not found' });
        if (property.landlord.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

        // Accept availableUnits and/or availabilityStatus in body
        const updates = {};
        if (req.body.availableUnits !== undefined) {
            const v = num(req.body.availableUnits, property.availableUnits || 0);
            updates.availableUnits = Math.max(0, Math.min(v, req.body.totalUnits !== undefined ? num(req.body.totalUnits, property.totalUnits || 0) : property.totalUnits || v));
        }
        if (req.body.totalUnits !== undefined) {
            const t = num(req.body.totalUnits, property.totalUnits || 0);
            updates.totalUnits = t;
            // ensure availableUnits does not exceed total
            if (updates.availableUnits === undefined) {
                updates.availableUnits = Math.min(property.availableUnits || 0, t);
            } else {
                updates.availableUnits = Math.min(updates.availableUnits, t);
            }
        }
        if (req.body.availabilityStatus) {
            const allowedAvailability = ['Available','Fully Occupied','Not Yet Ready'];
            if (allowedAvailability.includes(req.body.availabilityStatus)) updates.availabilityStatus = req.body.availabilityStatus;
        }

        // If landlord updated availableUnits (or totalUnits caused a change),
        // and they didn't explicitly set availabilityStatus, auto-set it to
        // 'Fully Occupied' when availableUnits <= 0 so public listings behave correctly.
        if (typeof updates.availableUnits !== 'undefined' && !updates.availabilityStatus) {
            if (updates.availableUnits <= 0) {
                updates.availabilityStatus = 'Fully Occupied';
            } else {
                // If there are units available and no explicit status provided,
                // default to 'Available' to ensure consistency.
                updates.availabilityStatus = 'Available';
            }
        }

        const updated = await Property.findByIdAndUpdate(req.params.id, updates, { new: true });
        res.json({ message: 'Availability updated', property: updated });
    } catch (e) {
        console.error('setPropertyAvailability error', e);
        res.status(500).json({ error: e.message });
    }
};