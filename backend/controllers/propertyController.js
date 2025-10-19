import multer from "multer";
import mongoose from 'mongoose';
import Property from "../models/Property.js";
import User from "../models/User.js";

const MAX_IMAGES = 8;

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

const num = (v, def = 0) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : def;
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
    let panorama360 = '';

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
            const { propertyType, address, price, barangay, listingType, petFriendly, allowedPets, occupancy, parking, rules, landmarks, numberOfRooms, areaSqm, latitude, longitude } = req.body;

            const validations = {
                propertyType: {
                    required: true,
                    message: "Please select a property type"
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
                listingType: {
                    required: true,
                    message: "Please select listing type"
                },
                areaSqm: {
                    required: true,
                    message: "Please provide the floor area (in square meters)",
                    validate: value => !isNaN(Number(value)) && Number(value) > 0,
                    errorMessage: "Floor area should be a number greater than 0"
                }
            };

            if (String(listingType).trim() === 'For Rent') {
                validations.occupancy = {
                    required: true,
                    message: "Please specify maximum occupancy",
                    validate: value => !isNaN(Number(value)) && Number(value) > 0,
                    errorMessage: "Maximum occupancy should be greater than 0"
                };
            } else if (String(listingType).trim() === 'For Sale') {
                validations.propertyCondition = {
                    required: true,
                    message: "Please select the property condition"
                };
            }

            const errors = [];

            for (const [field, validation] of Object.entries(validations)) {
                const value = req.body[field];
                
                if (validation.required && (!value || value.toString().trim() === '')) {
                    errors.push(validation.message);
                    continue;
                }

                if (value && validation.validate && !validation.validate(value)) {
                    errors.push(validation.errorMessage || validation.message);
                }
            }

            if (errors.length > 0) {
                return res.status(400).json({
                    errors: errors
                });
            }

            const landlord = req.user.id;

            if (process.env.DISABLE_VERIFICATION !== 'true') {
                if (req.user.role === 'landlord') {
                    if (req.user.landlordVerified === false || req.user.landlordVerified === undefined) {
                        const landlordUser = await User.findById(landlord).select('landlordVerified');
                        if (!landlordUser || !landlordUser.landlordVerified) {
                            return res.status(403).json({ error: 'Landlord not verified. Please upload required IDs and wait for admin approval.' });
                        }
                    } else if (!req.user.landlordVerified) {
                        return res.status(403).json({ error: 'Landlord not verified. Please upload required IDs and wait for admin approval.' });
                    }
                }
            }

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
                await deleteCloudinaryAssets(images);
                return res.status(400).json({ error: `Maximum of ${MAX_IMAGES} images exceeded` });
            }

            const allowedAvailability = ['Available','Not Available'];
            const availabilityStatus = (req.body.availabilityStatus && allowedAvailability.includes(req.body.availabilityStatus)) ? req.body.availabilityStatus : 'Available';

            const totalUnitsNum = num(req.body.totalUnits, 1);

            const normalizeList = (v) => {
                if (!v && v !== 0) return [];
                if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
                if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
                return [];
            };

            const normalizedAllowedPets = normalizeList(allowedPets);
            const normalizedBills = normalizeList(req.body.billsIncluded || req.body.bills);
            const normalizedHighlights = normalizeList(req.body.marketHighlights || req.body.market_highlights || req.body.highlights);

            const newProperty = new Property({
                landlord,
                title: propertyType,
                address,
                price: num(price),
                barangay,
                propertyType: listingType,
                petFriendly: petFriendly === 'true' || petFriendly === true,
                allowedPets: normalizedAllowedPets,
                occupancy: num(occupancy, 1),
                parking: parking === 'true' || parking === true,
                rules,
                landmarks,
                numberOfRooms: num(numberOfRooms, 0),
                areaSqm: num(areaSqm, 0),
                billsIncluded: normalizedBills,
                marketHighlights: normalizedHighlights,
                propertyCondition: req.body.propertyCondition || '',
                images,
                video,
                panorama360,
                latitude: latitude ? Number(latitude) : null,
                longitude: longitude ? Number(longitude) : null,
                status: 'approved',
                availabilityStatus,
                totalUnits: totalUnitsNum
            });

            await newProperty.save();
            
            const responseProperty = {
                ...newProperty._doc,
                images: newProperty.images,
                video: newProperty.video,
                panorama360: newProperty.panorama360
            };
            
            res.status(201).json({ message: "Property added successfully!", property: responseProperty });

        } catch (error) {
            console.error("Add Property Error:", error);
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

            // Return helpful error details only in non-production environments to aid debugging
            if (process.env.NODE_ENV !== 'production') {
                return res.status(500).json({ error: 'Server error while adding property', detail: error.message, stack: error.stack });
            }

            res.status(500).json({ error: "Server error while adding property" });
        }
    });
};

export const getAllProperties = async (req, res) => {
    try {
        const { propertyType } = req.query;
        
        const query = {};
        if (propertyType && ["For Rent", "For Sale"].includes(propertyType)) {
            query.propertyType = propertyType;
        }
        
        const properties = await Property.find(query).populate('landlord', 'fullName username profilePic address contactNumber role landlordVerified');
        const filtered = properties.filter(property => property.landlord !== null);
        
        res.status(200).json(filtered.map(property => ({
            ...property._doc,
            images: property.images,
            video: property.video,
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
            
            delete updates.landlord;
            delete updates.status;
            delete updates.description;

            const validations = {
                propertyType: {
                    required: true,
                    message: "Please select a property type"
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
                listingType: {
                    required: true,
                    message: "Please select listing type"
                },
                occupancy: {
                    required: true,
                    message: "Please specify maximum occupancy",
                    validate: value => !isNaN(Number(value)) && Number(value) > 0,
                    errorMessage: "Maximum occupancy should be greater than 0"
                },
                areaSqm: {
                    required: true,
                    message: "Please provide the floor area (in square meters)",
                    validate: value => !isNaN(Number(value)) && Number(value) > 0,
                    errorMessage: "Floor area should be a number greater than 0"
                }
            };

            const errors = [];

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
            if ('propertyCondition' in updates) updates.propertyCondition = updates.propertyCondition || '';

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
                return res.status(400).json({
                    errors: errors
                });
            }

            let updatedImages = [...property.images];
            let updatedVideo = property.video || '';
            let updatedPanorama = property.panorama360 || '';

            if (req.body.deletedImages) {
                const imagesToDelete = updatedImages.filter(img => 
                    req.body.deletedImages.some(deleted => img.includes(deleted))
                );
                
                await deleteCloudinaryAssets(imagesToDelete);
                
                updatedImages = updatedImages.filter(img => 
                    !req.body.deletedImages.some(deleted => img.includes(deleted))
                );
            }

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

            if (req.files?.panorama360 && req.files.panorama360.length > 0) {
                if (updatedPanorama) {
                    await deleteCloudinaryAssets([updatedPanorama]);
                }
                const newPanorama = await uploadToCloudinary(req.files.panorama360, 'panorama', 'image');
                updatedPanorama = newPanorama[0] || '';
            }

            if (req.body.removePanorama === 'true' && updatedPanorama) {
                await deleteCloudinaryAssets([updatedPanorama]);
                updatedPanorama = '';
            }

            if (req.body.status) delete req.body.status;

            const allowedAvailability = ['Available','Not Available'];
            let availabilityStatus;
            if (req.body.availabilityStatus && allowedAvailability.includes(req.body.availabilityStatus)) {
                availabilityStatus = req.body.availabilityStatus;
            }

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
                images: updatedImages,
                video: updatedVideo,
                panorama360: updatedPanorama
            };

            if (req.body.totalUnits !== undefined) {
                const newTotal = num(req.body.totalUnits, property.totalUnits || 1);
                updatedData.totalUnits = newTotal;
                updatedData.availabilityStatus = updatedData.availabilityStatus || property.availabilityStatus || 'Available';
            }

            const updatedProperty = await Property.findByIdAndUpdate(req.params.id, updatedData, { new: true });

            res.json({
                ...updatedProperty._doc,
                images: updatedProperty.images,
                video: updatedProperty.video,
                panorama360: updatedProperty.panorama360
            });
        } catch (error) {
            console.error("UpdateProperty error:", error);
            res.status(500).json({ error: error.message, stack: error.stack });
        }
    });
};

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
            property.panorama360
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
        if (req.body.totalUnits !== undefined) {
            updates.totalUnits = num(req.body.totalUnits, property.totalUnits || 0);
        }
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