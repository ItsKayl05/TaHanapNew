import axios from 'axios';
import { buildApi } from '../apiConfig';

export const getProperties = async () => {
  try {
    const response = await axios.get(buildApi('/properties'));
    return response.data;
  } catch (error) {
    console.error("Error fetching properties:", error);
    throw error;
  }
};

export const addProperty = async (propertyData) => {
  try {
    const response = await axios.post(buildApi('/properties'), propertyData);
    return response.data;
  } catch (error) {
    console.error("Error adding property:", error);
    throw error;
  }
};
