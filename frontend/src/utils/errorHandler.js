// errorHandler.js
import { toast } from 'react-toastify';

export const handleApiError = (error) => {
    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const message = error.response.data?.message || error.response.data?.msg || 'An error occurred';
        
        switch (error.response.status) {
            case 400:
                toast.error(`Invalid request: ${message}`);
                break;
            case 401:
                toast.error('Session expired. Please log in again');
                localStorage.removeItem('user_token');
                localStorage.removeItem('user_role');
                window.location.href = '/login';
                break;
            case 403:
                toast.error(`Access denied: ${message}`);
                break;
            case 404:
                toast.error(`Not found: ${message}`);
                break;
            case 413:
                toast.error('File too large. Please reduce the file size and try again');
                break;
            case 429:
                toast.error('Too many requests. Please wait a moment and try again');
                break;
            case 500:
                toast.error('Server error. Please try again later');
                break;
            default:
                toast.error(message);
        }
    } else if (error.request) {
        // The request was made but no response was received
        toast.error('No response from server. Please check your internet connection');
    } else {
        // Something happened in setting up the request that triggered an Error
        toast.error('Failed to send request. Please try again');
    }
    return null;
};

// Format validation errors
export const handleValidationError = (error) => {
    if (error.name === 'ValidationError' && error.errors) {
        Object.values(error.errors).forEach(err => {
            toast.error(err.message);
        });
    }
};

// Handle file validation
export const handleFileValidation = (file, options = {}) => {
    const {
        maxSize = 10 * 1024 * 1024, // 10MB default
        allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
        customMessage = ''
    } = options;

    if (!file) return 'No file selected';
    if (file.size > maxSize) {
        return `File size exceeds ${(maxSize / (1024 * 1024)).toFixed(1)}MB limit`;
    }
    if (!allowedTypes.includes(file.type)) {
        return `Invalid file type. Allowed: ${allowedTypes.map(t => t.split('/')[1]).join(', ')}`;
    }
    return null;
};