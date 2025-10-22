import express from 'express';
import { createPanoCheckout, paymongoWebhook } from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create checkout link (no auth required so new properties or dev calls can create a checkout)
router.post('/create-checkout', createPanoCheckout);

// Webhook endpoint (no auth)
router.post('/webhook', express.json(), paymongoWebhook);

export default router;
