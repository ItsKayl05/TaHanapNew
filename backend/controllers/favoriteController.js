// Helper: Format image paths for frontend (copied from propertyController.js)
const formatImagePaths = (images) =>
  images.map(img => img.startsWith("http") ? img : `http://localhost:4000${img}`);
import Favorite from '../models/Favorite.js';

// Add property to favorites
export const addFavorite = async (req, res) => {
  try {
    const { propertyId } = req.body;
    const userId = req.user._id;
    const favorite = await Favorite.create({ user: userId, property: propertyId });
    res.status(201).json({ success: true, favorite });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Property already in favorites.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// Remove property from favorites
export const removeFavorite = async (req, res) => {
  try {
    const { propertyId } = req.body;
    const userId = req.user._id;
    await Favorite.findOneAndDelete({ user: userId, property: propertyId });
    res.status(200).json({ success: true, message: 'Removed from favorites.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all favorites for a user
export const getFavorites = async (req, res) => {
  try {
    const userId = req.user._id;
    const favorites = await Favorite.find({ user: userId }).populate({
      path: 'property',
      select: 'title images price category barangay',
    });
    // Format image paths for each favorite property
    const formattedFavorites = favorites.map(fav => {
      if (fav.property && fav.property.images) {
        fav.property.images = formatImagePaths(fav.property.images);
      }
      return fav;
    });
    res.status(200).json({ success: true, favorites: formattedFavorites });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
