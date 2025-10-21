import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Sidebar from "../../Sidebar/Sidebar";
import PhotoDomeViewer from '../../../../components/PhotoDomeViewer';
import { buildApi, buildUpload } from '../../../../services/apiConfig';
import { saveFiles, loadFiles, clearFormPersistence } from '../../../../utils/formPersistence';

import '../../landlord-theme.css';
import '../MyProperties.css';
import './EditProperty.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
});

const PROPERTY_TYPES = ['House','House and Lot','Apartment','Condominium','Townhouse','Dormitory','Bedspace','Studio Unit','Lot','Land','Commercial Space','Office Space','Warehouse','Building','Bungalow','Duplex','Triplex','Inner Lot','Corner Lot'];
const barangays = ['Assumption','Bagong Buhay I','Bagong Buhay II','Bagong Buhay III','Ciudad Real','Citrus','Dulong Bayan','Fatima I','Fatima II','Fatima III','Fatima IV','Fatima V','Poblacion','San Isidro','San Manuel'];
const LANDMARKS = [
  "park", "church", "public market", "major highway", "public transport stops",
  "banks and atms", "restaurant/food centers", "convenience store/supermarket",
  "school/university", "hospital/health care"
];

const MAX_IMAGES = 8;
const MAX_PANORAMAS = 5;

// Default map center for San Jose del Monte
const SJDM_CENTER = [14.8136, 121.0450];
const SJDM_ZOOM = 13;

// Map Components
function LocationSelector({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function MapCenterSync({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

function EditProperty() {
    const { propertyId } = useParams();
    const navigate = useNavigate();
    const FORM_KEY = `edit-property-${propertyId}-v1`;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [manualPin, setManualPin] = useState(false);
    const [originalLatLng, setOriginalLatLng] = useState({ lat: '', lng: '' });
    const [mapCenter, setMapCenter] = useState(SJDM_CENTER);
    const [mapZoom, setMapZoom] = useState(SJDM_ZOOM);
    const [priceFocused, setPriceFocused] = useState(false);
    const [priceError, setPriceError] = useState('');
    const [expandedPanorama, setExpandedPanorama] = useState(null);

    const [formData, setFormData] = useState({
        listingType: '',
        propertyType: '',
        address: '',
        barangay: '',
        price: '',
        latitude: '',
        longitude: '',
        billsIncluded: [],
        propertyCondition: '',
        marketHighlights: [],
        petFriendly: false,
        allowedPets: [],
        occupancy: '',
        parking: false,
        rules: '',
        landmarks: [],
        numberOfRooms: '',
        areaSqm: '',
        floorArea: '',
        lotArea: '',
        numberOfFloors: '',
        availabilityStatus: 'Available'
    });

    const [images, setImages] = useState([]);
    const [newImages, setNewImages] = useState([]);
    const [deletedImages, setDeletedImages] = useState([]);

    const [panoramaImages, setPanoramaImages] = useState([]);
    const [newPanoramaImages, setNewPanoramaImages] = useState([]);
    const [deletedPanoramaImages, setDeletedPanoramaImages] = useState([]);
    const [panoramaPreviews, setPanoramaPreviews] = useState([]);

    const [videoFile, setVideoFile] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);
    const [removeVideo, setRemoveVideo] = useState(false);

    const geocodeTimeoutRef = useRef(null);

    // Derived states
    const isForRent = formData.listingType === 'For Rent';
    const isForSale = formData.listingType === 'For Sale';
    const maxPanoramaImages = MAX_PANORAMAS;

    const isFieldDisabled = (fieldName) => {
        if (fieldName === 'billsIncluded' || fieldName === 'occupancy' || fieldName === 'petFriendly' || fieldName === 'allowedPets' || fieldName === 'rules') {
            return isForSale;
        }
        if (fieldName === 'propertyCondition' || fieldName === 'marketHighlights') {
            return isForRent;
        }
        return false;
    };

    // Geocoding function (use public Nominatim to avoid hitting backend /geocode endpoint)
    const geocodeAddress = async (address, barangay) => {
        if (!address || !barangay) return null;
        setIsGeocoding(true);
        const query = `${address}, ${barangay}, San Jose del Monte, Bulacan, Philippines`;

        try {
            // Use OpenStreetMap Nominatim directly. It returns an array of matches.
            const nominatim = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(nominatim, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    // Nominatim requires a valid User-Agent; include a basic one.
                    'User-Agent': 'TaHanap/1.0 (contact: dev@tahanap.local)'
                },
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                console.error('Nominatim error', res.status, txt);
                return null;
            }

            const data = await res.json().catch(() => null);
            if (data && Array.isArray(data) && data.length > 0) {
                const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                setMapCenter([coords.lat, coords.lng]);
                setMapZoom(16);
                return coords;
            }
            return null;
        } catch (err) {
            console.error('Geocode error:', err);
            return null;
        } finally {
            setIsGeocoding(false);
        }
    };

    // Load property data
    useEffect(() => {
        let mounted = true;
        async function load() {
            if (!propertyId) return setLoading(false);
            try {
                const token = localStorage.getItem('user_token');
                const res = await fetch(buildApi(`/properties/${propertyId}`), { 
                    headers: { Authorization: `Bearer ${token}` } 
                });
                if (!res.ok) {
                    const body = await res.text().catch(() => '');
                    console.error(`GET /properties/${propertyId} failed:`, res.status, body);
                    throw new Error(`Failed to load property: ${res.status}`);
                }
                const data = await res.json();
                
                if (!mounted) return;

                // Set form data with all fields from AddProperties
                setFormData({
                    listingType: data.listingType || '',
                    propertyType: data.propertyType || '',
                    address: data.address || '',
                    barangay: data.barangay || '',
                    price: data.price ? String(data.price) : '',
                    latitude: data.latitude !== undefined && data.latitude !== null ? String(data.latitude) : '',
                    longitude: data.longitude !== undefined && data.longitude !== null ? String(data.longitude) : '',
                    billsIncluded: Array.isArray(data.billsIncluded) ? data.billsIncluded : [],
                    propertyCondition: data.propertyCondition || '',
                    marketHighlights: Array.isArray(data.marketHighlights) ? data.marketHighlights : [],
                    petFriendly: data.petFriendly || false,
                    allowedPets: Array.isArray(data.allowedPets) ? data.allowedPets : [],
                    occupancy: data.occupancy ? String(data.occupancy) : '',
                    parking: data.parking || false,
                    rules: data.rules || '',
                    landmarks: Array.isArray(data.landmarks) ? data.landmarks : (data.landmarks ? data.landmarks.split(',').map(l => l.trim()) : []),
                    numberOfRooms: data.numberOfRooms ? String(data.numberOfRooms) : '',
                    areaSqm: data.areaSqm ? String(data.areaSqm) : '',
                    floorArea: data.floorArea ? String(data.floorArea) : '',
                    lotArea: data.lotArea ? String(data.lotArea) : '',
                    numberOfFloors: data.numberOfFloors ? String(data.numberOfFloors) : '',
                    availabilityStatus: data.availabilityStatus || 'Available'
                });

                setImages(data.images || []);
                
                // Handle panorama images
                const panoramaUrls = (data.panorama360Images && Array.isArray(data.panorama360Images)) 
                    ? data.panorama360Images.map(u => u.startsWith('http') ? u : buildUpload(u)) 
                    : [];
                setPanoramaImages(panoramaUrls);

                // Handle video
                if (data.video) {
                    setVideoPreview(data.video.startsWith('http') ? data.video : buildUpload(data.video));
                }

                // Set original coordinates
                if (data.latitude && data.longitude) {
                    setOriginalLatLng({
                        lat: String(data.latitude),
                        lng: String(data.longitude)
                    });
                    setMapCenter([parseFloat(data.latitude), parseFloat(data.longitude)]);
                    setMapZoom(16);
                }

                // Load draft files
                try {
                    const draftImages = await loadFiles(FORM_KEY, 'images');
                    if (draftImages && draftImages.length) {
                        setNewImages(prev => [...prev, ...draftImages.filter(i => i.blob).map(i => i.blob)]);
                    }
                } catch (e) {
                    console.log('No draft images found');
                }

            } catch (err) {
                console.error(err);
                toast.error('Could not load property');
            } finally { 
                if (mounted) setLoading(false); 
            }
        }
        load();
        return () => { mounted = false; };
    }, [propertyId]);

    // Handle address/barangay changes for geocoding
    useEffect(() => {
        if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
        
        if (formData.address && formData.barangay && !manualPin) {
            geocodeTimeoutRef.current = setTimeout(async () => {
                const coords = await geocodeAddress(formData.address, formData.barangay);
                if (coords) {
                    setFormData(prev => ({ 
                        ...prev, 
                        latitude: coords.lat.toString(), 
                        longitude: coords.lng.toString() 
                    }));
                }
            }, 700);
        }

        return () => {
            if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
        };
    }, [formData.address, formData.barangay, manualPin]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        if (type === 'checkbox' && name !== 'petFriendly' && name !== 'parking') {
            // Handle array checkboxes
            setFormData(prev => {
                const currentArray = Array.isArray(prev[name]) ? prev[name] : [];
                if (checked) {
                    return { ...prev, [name]: [...currentArray, value] };
                } else {
                    return { ...prev, [name]: currentArray.filter(item => item !== value) };
                }
            });
        } else if (type === 'checkbox') {
            // Handle boolean checkboxes
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            // Handle other inputs
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const count = images.length + newImages.length;
        const avail = MAX_IMAGES - count;
        const accepted = files.slice(0, avail).filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024);
        
        if (accepted.length < files.length) {
            toast.error('Some files were skipped (max 10MB each)');
        }
        
        setNewImages(prev => [...prev, ...accepted]);
        saveFiles(FORM_KEY, 'images', [...newImages, ...accepted]).catch(() => {});
    };

    const handlePanoramaChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        
        const total = panoramaImages.length + newPanoramaImages.length;
        if (total + files.length > MAX_PANORAMAS) { 
            toast.error(`Maximum ${MAX_PANORAMAS} panoramas allowed`); 
            return; 
        }
        
        const validFiles = files.filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024);
        setNewPanoramaImages(prev => [...prev, ...validFiles]);
        setPanoramaPreviews(prev => [...prev, ...validFiles.map(f => URL.createObjectURL(f))]);
    };

    const handleVideoChange = (e) => {
        const file = e.target.files?.[0]; 
        if (!file) return;
        
        const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Only MP4, WebM, or OGG videos allowed');
            return;
        }
        
        if (file.size > 50 * 1024 * 1024) {
            toast.error('Video file too large (max 50MB)');
            return;
        }
        
        setVideoFile(file);
        setVideoPreview(URL.createObjectURL(file));
        setRemoveVideo(false);
        saveFiles(FORM_KEY, 'video', [file]).catch(() => {});
    };

    // Image removal functions
    const handleDeleteImage = (index, isExisting) => {
        if (isExisting) {
            const url = images[index];
            setDeletedImages(prev => [...prev, url]);
            setImages(prev => prev.filter((_, i) => i !== index));
        } else {
            setNewImages(prev => prev.filter((_, i) => i !== index));
        }
    };

    // Panorama removal functions
    const handleRemovePanorama = (index) => {
        const url = panoramaImages[index];
        setDeletedPanoramaImages(prev => [...prev, url]);
        setPanoramaImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleRemoveNewPanorama = (index) => {
        if (panoramaPreviews[index]) {
            URL.revokeObjectURL(panoramaPreviews[index]);
        }
        setNewPanoramaImages(prev => prev.filter((_, i) => i !== index));
        setPanoramaPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleExpandPanorama = (url) => {
        setExpandedPanorama(url);
    };

    const parseLocaleNumber = (str) => {
        if (!str) return NaN;
        const cleaned = String(str).replace(/,/g, '').replace(/[^0-9.\-]/g, '');
        return Number(cleaned);
    };

    const handleLocationSelect = (lat, lng) => {
        setFormData(prev => ({
            ...prev,
            latitude: lat.toString(),
            longitude: lng.toString()
        }));
        setManualPin(true);
        toast.info('Location set! You can also drag the pin to adjust.');
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); 
        if (submitting) return;
        
        try {
            const token = localStorage.getItem('user_token'); 
            if (!token) { 
                toast.error('Not authenticated'); 
                navigate('/login'); 
                return; 
            }

            // Validation
            const priceNum = parseLocaleNumber(formData.price);
            if (isNaN(priceNum) || priceNum <= 0) { 
                toast.error('Enter valid price'); 
                return; 
            }

            if (images.length + newImages.length === 0) { 
                toast.error('Add at least one image'); 
                return; 
            }

            // Validate required numeric fields like in AddProperties
            const floorAreaNum = parseLocaleNumber(formData.floorArea);
            if (isNaN(floorAreaNum) || floorAreaNum <= 0) {
                toast.error('Floor area must be a number greater than 0');
                return;
            }

            const lotAreaNum = parseLocaleNumber(formData.lotArea);
            if (isNaN(lotAreaNum) || lotAreaNum <= 0) {
                toast.error('Lot area must be a number greater than 0');
                return;
            }

            const floorsNum = formData.numberOfFloors ? Number(formData.numberOfFloors) : NaN;
            if (isNaN(floorsNum) || !Number.isInteger(floorsNum) || floorsNum < 1 || floorsNum > 5) {
                toast.error('Number of floors must be between 1 and 5');
                return;
            }

            if (formData.listingType === 'For Rent' && formData.occupancy) {
                const occupancyNum = Number(formData.occupancy);
                if (isNaN(occupancyNum) || occupancyNum <= 0 || occupancyNum > 5) {
                    toast.error('Maximum occupancy must be between 1 and 5');
                    return;
                }
            }

            // Client-side sanity: check total upload size to avoid truncated requests
            const totalSize = (
                (newImages || []).reduce((s, f) => s + (f.size || 0), 0) +
                (newPanoramaImages || []).reduce((s, f) => s + (f.size || 0), 0) +
                (videoFile && videoFile.size ? videoFile.size : 0)
            );

            // If total size exceeds 180MB, warn and abort (server allows large but Cloudinary uploads may be heavy)
            const MAX_TOTAL_UPLOAD = 180 * 1024 * 1024; // 180MB
            if (totalSize > MAX_TOTAL_UPLOAD) {
                toast.error('Total upload size exceeds allowed limit. Please reduce file sizes or upload fewer files.');
                return;
            }

            setSubmitting(true);

            const formDataToSend = new FormData();
            
            // Append all form fields
            const fields = [
                'listingType', 'propertyType', 'address', 'barangay', 'latitude', 'longitude',
                'propertyCondition', 'occupancy', 'rules', 'numberOfRooms', 'areaSqm', 
                'floorArea', 'lotArea', 'numberOfFloors', 'availabilityStatus'
            ];
            
            fields.forEach(field => {
                if (formData[field] !== undefined && formData[field] !== null && formData[field] !== '') {
                    formDataToSend.append(field, String(formData[field]));
                }
            });

            // Append price as number
            formDataToSend.append('price', String(priceNum));

            // Append array fields
            const arrayFields = ['billsIncluded', 'marketHighlights', 'allowedPets', 'landmarks'];
            arrayFields.forEach(field => {
                if (Array.isArray(formData[field]) && formData[field].length > 0) {
                    formDataToSend.append(field, formData[field].join(', '));
                }
            });

            // Append boolean fields
            formDataToSend.append('petFriendly', String(formData.petFriendly));
            formDataToSend.append('parking', String(formData.parking));

            // Handle images
            newImages.forEach(f => formDataToSend.append('images', f));
            deletedImages.forEach(url => {
                const name = (url || '').split('/').pop();
                if (name) formDataToSend.append('deletedImages', name);
            });

            // Handle video
            if (videoFile) {
                formDataToSend.append('video', videoFile);
            }
            if (removeVideo) {
                formDataToSend.append('removeVideo', 'true');
            }

            // Handle panorama images
            newPanoramaImages.forEach(f => formDataToSend.append('panorama360Images', f));
            deletedPanoramaImages.forEach(url => {
                const name = (url || '').split('/').pop();
                if (name) formDataToSend.append('deletedPanoramaImages', name);
            });

            // Use axios for controlled timeout during large uploads
            // IMPORTANT: do NOT set 'Content-Type' manually — the browser will add the correct boundary
            const axios = (await import('axios')).default;
            const url = buildApi(`/properties/${propertyId}`);
            const response = await axios.put(url, formDataToSend, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 120000, // 2 minutes
                // Allow axios to return non-2xx responses so we can parse and show server errors
                validateStatus: () => true,
                onUploadProgress: (progressEvent) => {
                    try {
                        if (progressEvent.lengthComputable) {
                            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            setUploadProgress(percent);
                        }
                    } catch (e) {
                        // ignore progress errors
                    }
                }
            });

            if (!(response.status >= 200 && response.status < 300)) {
                const respData = response.data;
                console.error('PUT /properties failed', response.status, respData);

                if (respData && typeof respData === 'object') {
                    if (Array.isArray(respData.errors)) respData.errors.forEach(err => toast.error(err));
                    else if (Array.isArray(respData.details)) respData.details.forEach(err => toast.error(err));
                    else if (respData.error) toast.error(respData.error);
                    else if (respData.message) toast.error(respData.message);
                    else toast.error('Failed to update property');
                } else if (typeof respData === 'string' && respData.length) {
                    try {
                        const parsed = JSON.parse(respData);
                        if (parsed?.errors) parsed.errors.forEach(err => toast.error(err));
                        else if (parsed?.message) toast.error(parsed.message);
                        else toast.error(parsed);
                    } catch {
                        toast.error(respData);
                    }
                } else {
                    toast.error('Failed to update property');
                }

                setSubmitting(false);
                return;
            }

            const data = response.data || {};
            toast.success('Property updated successfully');
            setUploadProgress(0);
            try { 
                await clearFormPersistence(FORM_KEY); 
            } catch(e) {
                console.error('Failed to clear draft after update', e);
            }
            navigate('/my-properties');
            
        } catch (err) {
            console.error('Update property error:', err);
            toast.error(err.message || 'Error updating property');
        } finally { 
            setSubmitting(false); 
        }
    };

    // Cleanup object URLs
    useEffect(() => {
        return () => {
            panoramaPreviews.forEach(url => URL.revokeObjectURL(url));
            if (videoPreview?.startsWith('blob:')) URL.revokeObjectURL(videoPreview);
            newImages.forEach(file => URL.revokeObjectURL(URL.createObjectURL(file)));
        };
    }, [panoramaPreviews, videoPreview, newImages]);

    return (
        <div className="dashboard-container landlord-dashboard">
            <Sidebar activeItem="my-properties" />
            <div className="landlord-main edit-property-main">
                {loading ? (
                    <div className="ll-card skeleton-card">
                        <div className="skeleton line w-50" />
                        <div className="skeleton line w-80" />
                        <div className="skeleton line w-40" />
                        <div className="skeleton line w-70" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="ll-card edit-property-form" noValidate>
                        {/* Map Section */}
                        <div className="map-preview-section ll-card">
                            <div className="map-header">
                                <h3>Property Location</h3>
                                {isGeocoding && (
                                    <div className="geocoding-indicator">
                                        <div className="loading-spinner"></div>
                                        Finding location...
                                    </div>
                                )}
                            </div>
                            <div className="map-instructions">
                                <strong>📍 How to update your property's location:</strong>
                                <ol>
                                    <li>Update address or barangay for automatic pin placement</li>
                                    <li>Fine-tune the location by either:
                                        <ul>
                                            <li>Clicking anywhere on the map to move the pin</li>
                                            <li>Dragging the red pin marker to the exact location</li>
                                        </ul>
                                    </li>
                                    <li>Zoom in/out using the +/- buttons or mouse wheel for better accuracy</li>
                                    <li>Click "Reset Pin" to restore the original location</li>
                                </ol>
                            </div>
                            <div className="map-container">
                                <MapContainer
                                    center={formData.latitude && formData.longitude ? [parseFloat(formData.latitude), parseFloat(formData.longitude)] : mapCenter}
                                    zoom={mapZoom}
                                    scrollWheelZoom={true}
                                    style={{ height: "420px", width: "100%", borderRadius: 12, overflow: 'hidden' }}
                                >
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap contributors' />
                                    <LocationSelector onLocationSelect={handleLocationSelect} />
                                    <MapCenterSync center={mapCenter} zoom={mapZoom} />
                                    {formData.latitude && formData.longitude && (
                                        <Marker
                                            position={[parseFloat(formData.latitude), parseFloat(formData.longitude)]}
                                            draggable={true}
                                            eventHandlers={{
                                                dragstart: () => {
                                                    toast.info('Dragging pin to adjust location...', {autoClose: 2000});
                                                },
                                                dragend: (e) => {
                                                    const latlng = e.target.getLatLng();
                                                    setFormData(prev => ({ 
                                                        ...prev, 
                                                        latitude: latlng.lat.toString(), 
                                                        longitude: latlng.lng.toString() 
                                                    }));
                                                    setManualPin(true);
                                                    toast.success('Location updated! ✨', {autoClose: 2000});
                                                }
                                            }}
                                        >
                                            <Popup>
                                                <div className="popup-content">
                                                    <div className="popup-title">{formData.propertyType || 'Property'}</div>
                                                    <div className="popup-address">{formData.address}</div>
                                                    {formData.price && <div className="popup-price">₱{formData.price}</div>}
                                                    <div className="popup-note">
                                                        {manualPin ? '✏️ Manually placed' : '🎯 Auto-located'}<br/>
                                                        Drag pin or click map to adjust
                                                    </div>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    )}
                                </MapContainer>
                            </div>
                            <div className="coordinates-controls">
                                <input 
                                    className="ll-field" 
                                    type="text" 
                                    name="latitude" 
                                    value={formData.latitude} 
                                    onChange={handleChange} 
                                    placeholder="Latitude" 
                                />
                                <input 
                                    className="ll-field" 
                                    type="text" 
                                    name="longitude" 
                                    value={formData.longitude} 
                                    onChange={handleChange} 
                                    placeholder="Longitude" 
                                />
                                <button 
                                    type="button" 
                                    className="ll-btn tiny" 
                                    onClick={() => {
                                        setFormData(prev => ({
                                            ...prev,
                                            latitude: originalLatLng.lat,
                                            longitude: originalLatLng.lng
                                        }));
                                        setManualPin(false);
                                        toast.info("Pin reset to original property location.");
                                    }}
                                >
                                    Reset Pin
                                </button>
                                {manualPin && <span className="manual-pin-indicator">Manual pin active</span>}
                            </div>
                        </div>

                        <div className="form-header">
                            <h2 className="form-title">Edit Property</h2>
                            <p className="form-subtitle">Update your listing details and images. Changes go live immediately after saving.</p>
                        </div>

                        <div className="form-grid">
                            {/* Listing Type */}
                            <div className="field-group">
                                <label className="required">Listing Type</label>
                                <select 
                                    className="ll-field" 
                                    name="listingType" 
                                    value={formData.listingType}
                                    onChange={handleChange} 
                                    required
                                >
                                    <option value="">Select Listing Type</option>
                                    <option value="For Rent">For Rent</option>
                                    <option value="For Sale">For Sale</option>
                                </select>
                                {formData.listingType && (
                                    <div className="field-hint success">
                                        ✓ Currently set to: {formData.listingType}
                                    </div>
                                )}
                            </div>

                            {/* Property Type */}
                            <div className="field-group">
                                <label className="required">Property Type</label>
                                <select 
                                    className="ll-field" 
                                    name="propertyType" 
                                    value={formData.propertyType} 
                                    onChange={handleChange} 
                                    required
                                >
                                    <option value="">Select Property Type</option>
                                    {PROPERTY_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                                </select>
                            </div>

                            {/* Bills Included */}
                            <div className={`field-group full ${isForSale ? 'field-disabled' : ''}`}>
                                <label>Bills Included</label>
                                <div className="checkbox-group">
                                    {['Water','Electricity'].map(b => (
                                        <label key={b} className="checkbox-label">
                                            <input 
                                                type="checkbox" 
                                                name="billsIncluded" 
                                                value={b} 
                                                checked={Array.isArray(formData.billsIncluded) ? formData.billsIncluded.includes(b) : false} 
                                                onChange={handleChange}
                                                disabled={isFieldDisabled('billsIncluded')} 
                                            />
                                            {b}
                                        </label>
                                    ))}
                                </div>
                                <div className="field-hint">
                                    {isForSale ? 'Not applicable for sale listings' : 'Check bills that are included in the rent (optional)'}
                                </div>
                            </div>

                            {/* Property Condition */}
                            <div className={`field-group ${isForRent ? 'field-disabled' : ''}`}>
                                <label className={isForSale ? 'required' : ''}>Property Condition</label>
                                <select 
                                    className="ll-field" 
                                    name="propertyCondition" 
                                    value={formData.propertyCondition} 
                                    onChange={handleChange} 
                                    required={isForSale}
                                    disabled={isFieldDisabled('propertyCondition')}
                                >
                                    <option value="">Select Property Condition</option>
                                    <option value="Fully Furnished">Fully Furnished</option>
                                    <option value="Semi-Furnished">Semi-Furnished</option>
                                    <option value="Unfurnished">Unfurnished</option>
                                    <option value="Brand New">Brand New</option>
                                    <option value="Pre-owned / Resale">Pre-owned / Resale</option>
                                </select>
                                {isForRent && <div className="field-hint">Not applicable for rent listings</div>}
                            </div>

                            {/* Market Highlights */}
                            <div className={`field-group full ${isForRent ? 'field-disabled' : ''}`}>
                                <label>Market Highlights</label>
                                <div className="checkbox-column">
                                    {['Ready for Occupancy (RFO)','Pre-selling (under construction)','Negotiable Price','Clean Title','Inclusive of Taxes and Fees','Good Investment Opportunity','Rush Sale / Below Market Value'].map(mh => (
                                        <label key={mh} className="checkbox-label">
                                            <input 
                                                type="checkbox" 
                                                name="marketHighlights" 
                                                value={mh} 
                                                checked={Array.isArray(formData.marketHighlights) ? formData.marketHighlights.includes(mh) : false} 
                                                onChange={handleChange}
                                                disabled={isFieldDisabled('marketHighlights')}
                                            />
                                            {mh}
                                        </label>
                                    ))}
                                </div>
                                <div className="field-hint">
                                    {isForRent ? 'Not applicable for rent listings' : 'Optional - check any market highlights that apply.'}
                                </div>
                            </div>

                            {/* Address */}
                            <div className="field-group">
                                <label className="required">Address</label>
                                <input 
                                    className="ll-field" 
                                    name="address" 
                                    value={formData.address} 
                                    onChange={handleChange} 
                                    required 
                                    placeholder="E.g., Heroesville 1, Blk 15, Lot 8" 
                                />
                                <div className="field-hint">Tip: Include commas to separate street, block, lot for better geocoding.</div>
                            </div>

                            {/* Barangay */}
                            <div className="field-group">
                                <label className="required">Barangay</label>
                                <select 
                                    className="ll-field" 
                                    name="barangay" 
                                    value={formData.barangay} 
                                    onChange={handleChange} 
                                    required
                                >
                                    <option value="">Select barangay</option>
                                    {barangays.map(brgy => <option key={brgy} value={brgy}>{brgy}</option>)}
                                </select>
                            </div>
                            
                            {/* Price */}
                            <div className="field-group">
                                <label className="required">Price (₱)</label>
                                <input
                                    className="ll-field"
                                    type="text"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleChange}
                                    onFocus={() => { setPriceFocused(true); setPriceError(''); }}
                                    onBlur={() => {
                                        setPriceFocused(false);
                                        const num = parseLocaleNumber(formData.price);
                                        if (isNaN(num) || num <= 0) {
                                            setPriceError('Please enter a valid price greater than 0');
                                        } else {
                                            try {
                                                const formatted = new Intl.NumberFormat(navigator.language, { 
                                                    minimumFractionDigits: 0, 
                                                    maximumFractionDigits: 2 
                                                }).format(num);
                                                setFormData(prev => ({ ...prev, price: String(formatted) }));
                                                setPriceError('');
                                            } catch (e) {
                                                setPriceError('');
                                            }
                                        }
                                    }}
                                    required
                                    placeholder="E.g., 1500.00"
                                />
                                {priceError && <div className="field-error">{priceError}</div>}
                            </div>

                            {/* Number of Rooms */}
                            <div className="field-group">
                                <label>Number of Rooms</label>
                                <select 
                                    className="ll-field" 
                                    name="numberOfRooms" 
                                    value={formData.numberOfRooms} 
                                    onChange={handleChange}
                                >
                                    <option value="">Select number</option>
                                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>

                            {/* Availability */}
                            <div className="field-group">
                                <label className="required">Availability</label>
                                <select 
                                    className="ll-field" 
                                    name="availabilityStatus" 
                                    value={formData.availabilityStatus} 
                                    onChange={handleChange} 
                                    required
                                >
                                    <option value="Available">Available</option>
                                    <option value="Not Available">Not Available</option>
                                </select>
                                <div className="field-hint">Choose the current availability for this listing.</div>
                            </div>

                            {/* Property Size */}
                            <div className="field-group">
                                <label className="required">Property Size (sqm)</label>
                                <input 
                                    className="ll-field" 
                                    type="number" 
                                    min={0.1} 
                                    step={0.1} 
                                    name="areaSqm" 
                                    value={formData.areaSqm} 
                                    onChange={handleChange} 
                                    placeholder="e.g. 45" 
                                    required 
                                />
                            </div>

                            {/* Floor Area */}
                            <div className="field-group">
                                <label className="required">Floor Area (sqm)</label>
                                <input 
                                    className="ll-field" 
                                    type="text" 
                                    name="floorArea" 
                                    value={formData.floorArea} 
                                    onChange={handleChange} 
                                    placeholder="e.g. 45 or 45.5" 
                                    required 
                                />
                                <div className="field-hint">Total usable floor area in sqm (numbers only; decimals allowed). Required.</div>
                            </div>

                            {/* Lot Area */}
                            <div className="field-group">
                                <label className="required">Lot Area (sqm)</label>
                                <input 
                                    className="ll-field" 
                                    type="text" 
                                    name="lotArea" 
                                    value={formData.lotArea} 
                                    onChange={handleChange} 
                                    placeholder="e.g. 100" 
                                    required 
                                />
                                <div className="field-hint">Lot size in sqm. Required.</div>
                            </div>

                            {/* Number of Floors */}
                            <div className="field-group">
                                <label className="required">Number of Floors</label>
                                <select 
                                    className="ll-field" 
                                    name="numberOfFloors" 
                                    value={formData.numberOfFloors} 
                                    onChange={handleChange} 
                                    required
                                >
                                    <option value="">Select number</option>
                                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <div className="field-hint">Number of floors (1–5). Required.</div>
                            </div>

                            {/* Max Occupancy */}
                            <div className={`field-group ${isForSale ? 'field-disabled' : ''}`}>
                                <label className={isForRent ? 'required' : ''}>Max Occupancy</label>
                                <select 
                                    className="ll-field" 
                                    name="occupancy" 
                                    value={formData.occupancy} 
                                    onChange={handleChange} 
                                    required={isForRent}
                                    disabled={isFieldDisabled('occupancy')}
                                >
                                    <option value="">Select number</option>
                                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                {isForSale && <div className="field-hint">Disabled for For Sale listings</div>}
                            </div>

                            {/* Pet Friendly */}
                            <div className={`field-group toggle-field ${isForSale ? 'field-disabled' : ''}`}>
                                <label className="checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        name="petFriendly" 
                                        checked={formData.petFriendly} 
                                        onChange={handleChange} 
                                        disabled={isFieldDisabled('petFriendly')} 
                                    /> 
                                    Pet Friendly
                                </label>
                                {formData.petFriendly && !isForSale && (
                                    <div className="pet-types">
                                        {['Cat','Dog','Bird','Fish'].map(p => (
                                            <label key={p} className="checkbox-label">
                                                <input 
                                                    type="checkbox" 
                                                    name="allowedPets" 
                                                    value={p} 
                                                    checked={Array.isArray(formData.allowedPets) ? formData.allowedPets.includes(p) : false} 
                                                    onChange={handleChange}
                                                />
                                                {p}
                                            </label>
                                        ))}
                                    </div>
                                )}
                                {isForSale && <div className="field-hint">Pets not applicable for sale listings</div>}
                            </div>

                            {/* Parking */}
                            <div className="field-group toggle-field">
                                <label className="checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        name="parking" 
                                        checked={formData.parking} 
                                        onChange={handleChange} 
                                    /> 
                                    Parking Available
                                </label>
                            </div>

                            {/* Landmarks */}
                            <div className="field-group full">
                                <label>Nearby Landmarks</label>
                                <div className="landmarks-grid">
                                    {LANDMARKS.map(l => (
                                        <label key={l} className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                name="landmarks"
                                                value={l}
                                                checked={Array.isArray(formData.landmarks) ? formData.landmarks.includes(l) : false}
                                                onChange={handleChange}
                                            />
                                            {l.split(' ').map(word => 
                                                word.includes('/') 
                                                    ? word.split('/').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('/')
                                                    : word.charAt(0).toUpperCase() + word.slice(1)
                                            ).join(' ')}
                                        </label>
                                    ))}
                                </div>
                                <div className="field-hint">Check all that apply.</div>
                            </div>

                            {/* House Rules */}
                            <div className={`field-group full ${isForSale ? 'field-disabled' : ''}`}>
                                <label>House Rules</label>
                                <textarea 
                                    className="ll-field" 
                                    name="rules" 
                                    value={formData.rules} 
                                    onChange={handleChange} 
                                    placeholder="No loud noises after 10 PM, No smoking inside" 
                                    rows={3} 
                                    disabled={isFieldDisabled('rules')} 
                                />
                                {isForSale && <div className="field-hint">Not used for sale listings</div>}
                            </div>
                        </div>

                        {/* Panorama Section */}
                        <div className="panorama-section">
                            <div className="section-header">
                                <h3 className="section-title">
                                    360° Panoramic Views
                                    <span className="count-badge">
                                        {panoramaImages.length + newPanoramaImages.length}/{maxPanoramaImages}
                                    </span>
                                </h3>
                                <p className="field-hint">
                                    Add up to {maxPanoramaImages} panoramic photos to showcase different areas of your property. 
                                    Each photo should be a 360° view of a room or space for an immersive viewing experience.
                                </p>
                            </div>
                            
                            <div className="panorama-grid">
                                {/* Existing Panoramas */}
                                {panoramaImages.map((url, index) => (
                                    <div key={`existing-${index}`} className="panorama-card">
                                        <div className="panorama-preview">
                                            <div className="panorama-preview-overlay">
                                                <button 
                                                    type="button"
                                                    className="panorama-control-btn expand"
                                                    title="View Fullscreen"
                                                    onClick={() => handleExpandPanorama(url)}
                                                >
                                                    <i className="fas fa-expand"></i>
                                                </button>
                                            </div>
                                            <PhotoDomeViewer 
                                                imageUrl={url} 
                                                mode="MONOSCOPIC"
                                            />
                                        </div>
                                        <div className="panorama-actions">
                                            <div className="panorama-info">
                                                <i className="fas fa-vr-cardboard"></i>
                                                Room View {index + 1}
                                            </div>
                                            <button 
                                                type="button"
                                                className="panorama-remove-btn"
                                                title="Remove Image"
                                                onClick={() => handleRemovePanorama(index)}
                                            >
                                                <i className="fas fa-times"></i> Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* New Panorama Previews */}
                                {panoramaPreviews.map((preview, index) => (
                                    <div key={`new-${index}`} className="panorama-card">
                                        <div className="panorama-preview">
                                            <div className="panorama-preview-overlay">
                                                <button 
                                                    type="button"
                                                    className="panorama-control-btn expand"
                                                    title="View Fullscreen"
                                                    onClick={() => handleExpandPanorama(preview)}
                                                >
                                                    <i className="fas fa-expand"></i>
                                                </button>
                                            </div>
                                            <PhotoDomeViewer 
                                                imageUrl={preview} 
                                                mode="MONOSCOPIC"
                                            />
                                        </div>
                                        <div className="panorama-actions">
                                            <div className="panorama-info">
                                                <i className="fas fa-vr-cardboard"></i>
                                                New Room View
                                            </div>
                                            <button 
                                                type="button"
                                                className="panorama-remove-btn"
                                                title="Remove Image"
                                                onClick={() => handleRemoveNewPanorama(index)}
                                            >
                                                <i className="fas fa-times"></i> Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Upload Section */}
                            <div className={`panorama-upload ${panoramaImages.length + newPanoramaImages.length >= maxPanoramaImages ? 'disabled' : ''}`}>
                                <label htmlFor="panorama-input">
                                    <input
                                        id="panorama-input"
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handlePanoramaChange}
                                        disabled={panoramaImages.length + newPanoramaImages.length >= maxPanoramaImages}
                                    />
                                    <div className="panorama-upload-text">
                                        {panoramaImages.length + newPanoramaImages.length >= maxPanoramaImages
                                            ? "Maximum number of panoramic images reached"
                                            : "Click or drag 360° panoramic images here to upload"}
                                    </div>
                                    <div className="panorama-count">
                                        <span className="count-current">{panoramaImages.length + newPanoramaImages.length}</span>
                                        <span className="count-separator">/</span>
                                        <span className="count-max">{maxPanoramaImages} images</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Images Section */}
                        <div className="images-section">
                            <h3 className="section-title">
                                Images <span className="required-star">*</span> 
                                <span className="image-count">
                                    ({images.length + newImages.length}/8 total)
                                </span>
                            </h3>
                            <p className="field-hint">
                                You can keep, remove, or add new images (max 8 total, JPG/PNG/WebP up to 10MB each).
                            </p>
                            <div className="current-images-grid">
                                {images.map((img, i) => {
                                    const url = img.startsWith('http') ? img : buildUpload(img);
                                    return (
                                        <div key={i} className="image-chip">
                                            <img src={url} alt={`Property ${i}`} />
                                            <button 
                                                type="button" 
                                                aria-label="Remove image" 
                                                onClick={() => handleDeleteImage(i, true)}
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    );
                                })}
                                {images.length === 0 && <div className="placeholder">No existing images</div>}
                            </div>
                            <div className="new-upload-block">
                                <label className="file-drop-modern">
                                    <input 
                                        type="file" 
                                        multiple 
                                        accept="image/*" 
                                        onChange={handleImageChange} 
                                    />
                                    <span>Add Images</span>
                                </label>
                                {newImages.length > 0 && (
                                    <div className="new-images-grid">
                                        {newImages.map((file, i) => (
                                            <div key={i} className="image-chip pending">
                                                <img src={URL.createObjectURL(file)} alt={`New ${i}`} />
                                                <button 
                                                    type="button" 
                                                    aria-label="Remove pending image" 
                                                    onClick={() => handleDeleteImage(i, false)}
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Video Section */}
                        <div className="video-section">
                            <h3 className="section-title">
                                Property Video 
                                <span className="video-status">
                                    ({removeVideo ? 'will remove' : (videoFile ? 'new video selected' : (videoPreview ? 'existing' : 'none'))})
                                </span>
                            </h3>
                            <p className="field-hint">
                                Optional walkthrough clip (MP4/WebM/OGG, up to 50MB). Uploading a new one replaces the existing video.
                            </p>
                            {!videoPreview && !videoFile && !removeVideo && (
                                <label className="file-drop-modern">
                                    <input 
                                        type="file" 
                                        accept="video/mp4,video/webm,video/ogg" 
                                        onChange={handleVideoChange} 
                                    />
                                    <span>Select Video</span>
                                </label>
                            )}
                            {(videoPreview || videoFile) && !removeVideo && (
                                <div className="video-preview-wrapper">
                                    <video src={videoPreview} controls preload="none" className="video-preview" />
                                    <button 
                                        type="button" 
                                        className="ll-btn tiny danger" 
                                        onClick={() => {
                                            if (videoFile && videoPreview?.startsWith('blob:')) {
                                                URL.revokeObjectURL(videoPreview);
                                            }
                                            setVideoFile(null); 
                                            setVideoPreview(null); 
                                            setRemoveVideo(true);
                                        }}
                                    >
                                        Remove Video
                                    </button>
                                </div>
                            )}
                            {removeVideo && (
                                <div className="removed-note">
                                    Video will be removed. 
                                    <button 
                                        type="button" 
                                        className="link-btn" 
                                        onClick={() => setRemoveVideo(false)}
                                    >
                                        Undo
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Form Actions */}
                        <div className="form-actions">
                            <button 
                                type="button" 
                                className="ll-btn outline" 
                                onClick={() => navigate(-1)}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="ll-btn primary" 
                                disabled={submitting}
                            >
                                {submitting ? (uploadProgress > 0 ? `Uploading ${uploadProgress}%` : 'Saving...') : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Fullscreen Panorama Viewer */}
                {expandedPanorama && (
                    <div className="fullscreen-panorama">
                        <button 
                            type="button"
                            className="close-fullscreen"
                            onClick={() => setExpandedPanorama(null)}
                        >
                            <i className="fas fa-times"></i>
                        </button>
                        <PhotoDomeViewer 
                            imageUrl={expandedPanorama}
                            mode="MONOSCOPIC"
                            containerStyle={{ width: '100vw', height: '100vh' }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default EditProperty;