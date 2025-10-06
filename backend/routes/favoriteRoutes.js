import express from 'express';
import { addFavorite, removeFavorite, getFavorites } from '../controllers/favoriteController.js';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router();

// Add to favorites
router.post('/add', protect, addFavorite);
// Remove from favorites
router.post('/remove', protect, removeFavorite);
// Get all favorites for user
router.get('/', protect, getFavorites);

export default router;
