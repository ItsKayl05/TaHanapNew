import express from 'express';
import { sendMessage, getMessages, getMessageThreads } from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all message threads for sidebar
router.get('/threads', protect, getMessageThreads);

// Send a message
router.post('/', protect, sendMessage);

// Get chat history with a user
router.get('/:userId', protect, getMessages);

export default router;
