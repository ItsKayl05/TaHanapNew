import express from 'express';
import { createPanoCheckout, paymongoWebhook, verifyPaymentSession, simulateWebhook } from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create checkout link (no auth required so new properties or dev calls can create a checkout)
router.post('/create-checkout', createPanoCheckout);

// Verify payment by session id (client can use to poll)
router.post('/verify-session', verifyPaymentSession);
// Dev-only: simulate a PayMongo webhook for local testing
if (process.env.NODE_ENV !== 'production') {
	router.post('/simulate-webhook', simulateWebhook);
}

// Webhook endpoint (no auth)
router.post('/webhook', express.json(), paymongoWebhook);

export default router;
