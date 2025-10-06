// Utility to get user token from localStorage (or other storage)
export const getToken = () => {
  return localStorage.getItem('user_token');
};
