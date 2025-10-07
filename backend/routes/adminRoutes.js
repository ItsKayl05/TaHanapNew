
import express from 'express';
import User from '../models/User.js'; // Assuming User model is defined
import Property from '../models/Property.js'; // Assuming Property model is defined
import { getUserBarangayStats } from '../controllers/adminController.js';
import { lastMailStatusGetter } from '../controllers/authController.js';

const router = express.Router();

// Route to get per-barangay user stats (landlords and tenants)
router.get('/user-barangay-stats', getUserBarangayStats);

// Route to fetch total users
router.get('/total-users', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments(); // Counts all users
        const tenants = await User.countDocuments({ role: 'tenant' });
        const landlords = await User.countDocuments({ role: 'landlord' });
        res.json({ totalUsers, tenants, landlords });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching total users', error });
    }
});

// Route to fetch total properties listed
router.get('/total-properties', async (req, res) => {
    try {
        const propertyCount = await Property.countDocuments(); // Counts all properties
        // also return a quick breakdown: published vs draft
        const published = await Property.countDocuments({ status: 'published' });
        const drafts = await Property.countDocuments({ status: { $ne: 'published' } });
        res.json({ totalProperties: propertyCount, published, drafts });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching total properties', error });
    }
});

// Quick overview endpoint
router.get('/overview', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const tenants = await User.countDocuments({ role: 'tenant' });
        const landlords = await User.countDocuments({ role: 'landlord' });
        const totalProperties = await Property.countDocuments();
        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('username role createdAt');
        const recentProperties = await Property.find().sort({ createdAt: -1 }).limit(5).select('title createdAt status');
        res.json({ totalUsers, tenants, landlords, totalProperties, recentUsers, recentProperties });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching overview', error });
    }
});

// Protected debug endpoints
router.get('/mail-status', (req, res) => {
    const token = req.headers['x-debug-token'];
    if (!process.env.DEBUG_TOKEN) return res.status(403).json({ message: 'Debug token not configured on server' });
    if (!token || token !== process.env.DEBUG_TOKEN) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const status = lastMailStatusGetter();
        res.json({ ok: true, status });
    } catch (err) {
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// Cloudinary connectivity and upload test (protected by DEBUG_TOKEN header)
router.post('/cloudinary-test', async (req, res) => {
    const token = req.headers['x-debug-token'];
    if (!process.env.DEBUG_TOKEN) return res.status(403).json({ message: 'Debug token not configured on server' });
    if (!token || token !== process.env.DEBUG_TOKEN) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const { v2: cloudinary } = await import('cloudinary');
        // create a 1x1 transparent PNG buffer (base64)
        const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
        const buf = Buffer.from(pngBase64, 'base64');
        const streamifier = await import('streamifier');
        const uploadStream = cloudinary.uploader.upload_stream({ folder: 'tahanap/debug' }, (err, result) => {
            if (err) return res.status(500).json({ ok: false, error: String(err) });
            // delete it immediately
            cloudinary.uploader.destroy(result.public_id, { resource_type: 'image' }).then(() => {
                res.json({ ok: true, uploaded: result.secure_url });
            }).catch(destErr => {
                res.status(500).json({ ok: false, error: 'uploaded_but_delete_failed', detail: String(destErr) });
            });
        });
        streamifier.createReadStream(buf).pipe(uploadStream);
    } catch (err) {
        console.error('cloudinary-test error:', err);
        res.status(500).json({ ok: false, error: String(err) });
    }
});

export default router;
