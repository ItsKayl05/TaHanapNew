import express from 'express';
import { sendMessage, getMessages, getMessageThreads, deleteMessage, editMessage } from '../controllers/messageController.js';
import { protect, memoryUploadInstance } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all message threads for sidebar
router.get('/threads', protect, getMessageThreads);

// Send a message (accept file attachments in-memory for Cloudinary)
// use field name 'attachments' for multiple files
router.post('/', protect, memoryUploadInstance.array('attachments', 6), sendMessage);

// Get chat history with a user
router.get('/:userId', protect, getMessages);

// Edit a message (sender only) - allow adding attachments
router.put('/:id', protect, memoryUploadInstance.array('attachments', 6), editMessage);

// Delete a message
router.delete('/:id', protect, deleteMessage);

export default router;
