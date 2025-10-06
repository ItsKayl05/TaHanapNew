import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export const getProperties = async () => {
  try {
  const response = await axios.get(`${API_URL}/properties`);
    return response.data;
  } catch (error) {
    console.error("Error fetching properties:", error);
    throw error;
  }
};

export const addProperty = async (propertyData) => {
  try {
    const response = await axios.post(`${API_URL}/properties`, propertyData);
    return response.data;
  } catch (error) {
    console.error("Error adding property:", error);
    throw error;
  }
};
