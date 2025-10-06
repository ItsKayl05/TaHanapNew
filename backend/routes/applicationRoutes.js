import express from 'express';
import { createApplication, getApplicationsByTenant, getApplicationsByProperty, approveApplication, rejectApplication } from '../controllers/applicationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Basic ping to avoid 404 when frontend probes /api/applications
router.get('/', (req, res) => res.json({ message: 'Applications root' }));

// Tenant creates application
router.post('/', protect, createApplication);

// Tenant: list own applications
router.get('/me', protect, getApplicationsByTenant);

// Landlord: list apps for a property
router.get('/property/:propertyId', protect, getApplicationsByProperty);

// Landlord approve/reject
router.post('/:id/approve', protect, approveApplication);
router.post('/:id/reject', protect, rejectApplication);

export default router;
