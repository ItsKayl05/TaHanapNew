import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { buildApi, buildUpload } from '../../../../services/apiConfig';
import formPersistence, { saveFormState, loadFormState, clearFormPersistence } from '../../../../utils/formPersistence';

// Import all necessary components
// Component imports replaced by inline placeholders below

// Minimal placeholder components (real implementations may live elsewhere).
const ImageUpload = ({ existingImages = [], newImages = [], deletedImages = [], onImageChange = () => {}, onImageDelete = () => {} }) => {
  return (
    <div className="image-upload-placeholder">
      <p className="text-sm text-gray-500">Image upload component</p>
    </div>
  );
};

const VideoUpload = ({ existingVideo = '', newVideo = null, removeVideo = false, onVideoChange = () => {}, onVideoRemove = () => {} }) => {
  return (
    <div className="video-upload-placeholder">
      <p className="text-sm text-gray-500">Video upload component</p>
    </div>
  );
};

const PanoramaUpload = ({ existingPanoramas = [], newPanoramas = [], deletedPanoramas = [], onPanoramaChange = () => {}, onPanoramaDelete = () => {} }) => {
  return (
    <div className="panorama-upload-placeholder">
      <p className="text-sm text-gray-500">Panorama upload component</p>
    </div>
  );
};

const LocationSearch = ({ onLocationSelect = () => {} }) => {
  return (
    <div className="location-search-placeholder">
      <input type="text" className="border p-2 w-full" placeholder="Search location..." onBlur={(e) => onLocationSelect({ lat: 0, lng: 0, address: e.target.value })} />
    </div>
  );
};

const ArrayInput = ({ values = [], onChange = () => {}, placeholder = '' }) => {
  return (
    <div className="array-input-placeholder">
      <input type="text" placeholder={placeholder} className="border p-2 w-full" onBlur={(e) => onChange([...values, e.target.value])} />
    </div>
  );
};

const CheckboxGroup = ({ options = [], selected = [], onChange = () => {} }) => {
  return (
    <div className="checkbox-group-placeholder">
      {options.map((opt) => (
        <label key={opt} className="inline-flex items-center mr-4">
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => {
            if (selected.includes(opt)) onChange(selected.filter(s => s !== opt)); else onChange([...selected, opt]);
          }} />
          <span className="ml-2">{opt}</span>
        </label>
      ))}
    </div>
  );
};

const FORM_KEY = 'edit-property-form';

// Image compression utility
const compressImage = (file, maxWidth = 1200, quality = 0.7) => {
  return new Promise((resolve) => {
    // If file is small enough, return as is
    if (file.size <= 2 * 1024 * 1024) { // 2MB
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Calculate new dimensions
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

const EditProperty = () => {
  const { id: propertyId } = useParams();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state - COMPLETE with all fields
  const [formData, setFormData] = useState({
    // Basic Information
    propertyType: '',
    title: '',
    address: '',
    price: '',
    barangay: '',
    listingType: '',
    
    // Features
    petFriendly: false,
    allowedPets: [],
    occupancy: 1,
    parking: false,
    rules: '',
    landmarks: [],
    
    // Property Details
    numberOfRooms: 1,
    numberOfBathrooms: 1,
    areaSqm: '',
    floorArea: '',
    lotArea: '',
    numberOfFloors: 1,
    
    // Location
    latitude: null,
    longitude: null,
    city: 'San Jose del Monte',
    province: 'Bulacan',
    
    // Condition & Status
    propertyCondition: '',
    availabilityStatus: 'Available',
    
    // Additional Features
    billsIncluded: [],
    marketHighlights: [],
    amenities: [],
    
    // Media
    images: [],
    video: '',
    panorama360Images: [],
    
    // Additional Details
    description: '',
    nearbySchools: [],
    nearbyHospitals: [],
    transportation: [],
    securityFeatures: []
  });

  // File states
  const [newImages, setNewImages] = useState([]);
  const [deletedImages, setDeletedImages] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [newPanoramaImages, setNewPanoramaImages] = useState([]);
  const [deletedPanoramaImages, setDeletedPanoramaImages] = useState([]);

  // Additional state for complex components
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [selectedBills, setSelectedBills] = useState([]);
  const [marketHighlights, setMarketHighlights] = useState([]);

  // Basic form persistence using existing utils (project doesn't include a useFormPersistence hook)
  useEffect(() => {
    // Try to load persisted state on mount
    const persisted = loadFormState(FORM_KEY);
    if (persisted && persisted.fields) {
      try {
        setFormData((prev) => ({ ...prev, ...persisted.fields }));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    // Save simple form fields on change (debounce omitted for brevity)
    try {
      saveFormState(FORM_KEY, { fields: formData });
    } catch (e) {}
  }, [formData]);

  const clearFormPersistenceWrapper = async () => {
    try {
      await clearFormPersistence(FORM_KEY);
    } catch (e) {}
  };

  // Available options for dropdowns and checkboxes
  const propertyTypes = [
    'Apartment', 'House', 'Condo', 'Townhouse', 
    'Warehouse', 'Commercial', 'Land', 'Studio'
  ];

  const billsOptions = [
    'Water', 'Electricity', 'Internet', 'Cable TV', 
    'Association Dues', 'Property Tax', 'Maintenance'
  ];

  const amenitiesOptions = [
    'Swimming Pool', 'Gym', 'Garden', 'Balcony',
    'Air Conditioning', 'Heating', 'Furnished',
    'Security', 'Elevator', 'Parking', 'Laundry'
  ];

  const marketHighlightsOptions = [
    'Near School', 'Near Hospital', 'Near Mall',
    'Near Transportation', 'Quiet Area', 'Safe Neighborhood',
    'New Development', 'Green Area', 'City View'
  ];

  // Load property data - COMPLETE with all fields
  useEffect(() => {
    const loadProperty = async () => {
      try {
        const userToken = localStorage.getItem("user_token");
        if (!userToken) {
          throw new Error("Unauthorized access. Please log in.");
        }

        const response = await fetch(buildApi(`/properties/${propertyId}`), {
          headers: {
            'Authorization': `Bearer ${userToken}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to load property data');
        }

        const propertyData = await response.json();
        console.log('🔍 Debug - API Data:', propertyData);

        // Set form data from API - ALL FIELDS
        setFormData(prev => ({
          ...prev,
          // Basic Information
          propertyType: propertyData.propertyType || '',
          title: propertyData.title || propertyData.propertyType || '',
          address: propertyData.address || '',
          price: propertyData.price?.toString() || '',
          barangay: propertyData.barangay || '',
          listingType: propertyData.listingType || '',
          
          // Features
          petFriendly: propertyData.petFriendly || false,
          allowedPets: propertyData.allowedPets || [],
          occupancy: propertyData.occupancy || 1,
          parking: propertyData.parking || false,
          rules: propertyData.rules || '',
          landmarks: propertyData.landmarks || [],
          
          // Property Details
          numberOfRooms: propertyData.numberOfRooms || 1,
          numberOfBathrooms: propertyData.numberOfBathrooms || 1,
          areaSqm: propertyData.areaSqm?.toString() || '',
          floorArea: propertyData.floorArea?.toString() || '',
          lotArea: propertyData.lotArea?.toString() || '',
          numberOfFloors: propertyData.numberOfFloors || 1,
          
          // Location
          latitude: propertyData.latitude || null,
          longitude: propertyData.longitude || null,
          city: propertyData.city || 'San Jose del Monte',
          province: propertyData.province || 'Bulacan',
          
          // Condition & Status
          propertyCondition: propertyData.propertyCondition || '',
          availabilityStatus: propertyData.availabilityStatus || 'Available',
          
          // Additional Features
          billsIncluded: propertyData.billsIncluded || [],
          marketHighlights: propertyData.marketHighlights || [],
          amenities: propertyData.amenities || [],
          
          // Media
          images: propertyData.images || [],
          video: propertyData.video || '',
          panorama360Images: propertyData.panorama360Images || [],
          
          // Additional Details
          description: propertyData.description || '',
          nearbySchools: propertyData.nearbySchools || [],
          nearbyHospitals: propertyData.nearbyHospitals || [],
          transportation: propertyData.transportation || [],
          securityFeatures: propertyData.securityFeatures || []
        }));

        // Set component states
        setSelectedAmenities(propertyData.amenities || []);
        setSelectedBills(propertyData.billsIncluded || []);
        setMarketHighlights(propertyData.marketHighlights || []);

      } catch (err) {
        console.error('Error loading property:', err);
        toast.error('Failed to load property data');
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProperty();
  }, [propertyId]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle array field changes
  const handleArrayChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle complex field changes
  const handleComplexChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle location selection
  const handleLocationSelect = (location) => {
    setFormData(prev => ({
      ...prev,
      address: location.address,
      latitude: location.lat,
      longitude: location.lng,
      barangay: location.barangay || '',
      city: location.city || 'San Jose del Monte',
      province: location.province || 'Bulacan'
    }));
  };

  // Handle image changes
  const handleImageChange = async (files) => {
    try {
      // Compress images before setting state
      const compressedFiles = await Promise.all(
        files.map(file => compressImage(file))
      );
      setNewImages(compressedFiles);
    } catch (error) {
      console.error('Error compressing images:', error);
      toast.error('Failed to process images');
    }
  };

  const handleImageDelete = (imageUrl) => {
    setDeletedImages(prev => [...prev, imageUrl]);
  };

  // Handle video changes
  const handleVideoChange = (file) => {
    setVideoFile(file);
    setRemoveVideo(false);
  };

  const handleVideoRemove = () => {
    setRemoveVideo(true);
    setVideoFile(null);
  };

  // Handle panorama changes
  const handlePanoramaChange = async (files) => {
    try {
      // Compress panorama images
      const compressedFiles = await Promise.all(
        files.map(file => compressImage(file))
      );
      setNewPanoramaImages(compressedFiles);
    } catch (error) {
      console.error('Error compressing panorama images:', error);
      toast.error('Failed to process panorama images');
    }
  };

  const handlePanoramaDelete = (imageUrl) => {
    setDeletedPanoramaImages(prev => [...prev, imageUrl]);
  };

  // Handle amenities selection
  const handleAmenitiesChange = (amenities) => {
    setSelectedAmenities(amenities);
    setFormData(prev => ({
      ...prev,
      amenities: amenities
    }));
  };

  // Handle bills included selection
  const handleBillsChange = (bills) => {
    setSelectedBills(bills);
    setFormData(prev => ({
      ...prev,
      billsIncluded: bills
    }));
  };

  // Handle market highlights selection
  const handleMarketHighlightsChange = (highlights) => {
    setMarketHighlights(highlights);
    setFormData(prev => ({
      ...prev,
      marketHighlights: highlights
    }));
  };

  // Handle allowed pets changes
  const handleAllowedPetsChange = (pets) => {
    setFormData(prev => ({
      ...prev,
      allowedPets: pets
    }));
  };

  // Handle landmarks changes
  const handleLandmarksChange = (landmarks) => {
    setFormData(prev => ({
      ...prev,
      landmarks: landmarks
    }));
  };

  // Handle description change
  const handleDescriptionChange = (e) => {
    setFormData(prev => ({
      ...prev,
      description: e.target.value
    }));
  };

  // Handle nearby schools change
  const handleNearbySchoolsChange = (schools) => {
    setFormData(prev => ({
      ...prev,
      nearbySchools: schools
    }));
  };

  // Handle nearby hospitals change
  const handleNearbyHospitalsChange = (hospitals) => {
    setFormData(prev => ({
      ...prev,
      nearbyHospitals: hospitals
    }));
  };

  // Handle transportation change
  const handleTransportationChange = (transport) => {
    setFormData(prev => ({
      ...prev,
      transportation: transport
    }));
  };

  // Handle security features change
  const handleSecurityFeaturesChange = (features) => {
    setFormData(prev => ({
      ...prev,
      securityFeatures: features
    }));
  };

  // Validation function
  const validateForm = () => {
    const errors = [];

    if (!formData.listingType) {
      errors.push('Please select a listing type');
    }

    if (!formData.propertyType) {
      errors.push('Please select a property type');
    }

    if (!formData.address) {
      errors.push('Property address is required');
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      errors.push('Please enter a valid price');
    }

    if (!formData.barangay) {
      errors.push('Please select a barangay');
    }

    if (!formData.areaSqm || parseFloat(formData.areaSqm) <= 0) {
      errors.push('Please enter a valid area in square meters');
    }

    if (!formData.floorArea || parseFloat(formData.floorArea) <= 0) {
      errors.push('Please enter a valid floor area');
    }

    if (!formData.lotArea || parseFloat(formData.lotArea) <= 0) {
      errors.push('Please enter a valid lot area');
    }

    if (formData.listingType === 'For Rent' && (!formData.occupancy || formData.occupancy < 1)) {
      errors.push('Please specify maximum occupancy');
    }

    if (formData.listingType === 'For Sale' && !formData.propertyCondition) {
      errors.push('Please select property condition');
    }

    return errors;
  };

  // Main submit handler - COMPLETE with all fields
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const userToken = localStorage.getItem("user_token");
      if (!userToken) {
        throw new Error("Unauthorized access. Please log in.");
      }

      // Validate form
      const validationErrors = validateForm();
      if (validationErrors.length > 0) {
        validationErrors.forEach(error => toast.error(error));
        return;
      }

      // Parse numeric values
      const parseNumeric = (val) => val ? parseFloat(String(val).replace(/,/g, '')) : NaN;
      const priceNum = parseNumeric(formData.price);
      const areaSqmNum = parseNumeric(formData.areaSqm);
      const floorAreaNum = parseNumeric(formData.floorArea);
      const lotAreaNum = parseNumeric(formData.lotArea);

      // --- FormData Construction - ALL FIELDS ---
      const formDataToSend = new FormData();

      console.log('🔍 Form data being sent:', formData);

      // Append all basic fields
      const basicFields = [
        'propertyType', 'title', 'address', 'barangay', 'listingType', 
        'rules', 'propertyCondition', 'availabilityStatus', 'city', 'province',
        'description'
      ];

      basicFields.forEach(field => {
        if (formData[field] !== undefined && formData[field] !== null && formData[field] !== '') {
          formDataToSend.append(field, formData[field].toString());
        }
      });

      // Append numeric fields
      const numericFields = [
        'price', 'occupancy', 'numberOfRooms', 'numberOfBathrooms', 
        'areaSqm', 'floorArea', 'lotArea', 'numberOfFloors'
      ];
      
      numericFields.forEach(field => {
        let value;
        switch(field) {
          case 'price': value = priceNum; break;
          case 'areaSqm': value = areaSqmNum; break;
          case 'floorArea': value = floorAreaNum; break;
          case 'lotArea': value = lotAreaNum; break;
          default: value = parseNumeric(formData[field]);
        }
        
        if (!isNaN(value) && value !== null) {
          formDataToSend.append(field, value.toString());
        }
      });

      // Append boolean fields
      formDataToSend.append('petFriendly', formData.petFriendly.toString());
      formDataToSend.append('parking', formData.parking.toString());

      // Append array fields as JSON
      const arrayFields = [
        'billsIncluded', 'marketHighlights', 'landmarks', 'allowedPets',
        'amenities', 'nearbySchools', 'nearbyHospitals', 'transportation',
        'securityFeatures'
      ];
      
      arrayFields.forEach(field => {
        if (formData[field] && formData[field].length > 0) {
          formDataToSend.append(field, JSON.stringify(formData[field]));
        }
      });

      // Append coordinates
      if (formData.latitude) {
        formDataToSend.append('latitude', formData.latitude.toString());
      }
      if (formData.longitude) {
        formDataToSend.append('longitude', formData.longitude.toString());
      }

      // --- File Handling ---

      // Append new image files
      if (newImages.length > 0) {
        console.log(`📸 Appending ${newImages.length} new images`);
        newImages.forEach(file => {
          formDataToSend.append('images', file);
        });
      }

      // Append deleted images
      if (deletedImages.length > 0) {
        console.log(`🗑️ Appending ${deletedImages.length} deleted images`);
        formDataToSend.append('deletedImages', JSON.stringify(deletedImages));
      }

      // Handle video
      if (videoFile) {
        console.log(`🎥 Appending new video`);
        formDataToSend.append('video', videoFile);
      }
      
      if (removeVideo) {
        console.log('❌ Removing existing video');
        formDataToSend.append('removeVideo', 'true');
      }

      // Append new panorama images
      if (newPanoramaImages.length > 0) {
        console.log(`🔄 Appending ${newPanoramaImages.length} new panorama images`);
        newPanoramaImages.forEach(file => {
          formDataToSend.append('panorama360Images', file);
        });
      }

      // Append deleted panoramas
      if (deletedPanoramaImages.length > 0) {
        console.log(`🗑️ Appending ${deletedPanoramaImages.length} deleted panoramas`);
        formDataToSend.append('deletedPanoramaImages', JSON.stringify(deletedPanoramaImages));
      }

      // Log request info for debugging
      let totalSize = 0;
      let fileCount = 0;
      for (let [key, value] of formDataToSend.entries()) {
        if (value instanceof File) {
          totalSize += value.size;
          fileCount++;
          console.log(`📁 ${key}: ${value.name} (${(value.size / 1024 / 1024).toFixed(2)}MB)`);
        } else if (key.includes('deleted')) {
          console.log(`🗑️ ${key}: ${value}`);
        } else if (key === 'images' || key === 'panorama360Images') {
          // Skip logging array contents
        } else {
          console.log(`📝 ${key}: ${value}`);
        }
      }
      console.log(`📊 Total upload: ${fileCount} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

      // --- API Call with Enhanced Error Handling ---
      console.log('🚀 Sending PUT request...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      try {
        const response = await fetch(buildApi(`/properties/${propertyId}`), {
          method: 'PUT',
          headers: { 
            Authorization: `Bearer ${userToken}`,
          },
          body: formDataToSend,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log('📨 Response status:', response.status);

        const responseData = await response.json();
        console.log('📨 Response data:', responseData);

        if (!response.ok) {
          // Handle backend validation errors
          if (responseData.details && Array.isArray(responseData.details)) {
            const errorMessage = responseData.details.join(', ');
            throw new Error(errorMessage);
          }
          const errorMessage = responseData.error || responseData.message || `Server error: ${response.status}`;
          throw new Error(errorMessage);
        }

        console.log('✅ Property updated successfully!');
        toast.success('Property updated successfully!');
        
        // Clear form persistence and navigate
        await clearFormPersistence(FORM_KEY);
        navigate('/my-properties');

      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout. Please try again with smaller files or better connection.');
        }
        throw fetchError;
      }

    } catch (err) {
      console.error('❌ Update property error:', err);
      
      // Enhanced error handling
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        toast.error('Network error. Please check your connection and try again.');
      } else if (err.message.includes('timeout')) {
        toast.error('Request timeout. Try uploading fewer or smaller files.');
      } else if (err.message.includes('too large')) {
        toast.error(err.message);
      } else if (err.message.includes('Unexpected end of form') || err.message.includes('truncated')) {
        toast.error('Upload failed. File might be too large. Try compressing images or using smaller files.');
      } else {
        toast.error(err.message || 'Failed to update property. Please try again.');
      }
      
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-4 text-gray-600">Loading property data...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Edit Property</h1>
        <p className="text-gray-600 mt-2">Update your property listing information</p>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          <strong>Error:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Listing Type *
              </label>
              <select
                name="listingType"
                value={formData.listingType}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Listing Type</option>
                <option value="For Rent">For Rent</option>
                <option value="For Sale">For Sale</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Property Type *
              </label>
              <select
                name="propertyType"
                value={formData.propertyType}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Property Type</option>
                {propertyTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Property Title
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Spacious 2-Bedroom Apartment"
              />
            </div>
          </div>
        </div>

        {/* Location Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Location</h2>
          
          <div className="space-y-4">
            <LocationSearch onLocationSelect={handleLocationSelect} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address *
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Barangay *
                </label>
                <input
                  type="text"
                  name="barangay"
                  value={formData.barangay}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Province
                </label>
                <input
                  type="text"
                  name="province"
                  value={formData.province}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Price & Details Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Price & Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price *
              </label>
              <input
                type="text"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Area (sqm) *
              </label>
              <input
                type="text"
                name="areaSqm"
                value={formData.areaSqm}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Floor Area *
              </label>
              <input
                type="text"
                name="floorArea"
                value={formData.floorArea}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lot Area *
              </label>
              <input
                type="text"
                name="lotArea"
                value={formData.lotArea}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Floors *
              </label>
              <select
                name="numberOfFloors"
                value={formData.numberOfFloors}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {[1,2,3,4,5].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Rooms *
              </label>
              <select
                name="numberOfRooms"
                value={formData.numberOfRooms}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {[1,2,3,4,5].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Bathrooms
              </label>
              <select
                name="numberOfBathrooms"
                value={formData.numberOfBathrooms}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[1,2,3,4,5].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            {formData.listingType === 'For Rent' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Occupancy *
                </label>
                <select
                  name="occupancy"
                  value={formData.occupancy}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {[1,2,3,4,5].map(num => (
                    <option key={num} value={num}>{num} {num === 1 ? 'person' : 'people'}</option>
                  ))}
                </select>
              </div>
            )}

            {formData.listingType === 'For Sale' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Condition *
                </label>
                <select
                  name="propertyCondition"
                  value={formData.propertyCondition}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Condition</option>
                  <option value="Brand New">Brand New</option>
                  <option value="Like New">Like New</option>
                  <option value="Good">Good</option>
                  <option value="Needs Renovation">Needs Renovation</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Availability Status
              </label>
              <select
                name="availabilityStatus"
                value={formData.availabilityStatus}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Available">Available</option>
                <option value="Not Available">Not Available</option>
              </select>
            </div>
          </div>

          {/* Additional Fields */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="petFriendly"
                checked={formData.petFriendly}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Pet Friendly
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="parking"
                checked={formData.parking}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Parking Available
              </label>
            </div>
          </div>

          {/* Description */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Property Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleDescriptionChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe your property in detail..."
            />
          </div>

          {/* House Rules */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              House Rules
            </label>
            <textarea
              name="rules"
              value={formData.rules}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Any specific rules for tenants or buyers..."
            />
          </div>
        </div>

        {/* Features & Amenities Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Features & Amenities</h2>
          
          <div className="space-y-6">
            {/* Amenities */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Amenities
              </label>
              <CheckboxGroup
                options={amenitiesOptions}
                selectedValues={selectedAmenities}
                onChange={handleAmenitiesChange}
                columns={3}
              />
            </div>

            {/* Bills Included */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Bills Included
              </label>
              <CheckboxGroup
                options={billsOptions}
                selectedValues={selectedBills}
                onChange={handleBillsChange}
                columns={2}
              />
            </div>

            {/* Market Highlights */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Market Highlights
              </label>
              <CheckboxGroup
                options={marketHighlightsOptions}
                selectedValues={marketHighlights}
                onChange={handleMarketHighlightsChange}
                columns={3}
              />
            </div>

            {/* Allowed Pets */}
            {formData.petFriendly && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allowed Pets
                </label>
                <ArrayInput
                  values={formData.allowedPets}
                  onChange={handleAllowedPetsChange}
                  placeholder="Add allowed pet types..."
                />
              </div>
            )}

            {/* Landmarks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nearby Landmarks
              </label>
              <ArrayInput
                values={formData.landmarks}
                onChange={handleLandmarksChange}
                placeholder="Add nearby landmarks..."
              />
            </div>

            {/* Nearby Schools */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nearby Schools
              </label>
              <ArrayInput
                values={formData.nearbySchools}
                onChange={handleNearbySchoolsChange}
                placeholder="Add nearby schools..."
              />
            </div>

            {/* Nearby Hospitals */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nearby Hospitals
              </label>
              <ArrayInput
                values={formData.nearbyHospitals}
                onChange={handleNearbyHospitalsChange}
                placeholder="Add nearby hospitals..."
              />
            </div>

            {/* Transportation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transportation Options
              </label>
              <ArrayInput
                values={formData.transportation}
                onChange={handleTransportationChange}
                placeholder="Add transportation options..."
              />
            </div>

            {/* Security Features */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Security Features
              </label>
              <ArrayInput
                values={formData.securityFeatures}
                onChange={handleSecurityFeaturesChange}
                placeholder="Add security features..."
              />
            </div>
          </div>
        </div>

        {/* Media Upload Sections */}
        <ImageUpload
          existingImages={formData.images || []}
          newImages={newImages}
          deletedImages={deletedImages}
          onImageChange={handleImageChange}
          onImageDelete={handleImageDelete}
        />

        <VideoUpload
          existingVideo={formData.video}
          newVideo={videoFile}
          removeVideo={removeVideo}
          onVideoChange={handleVideoChange}
          onVideoRemove={handleVideoRemove}
        />

        <PanoramaUpload
          existingPanoramas={formData.panorama360Images || []}
          newPanoramas={newPanoramaImages}
          deletedPanoramas={deletedPanoramaImages}
          onPanoramaChange={handlePanoramaChange}
          onPanoramaDelete={handlePanoramaDelete}
        />
  {/* Submit Button */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={() => navigate('/my-properties')}
            className="px-8 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating Property...
              </span>
            ) : (
              'Update Property'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProperty;