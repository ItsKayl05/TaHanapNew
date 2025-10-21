import multer from "multer";
import mongoose from 'mongoose';
import Property, { PROPERTY_TYPES } from "../models/Property.js";
import User from "../models/User.js";

const MAX_IMAGES = 8;

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        // Handle image fields
        if (file.fieldname === 'images' || file.fieldname === 'panorama360Images' || file.fieldname === 'panorama360') {
            if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files allowed in ' + file.fieldname + ' field'));
            return cb(null, true);
        }
        // Handle video field
        if (file.fieldname === 'video') {
            const allowedVideo = ['video/mp4', 'video/webm', 'video/ogg'];
            if (!allowedVideo.includes(file.mimetype)) return cb(new Error('Invalid video format. Allowed: mp4, webm, ogg'));
            return cb(null, true);
        }
        // Log unexpected field for debugging
        console.warn('Unexpected field received:', file.fieldname);
        cb(new Error('Unexpected field: ' + file.fieldname));
    }
}).fields([
    { name: 'images', maxCount: MAX_IMAGES },
    { name: 'video', maxCount: 1 },
    { name: 'panorama360Images', maxCount: 5 }, // Allow up to 5 panoramic images
    { name: 'panorama360', maxCount: 5 } // For backward compatibility
]);

export const uploadMemory = memoryUpload;

const num = (v, def = 0) => {
    console.log('Debug - num() helper called with:', { value: v, default: def, typeOf: typeof v });
    
    if (v === null || v === undefined || v === '') {
        console.log('Debug - num(): returning default due to null/undefined/empty');
        return def;
    }

    // Handle array input by taking the first non-empty value
    if (Array.isArray(v)) {
        const firstValue = v.find(item => item !== null && item !== undefined && item !== '');
        if (!firstValue) {
            console.log('Debug - num(): array is empty or contains only null/undefined values');
            return def;
        }
        v = firstValue;
    }
    
    // Convert comma-formatted numbers to standard format
    let normalized = typeof v === 'string' ? v.replace(/,/g, '') : v;
    const n = Number(normalized);
    console.log('Debug - num(): parsed number:', { original: v, normalized, parsed: n, isFinite: Number.isFinite(n) });
    
    const result = Number.isFinite(n) && n >= 0 ? n : def;
    console.log('Debug - num(): returning:', result);
    return result;
};

const deleteCloudinaryAssets = async (urls) => {
    try {
        const { extractPublicId, default: cloudinary } = await import('../utils/cloudinary.js');
        
        for (const url of urls) {
            try {
                if (!url || !url.startsWith('http')) continue;
                
                const publicId = extractPublicId(url);
                if (!publicId) continue;

                const resourceType = url.includes('/video/') ? 'video' : 'image';
                
                await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
            } catch (innerErr) {
                console.error('[Cloudinary Delete] Error processing URL for deletion:', innerErr);
            }
        }
    } catch (err) {
        console.error('[Cloudinary Delete] Error deleting Cloudinary assets:', err);
    }
};

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
                throw e;
            }
        }
        
        return resourceType === 'image' ? urls : urls[0] || '';
    } catch (error) {
        console.error('Error in uploadToCloudinary:', error);
        throw error;
    }
};

export const addProperty = async (req, res) => {
    let images = [];
    let video = '';
    let panorama360Images = [];

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
            // Parse all fields with proper fallbacks and handle field name inconsistencies
            const {
                propertyType,
                title,
                address,
                price,
                barangay,
                listingType,
                listingTypeAlt, // Handle both field names (removed incorrect mapping)
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
            } = req.body;

            console.log('Received property data:', {
                propertyType,
                title,
                address,
                price,
                barangay,
                listingType,
                listingTypeAlt,
                propertyCondition,
                floorArea: {
                    raw: floorArea,
                    isArray: Array.isArray(floorArea),
                    value: Array.isArray(floorArea) ? floorArea[0] : floorArea
                },
                lotArea: {
                    raw: lotArea,
                    isArray: Array.isArray(lotArea),
                    value: Array.isArray(lotArea) ? lotArea[0] : lotArea
                },
                numberOfFloors: {
                    raw: numberOfFloors,
                    isArray: Array.isArray(numberOfFloors),
                    value: Array.isArray(numberOfFloors) ? numberOfFloors[0] : numberOfFloors
                }
            });

            // Determine the listing type and property type
            const actualListingType = String(listingType || '').trim();
            const actualPropertyType = String(propertyType || '').trim();

            // Enhanced validation with better error handling
            const errors = [];
            
            const validations = {
                propertyType: {
                    required: true,
                    value: actualPropertyType,
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
                    validate: value => !isNaN(Number(value)) && Number(value) > 0,
                    errorMessage: "The price should be a valid number greater than 0"
                },
                barangay: {
                    required: true,
                    value: barangay,
                    message: "Please select which barangay your property is located in"
                },
                listingType: {
                    required: true,
                    value: actualListingType,
                    message: "Please select listing type (For Rent or For Sale)"
                },
                areaSqm: {
                    required: true,
                    value: areaSqm,
                    message: "Please provide the floor area (in square meters)",
                    validate: value => !isNaN(Number(value)) && Number(value) > 0,
                    errorMessage: "Floor area should be a number greater than 0"
                },
                // NEW: Validation for floorArea, lotArea, and numberOfFloors
                floorArea: {
                    required: true,
                    value: Array.isArray(floorArea) ? floorArea[0] : floorArea,
                    message: "Please provide the floor area",
                    validate: value => {
                        const num = parseFloat(String(value).replace(/,/g, ''));
                        return !isNaN(num) && num > 0;
                    },
                    errorMessage: "Floor area should be a number greater than 0"
                },
                lotArea: {
                    required: true,
                    value: Array.isArray(lotArea) ? lotArea[0] : lotArea,
                    message: "Please provide the lot area",
                    validate: value => {
                        const num = parseFloat(String(value).replace(/,/g, ''));
                        return !isNaN(num) && num > 0;
                    },
                    errorMessage: "Lot area should be a number greater than 0"
                },
                numberOfFloors: {
                    required: true,
                    value: Array.isArray(numberOfFloors) ? numberOfFloors[0] : numberOfFloors,
                    message: "Please specify the number of floors",
                    validate: value => {
                        const num = parseInt(String(value), 10);
                        return !isNaN(num) && num > 0 && num <= 5;
                    },
                    errorMessage: "Number of floors must be between 1 and 5"
                }
            };

            // Conditional validation based on listing type
            if (actualListingType === 'For Rent') {
                validations.occupancy = {
                    required: true,
                    value: occupancy,
                    message: "Please specify maximum occupancy",
                    validate: value => !isNaN(Number(value)) && Number(value) > 0 && Number(value) <= 5,
                    errorMessage: "Maximum occupancy should be between 1 and 5"
                };
            } else if (actualListingType === 'For Sale') {
                validations.propertyCondition = {
                    required: true,
                    value: propertyCondition,
                    message: "Please select the property condition"
                };
            }

            // NEW: Validate dropdown fields (1-5 range)
            if (numberOfRooms && (Number(numberOfRooms) < 0 || Number(numberOfRooms) > 5)) {
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

            // Validate listing type values
            if (actualListingType && !['For Rent', 'For Sale'].includes(actualListingType)) {
                errors.push("Listing type must be either 'For Rent' or 'For Sale'");
            }

            if (errors.length > 0) {
                console.log('Validation errors:', {
                    errors,
                    receivedData: {
                        propertyType: actualPropertyType,
                        listingType: actualListingType,
                        address,
                        price,
                        barangay,
                        floorArea,
                        lotArea,
                        numberOfFloors
                    }
                });
                return res.status(400).json({
                    error: 'Please fix the following errors',
                    details: errors
                });
            }

            const landlord = req.user.id;

            // Landlord verification check
            if (process.env.DISABLE_VERIFICATION !== 'true') {
                if (req.user.role === 'landlord') {
                    const landlordUser = await User.findById(landlord).select('landlordVerified');
                    if (!landlordUser || !landlordUser.landlordVerified) {
                        return res.status(403).json({ 
                            error: 'Landlord not verified. Please upload required IDs and wait for admin approval.' 
                        });
                    }
                }
            }

            // Upload images with better error handling
            if (req.files?.images && req.files.images.length > 0) {
                try {
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
                    if (images.length > 0) {
                        await deleteCloudinaryAssets(images);
                    }
                    return res.status(400).json({ error: error.message });
                }
            }
            
            // Upload video
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
                    if (images.length > 0) {
                        await deleteCloudinaryAssets(images);
                    }
                    return res.status(400).json({ error: error.message });
                }
            }
            
            // Upload panorama images - handle both field names for compatibility
            const panoramaFiles = req.files?.panorama360Images || req.files?.panorama360 || [];
            if (panoramaFiles.length > 0) {
                try {
                    // Validate each panorama file
                    for (const panoramaFile of panoramaFiles) {
                        if (panoramaFile.size > 10 * 1024 * 1024) {
                            throw new Error(`360° Panorama image "${panoramaFile.originalname}" exceeds 10MB size limit`);
                        }
                        if (!panoramaFile.mimetype.startsWith('image/')) {
                            throw new Error(`360° Panorama "${panoramaFile.originalname}" must be an image file (JPG, PNG, or WebP)`);
                        }
                    }

                    // Check if total panorama images don't exceed limit
                    if (panoramaFiles.length > 5) {
                        throw new Error('Maximum of 5 panoramic images allowed');
                    }

                    // Upload all panorama images
                    panorama360Images = await uploadToCloudinary(panoramaFiles, 'panorama', 'image');
                } catch (error) {
                    // Cleanup any uploaded files on error
                    if (images.length > 0) {
                        await deleteCloudinaryAssets(images);
                    }
                    if (video) {
                        await deleteCloudinaryAssets([video]);
                    }
                    if (panorama360Images.length > 0) {
                        await deleteCloudinaryAssets(panorama360Images);
                    }
                    return res.status(400).json({ error: error.message });
                }
            }

            // Validate image count
            if (images.length > MAX_IMAGES) {
                await deleteCloudinaryAssets(images);
                return res.status(400).json({ error: `Maximum of ${MAX_IMAGES} images exceeded` });
            }

            // Process availability status
            const allowedAvailability = ['Available','Not Available'];
            const finalAvailabilityStatus = (availabilityStatus && allowedAvailability.includes(availabilityStatus)) 
                ? availabilityStatus 
                : 'Available';

            // Normalize array fields
            const normalizeList = (v) => {
                if (!v && v !== 0) return [];
                if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
                if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
                return [];
            };

            const normalizedAllowedPets = normalizeList(allowedPets);
            const normalizedBills = normalizeList(billsIncluded);
            const normalizedHighlights = normalizeList(marketHighlights);

            // Process numeric fields
            const processedFloorArea = Array.isArray(floorArea) && floorArea.length > 0 ? floorArea[0] : floorArea;
            const processedLotArea = Array.isArray(lotArea) && lotArea.length > 0 ? lotArea[0] : lotArea;
            const processedNumberOfFloors = Array.isArray(numberOfFloors) && numberOfFloors.length > 0 ? numberOfFloors[0] : numberOfFloors;

            // Create base property data
            const propertyData = {
                landlord,
                title: actualPropertyType,
                address: address ? address.trim() : '',
                price: num(price),
                barangay: barangay ? barangay.trim() : '',
                propertyType: actualPropertyType,
                listingType: actualListingType,
                petFriendly: petFriendly === 'true' || petFriendly === true,
                allowedPets: normalizedAllowedPets,
                occupancy: num(occupancy, 1),
                parking: parking === 'true' || parking === true,
                rules: rules || '',
                landmarks: landmarks || '',
                numberOfRooms: num(numberOfRooms, 0),
                areaSqm: num(areaSqm, 0),
                // Process array fields properly
                floorArea: num(processedFloorArea, 0),
                lotArea: num(processedLotArea, 0),
                numberOfFloors: num(processedNumberOfFloors, 0),
                billsIncluded: normalizedBills,
                marketHighlights: normalizedHighlights,
                images,
                video,
                panorama360Images,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                status: 'approved',
                availabilityStatus: finalAvailabilityStatus
            };

            // Only add propertyCondition for 'For Sale' listings
            if (actualListingType === 'For Sale' && propertyCondition && propertyCondition.trim() !== '') {
                propertyData.propertyCondition = propertyCondition;
            }
            // For 'For Rent' listings, explicitly set to empty string
            else if (actualListingType === 'For Rent') {
                propertyData.propertyCondition = '';
            }

            const newProperty = new Property(propertyData);
            await newProperty.save();
            
            // Populate landlord info for response
            await newProperty.populate('landlord', 'fullName username profilePic address contactNumber role landlordVerified');
            
            const responseProperty = {
                ...newProperty._doc,
                images: newProperty.images,
                video: newProperty.video,
                panorama360Images: newProperty.panorama360Images,
                // NEW: Ensure new fields are included in response
                floorArea: newProperty.floorArea,
                lotArea: newProperty.lotArea,
                numberOfFloors: newProperty.numberOfFloors,
                landlordProfile: newProperty.landlord ? {
                    id: newProperty.landlord._id,
                    fullName: newProperty.landlord.fullName || newProperty.landlord.username || 'Landlord',
                    username: newProperty.landlord.username || '',
                    contactNumber: newProperty.landlord.contactNumber || '',
                    address: newProperty.landlord.address || '',
                    verified: !!newProperty.landlord.landlordVerified,
                    profilePic: newProperty.landlord.profilePic || ''
                } : null
            };
            
            console.log('Property created successfully:', responseProperty._id);
            res.status(201).json({ 
                message: "Property added successfully!", 
                property: responseProperty 
            });

        } catch (error) {
            console.error("Add Property Error:", error);
            
            // Clean up uploaded files on error
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

            // Always return a concise error message to the client (include detail for debugging)
            return res.status(500).json({ 
                error: 'Server error while adding property', 
                detail: error && error.message ? String(error.message) : 'Internal server error'
            });
        }
    });
};

export const getAllProperties = async (req, res) => {
    try {
        const { propertyType } = req.query;
        
        const query = { status: 'approved' }; // Only show approved properties
        if (propertyType && ["For Rent", "For Sale"].includes(propertyType)) {
            query.listingType = propertyType; // Fixed: Use listingType instead of propertyType
        }
        
        const properties = await Property.find(query).populate('landlord', 'fullName username profilePic address contactNumber role landlordVerified');
        const filtered = properties.filter(property => property.landlord !== null);
        
        res.status(200).json(filtered.map(property => ({
            ...property._doc,
            images: property.images,
            video: property.video,
            // Ensure listing type is included
            listingType: property.listingType || 'For Sale',
            propertyType: property.propertyType,
            // Include all other fields
            floorArea: property.floorArea,
            lotArea: property.lotArea,
            numberOfFloors: property.numberOfFloors,
            panorama360: property.panorama360,
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
        })));
    } catch (error) {
        console.error('Get Properties Error:', error);
        res.status(500).json({ error: 'Error fetching properties', details: error.message });
    }
};

export const getPropertiesByLandlord = async (req, res) => {
    try {
        const properties = await Property.find({ landlord: req.user.id }).populate('landlord', 'fullName username profilePic landlordVerified contactNumber');
        res.status(200).json(properties.map(p => ({
            ...p._doc,
            images: p.images || [],
            video: p.video,
            panorama360: p.panorama360,
            // Ensure listing type is included
            listingType: p.listingType || 'For Sale',
            propertyType: p.propertyType,
            // Include all other fields
            floorArea: p.floorArea,
            lotArea: p.lotArea,
            numberOfFloors: p.numberOfFloors,
            landlordProfile: p.landlord ? {
                id: p.landlord._id,
                fullName: p.landlord.fullName || p.landlord.username || 'You',
                username: p.landlord.username || '',
                contactNumber: p.landlord.contactNumber || '',
                verified: !!p.landlord.landlordVerified,
                profilePic: p.landlord.profilePic || ''
            } : null
        })));
    } catch (error) {
        console.error('Get Landlord Properties Error:', error);
        res.status(500).json({ error: 'Error fetching your properties' });
    }
};

export const getProperty = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id).populate('landlord', 'fullName username profilePic address contactNumber landlordVerified');
        if (!property) return res.status(404).json({ error: 'Property not found' });
        res.status(200).json({
            ...property._doc,
            images: property.images,
            video: property.video,
            // Ensure listing type is included
            listingType: property.listingType || 'For Sale',
            propertyType: property.propertyType,
            // Include all other fields
            floorArea: property.floorArea,
            lotArea: property.lotArea,
            numberOfFloors: property.numberOfFloors,
            panorama360: property.panorama360,
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
    } catch (error) {
        console.error('Get Property Error:', error);
        res.status(500).json({ error: 'Error retrieving property' });
    }
};

export const updateProperty = async (req, res) => {
    uploadMemory(req, res, async (err) => {
        if (err) {
            console.error("Multer upload error:", err);
            return res.status(400).json({ error: err.message || "Error uploading media" });
        }

        // Debug: log incoming non-file fields (keys only)
        try {
            const incomingKeys = Object.keys(req.body || {});
            console.info('updateProperty invoked for id=%s, incoming body keys=%o, files=%o', req.params.id, incomingKeys, Object.keys(req.files || {}));
        } catch (e) {
            console.info('updateProperty invoked (failed to enumerate incoming keys)');
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

            // Debug logging for incoming request
            console.log('Debug - Incoming request body:', req.body);
            console.log('Debug - Property before update:', {
                floorArea: property.floorArea,
                lotArea: property.lotArea,
                numberOfFloors: property.numberOfFloors
            });
            
            const updates = { ...req.body };
            
            // Log the updates object before cleanup
            console.log('Debug - Initial updates object:', {
                floorArea: updates.floorArea,
                lotArea: updates.lotArea,
                numberOfFloors: updates.numberOfFloors
            });
            
            delete updates.landlord;
            delete updates.status;
            delete updates.description;

            // Enhanced validation for updates
            const validations = {
                propertyType: {
                    required: true,
                    value: updates.propertyType,
                    message: "Please select a property type"
                },
                address: {
                    required: true,
                    value: updates.address,
                    message: "The property address cannot be empty"
                },
                price: {
                    required: true,
                    value: updates.price,
                    message: "Don't forget to set a price",
                    validate: value => !isNaN(Number(value)) && Number(value) > 0,
                    errorMessage: "The price should be a valid number greater than 0"
                },
                barangay: {
                    required: true,
                    value: updates.barangay,
                    message: "Please select a barangay for your property"
                },
                listingType: {
                    required: true,
                    value: updates.listingType,
                    message: "Please select listing type"
                },
                areaSqm: {
                    required: true,
                    value: updates.areaSqm,
                    message: "Please provide the floor area (in square meters)",
                    validate: value => !isNaN(Number(value)) && Number(value) > 0,
                    errorMessage: "Floor area should be a number greater than 0"
                },
                // NEW: Validation for new fields in updates
                floorArea: {
                    required: true,
                    value: updates.floorArea,
                    message: "Please provide the floor area",
                    validate: value => !isNaN(Number(value)) && Number(value) > 0,
                    errorMessage: "Floor area should be a number greater than 0"
                },
                lotArea: {
                    required: true,
                    value: updates.lotArea,
                    message: "Please provide the lot area",
                    validate: value => !isNaN(Number(value)) && Number(value) > 0,
                    errorMessage: "Lot area should be a number greater than 0"
                },
                numberOfFloors: {
                    required: true,
                    value: updates.numberOfFloors,
                    message: "Please specify the number of floors",
                    validate: value => {
                        const num = Number(value);
                        return !isNaN(num) && Number.isInteger(num) && num >= 1 && num <= 5;
                    },
                    errorMessage: "Number of floors must be a whole number between 1 and 5"
                }
            };

            // Conditional validation for occupancy
            if (updates.listingType === 'For Rent' || property.propertyType === 'For Rent') {
                validations.occupancy = {
                    required: true,
                    value: updates.occupancy,
                    message: "Please specify maximum occupancy",
                    validate: value => !isNaN(Number(value)) && Number(value) > 0 && Number(value) <= 5,
                    errorMessage: "Maximum occupancy should be between 1 and 5"
                };
            }

            const errors = [];

            // Handle boolean conversions
            if (typeof updates.petFriendly === 'string') {
                updates.petFriendly = updates.petFriendly === 'true';
            }
            if (typeof updates.parking === 'string') {
                updates.parking = updates.parking === 'true';
            }

            const normalizeList = (v) => {
                if (!v && v !== 0) return [];
                if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
                if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
                return [];
            };

            if ('allowedPets' in updates) updates.allowedPets = normalizeList(updates.allowedPets);
            if ('billsIncluded' in updates) updates.billsIncluded = normalizeList(updates.billsIncluded);
            if ('marketHighlights' in updates) updates.marketHighlights = normalizeList(updates.marketHighlights);
            if ('propertyCondition' in updates) updates.propertyCondition = updates.propertyCondition || undefined;

            // NEW: Validate dropdown fields in updates
            if (updates.numberOfRooms && (Number(updates.numberOfRooms) < 0 || Number(updates.numberOfRooms) > 5)) {
                errors.push("Number of rooms must be between 1 and 5");
            }

            for (const [field, validation] of Object.entries(validations)) {
                if (field in updates) {
                    const value = updates[field];

                    if (validation.required && (!value || value.toString().trim() === '')) {
                        errors.push(validation.message);
                        continue;
                    }

                    if (value && validation.validate && !validation.validate(value)) {
                        errors.push(validation.errorMessage || validation.message);
                    }
                }
            }

            if (errors.length > 0) {
                // Add some server-side debugging output to help diagnose why the client request failed validation
                try {
                    console.warn('UpdateProperty validation failed for property', req.params.id);
                    console.warn('Validation errors:', JSON.stringify(errors));
                    // Log a compact snapshot of the incoming updates (avoid logging files/buffers)
                    const incomingSnapshot = { ...updates };
                    delete incomingSnapshot.images;
                    delete incomingSnapshot.video;
                    delete incomingSnapshot.panorama360;
                    console.warn('Incoming update snapshot:', JSON.stringify(incomingSnapshot));
                } catch (logErr) {
                    console.warn('Error while logging validation context', logErr);
                }

                return res.status(400).json({
                    error: 'Please fix the following errors',
                    details: errors
                });
            }

            let updatedImages = [...property.images];
            let updatedVideo = property.video || '';
            let updatedPanoramaImages = [...(property.panorama360Images || [])];

            // Handle deleted images
            if (req.body.deletedImages) {
                let deletedImagesArray;
                try {
                    if (Array.isArray(req.body.deletedImages)) {
                        deletedImagesArray = req.body.deletedImages;
                    } else {
                        // It may be a JSON string or a plain single filename string
                        try {
                            deletedImagesArray = JSON.parse(req.body.deletedImages);
                        } catch (e) {
                            // Treat as single filename
                            deletedImagesArray = [req.body.deletedImages];
                        }
                    }
                } catch (e) {
                    deletedImagesArray = [];
                }

                const imagesToDelete = updatedImages.filter(img => 
                    deletedImagesArray.some(deleted => img.includes(deleted))
                );

                if (imagesToDelete.length > 0) {
                    await deleteCloudinaryAssets(imagesToDelete);
                }

                updatedImages = updatedImages.filter(img => 
                    !deletedImagesArray.some(deleted => img.includes(deleted))
                );
            }

            // Handle new images
            if (req.files?.images && req.files.images.length > 0) {
                const newImages = await uploadToCloudinary(req.files.images, 'images', 'image');
                updatedImages = [...updatedImages, ...newImages];
            }

            if (updatedImages.length > MAX_IMAGES) {
                const overflow = updatedImages.length - MAX_IMAGES;
                const imagesToDelete = updatedImages.slice(-overflow);
                await deleteCloudinaryAssets(imagesToDelete);
                return res.status(400).json({ error: `Maximum of ${MAX_IMAGES} images allowed` });
            }

            // Handle video updates
            if (req.files?.video && req.files.video.length > 0) {
                if (updatedVideo) {
                    await deleteCloudinaryAssets([updatedVideo]);
                }
                updatedVideo = await uploadToCloudinary(req.files.video, 'videos', 'video');
            }

            if (req.body.removeVideo === 'true' && updatedVideo) {
                await deleteCloudinaryAssets([updatedVideo]);
                updatedVideo = '';
            }

            // Handle panorama updates
            if (req.files?.panorama360Images && req.files.panorama360Images.length > 0) {
                // Validate each new panorama file
                for (const panoramaFile of req.files.panorama360Images) {
                    if (panoramaFile.size > 10 * 1024 * 1024) {
                        throw new Error(`360° Panorama image "${panoramaFile.originalname}" exceeds 10MB size limit`);
                    }
                    if (!panoramaFile.mimetype.startsWith('image/')) {
                        throw new Error(`360° Panorama "${panoramaFile.originalname}" must be an image file (JPG, PNG, or WebP)`);
                    }
                }

                const newPanoramaImages = await uploadToCloudinary(req.files.panorama360Images, 'panorama', 'image');
                updatedPanoramaImages = [...updatedPanoramaImages, ...newPanoramaImages];

                // Check if total panorama images don't exceed limit
                if (updatedPanoramaImages.length > 5) {
                    const overflow = updatedPanoramaImages.length - 5;
                    const panoramasToDelete = updatedPanoramaImages.slice(-overflow);
                    await deleteCloudinaryAssets(panoramasToDelete);
                    return res.status(400).json({ error: 'Maximum of 5 panoramic images allowed' });
                }
            }

            // Handle deleted panoramas
            if (req.body.deletedPanoramaImages) {
                let deletedPanoramasArray;
                try {
                    if (Array.isArray(req.body.deletedPanoramaImages)) {
                        deletedPanoramasArray = req.body.deletedPanoramaImages;
                    } else {
                        try {
                            deletedPanoramasArray = JSON.parse(req.body.deletedPanoramaImages);
                        } catch (e) {
                            deletedPanoramasArray = [req.body.deletedPanoramaImages];
                        }
                    }
                } catch (e) {
                    deletedPanoramasArray = [];
                }

                const panoramasToDelete = updatedPanoramaImages.filter(img => 
                    deletedPanoramasArray.some(deleted => img.includes(deleted))
                );

                if (panoramasToDelete.length > 0) {
                    await deleteCloudinaryAssets(panoramasToDelete);
                }

                updatedPanoramaImages = updatedPanoramaImages.filter(img => 
                    !deletedPanoramasArray.some(deleted => img.includes(deleted))
                );
            }
            if (req.body.status) delete req.body.status;

            const allowedAvailability = ['Available','Not Available'];
            let availabilityStatus;
            if (req.body.availabilityStatus && allowedAvailability.includes(req.body.availabilityStatus)) {
                availabilityStatus = req.body.availabilityStatus;
            }

            // Build update data
            // Debug log raw values before processing
            console.log('Debug - Raw body values:', {
                floorArea: req.body.floorArea,
                lotArea: req.body.lotArea,
                numberOfFloors: req.body.numberOfFloors,
                typeofFloorArea: typeof req.body.floorArea,
                typeofLotArea: typeof req.body.lotArea,
                typeofNumberOfFloors: typeof req.body.numberOfFloors
            });

            const updatedData = {
                ...req.body,
                ...(availabilityStatus ? { availabilityStatus } : {}),
                title: req.body.propertyType || property.title,
                propertyType: req.body.listingType || property.propertyType,
                price: req.body.price !== undefined ? num(req.body.price) : property.price,
                occupancy: req.body.occupancy !== undefined ? num(req.body.occupancy, 1) : property.occupancy,
                petFriendly: req.body.petFriendly !== undefined ? (req.body.petFriendly === 'true' || req.body.petFriendly === true) : property.petFriendly,
                parking: req.body.parking !== undefined ? (req.body.parking === 'true' || req.body.parking === true) : property.parking,
                numberOfRooms: req.body.numberOfRooms ? num(req.body.numberOfRooms, 0) : (property.numberOfRooms || 0),
                areaSqm: req.body.areaSqm ? num(req.body.areaSqm, 0) : (property.areaSqm || 0),
                // NEW: Process the numeric fields with more careful handling
                floorArea: req.body.floorArea !== undefined ? num(req.body.floorArea, property.floorArea || 0) : (property.floorArea || 0),
                lotArea: req.body.lotArea !== undefined ? num(req.body.lotArea, property.lotArea || 0) : (property.lotArea || 0),
                numberOfFloors: req.body.numberOfFloors !== undefined ? num(req.body.numberOfFloors, property.numberOfFloors || 0) : (property.numberOfFloors || 0),
                images: updatedImages,
                video: updatedVideo,
                panorama360Images: updatedPanoramaImages
            };

            // Handle propertyCondition based on listing type
            const incomingListingType = req.body.listingType || property.propertyType;
            if (String(incomingListingType).trim() === 'For Sale') {
                // Only set propertyCondition for 'For Sale' listings
                if (req.body.propertyCondition && req.body.propertyCondition.trim() !== '') {
                    updatedData.propertyCondition = req.body.propertyCondition;
                } else {
                    updatedData.propertyCondition = 'Brand New';
                }
            } else {
                // For 'For Rent' listings, ensure propertyCondition is empty
                updatedData.propertyCondition = '';
            }

            // Debug log processed data before update
            console.log('Debug - Final updatedData:', {
                floorArea: updatedData.floorArea,
                lotArea: updatedData.lotArea,
                numberOfFloors: updatedData.numberOfFloors
            });

            const updatedProperty = await Property.findByIdAndUpdate(
                req.params.id, 
                updatedData, 
                { new: true, runValidators: true }
            ).populate('landlord', 'fullName username profilePic address contactNumber landlordVerified');
            
            // Debug log the result after update
            console.log('Debug - After update:', {
                floorArea: updatedProperty.floorArea,
                lotArea: updatedProperty.lotArea,
                numberOfFloors: updatedProperty.numberOfFloors
            });

            res.json({
                ...updatedProperty._doc,
                images: updatedProperty.images,
                video: updatedProperty.video,
                // NEW: Include new fields in update response
                floorArea: updatedProperty.floorArea,
                lotArea: updatedProperty.lotArea,
                numberOfFloors: updatedProperty.numberOfFloors,
                panorama360Images: updatedProperty.panorama360Images,
                landlordProfile: updatedProperty.landlord ? {
                    id: updatedProperty.landlord._id,
                    fullName: updatedProperty.landlord.fullName || updatedProperty.landlord.username || 'Landlord',
                    username: updatedProperty.landlord.username || '',
                    contactNumber: updatedProperty.landlord.contactNumber || '',
                    address: updatedProperty.landlord.address || '',
                    verified: !!updatedProperty.landlord.landlordVerified,
                    profilePic: updatedProperty.landlord.profilePic || ''
                } : null
            });
        } catch (error) {
            console.error("UpdateProperty error:", error);
            res.status(500).json({ 
                error: 'Error updating property',
                detail: process.env.NODE_ENV !== 'production' ? error.message : undefined
            });
        }
    });
};

// ... rest of the controller functions remain the same
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
            images: property.images,
            video: property.video
        }});
    } catch (e) {
        res.status(500).json({ error: e.message });
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
            property.video,
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
        if (property.landlord.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

        const updates = {};
        if (req.body.availabilityStatus) {
            const allowedAvailability = ['Available','Not Available'];
            if (allowedAvailability.includes(req.body.availabilityStatus)) updates.availabilityStatus = req.body.availabilityStatus;
        }

        const updated = await Property.findByIdAndUpdate(req.params.id, updates, { new: true });
        res.json({ message: 'Availability updated', property: updated });
    } catch (e) {
        console.error('setPropertyAvailability error', e);
        res.status(500).json({ error: e.message });
    }
};