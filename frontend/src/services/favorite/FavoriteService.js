import axios from 'axios';
import { buildApi } from '../apiConfig';

const API_URL = buildApi('/favorites');

const FavoriteService = {
  addToFavorites: async (propertyId, token) => {
    return axios.post(
      `${API_URL}/add`,
      { propertyId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  },
  removeFromFavorites: async (propertyId, token) => {
    return axios.post(
      `${API_URL}/remove`,
      { propertyId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  },
  getFavorites: async (token) => {
    return axios.get(`${API_URL}/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
};

export default FavoriteService;
