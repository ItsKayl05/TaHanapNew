
import express from 'express';
import User from '../models/User.js'; // Assuming User model is defined
import Property from '../models/Property.js'; // Assuming Property model is defined
import { getUserBarangayStats } from '../controllers/adminController.js';

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

export default router;
