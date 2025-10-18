import React, { useState, useEffect } from "react";
import PhotoDomeViewer from '../../../../components/PhotoDomeViewer';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import '../../landlord-theme.css';
import '../MyProperties.css';
import "./EditProperty.css";
import Sidebar from "../../Sidebar/Sidebar";
import { buildApi, buildUpload } from '../../../../services/apiConfig';
import { saveFormState, loadFormState, saveFiles, loadFiles, clearFormPersistence } from '../../../../utils/formPersistence';

// categories deprecated; use property type dropdown instead
const barangays = [
    "Assumption", "Bagong Buhay I", "Bagong Buhay II", "Bagong Buhay III",
    "Ciudad Real", "Citrus", "Dulong Bayan", "Fatima I", "Fatima II", 
    "Fatima III", "Fatima IV", "Fatima V", "Francisco Homes – Guijo", 
    "Francisco Homes – Mulawin", "Francisco Homes – Narra", "Francisco Homes – Yakal",
    "Gaya-gaya", "Graceville", "Gumaok Central", "Gumaok East", "Gumaok West",
    "Kaybanban", "Kaypian", "Lawang Pare", "Maharlika", "Minuyan I", 
    "Minuyan II", "Minuyan III", "Minuyan IV", "Minuyan V", "Minuyan Proper",
    "Muzon East", "Muzon Proper", "Muzon South", "Muzon West", "Paradise III", 
    "Poblacion", "Poblacion 1", "San Isidro", "San Manuel", "San Martin De Porres", 
    "San Martin I", "San Martin II", "San Martin III", "San Martin IV", "San Pedro", 
    "San Rafael I", "San Rafael II", "San Rafael III", "San Rafael IV", "San Rafael V",
    "San Roque", "Sapang Palay Proper", "Sta. Cruz I", "Sta. Cruz II", "Sta. Cruz III", 
    "Sta. Cruz IV", "Sta. Cruz V", "Sto. Cristo", "Sto. Nino I", "Sto. Nino II", 
    "Tungkong Mangga"
];

const LANDMARKS = [
    "park", "church", "public market", "major highway", "public transport stops",
    "banks and atms", "restaurant/food centers", "convenience store/supermarket",
    "school/university", "hospital/health care"
];

const EditProperty = () => {
    const [originalLatLng, setOriginalLatLng] = useState({ lat: "", lng: "" });
    const { propertyId } = useParams();
    const navigate = useNavigate();
    const [property, setProperty] = useState(null);
    const [formData, setFormData] = useState({
        title: "", description: "", address: "", price: "", barangay: "", propertyType: "For Rent",
        petFriendly: false, allowedPets: "", occupancy: "", parking: false, rules: "",
        landmarks: "", availabilityStatus: "Available", numberOfRooms: "", areaSqm: "",
    latitude: "", longitude: ""
    });
    const FORM_KEY = `edit-property-${propertyId}-v1`;

    // Restore persisted state for edit form (only after initial load)
    useEffect(() => {
        const saved = loadFormState(FORM_KEY);
            if (saved) {
                const allowed = [
                    'title','description','address','price','barangay','propertyType','petFriendly','allowedPets','occupancy','parking','rules','landmarks','numberOfRooms','areaSqm','latitude','longitude','availabilityStatus'
                ];
                const toRestore = {};
                for (const k of allowed) {
                    if (saved.fields && Object.prototype.hasOwnProperty.call(saved.fields, k)) toRestore[k] = saved.fields[k];
                }
                setFormData(prev => ({ ...prev, ...toRestore }));
            }
        (async () => {
            try {
                const imgs = await loadFiles(FORM_KEY, 'images');
                if (imgs && imgs.length) {
                    // add blob previews to newImages
                    setNewImages(prev => [...prev, ...imgs.filter(i=>i.blob).map(i=>i.blob)]);
                }
                const vid = await loadFiles(FORM_KEY, 'video');
                if (vid && vid.length) {
                    setVideoFile(vid[0].blob || null);
                    setVideoPreview(vid[0].url);
                }
                const pan = await loadFiles(FORM_KEY, 'panorama');
                if (pan && pan.length) {
                    setPanorama(pan[0].blob || null);
                    setPanoramaPreview(pan[0].url);
                }
            } catch (e) { console.error('restore edit persistence', e); }
        })();
    }, [propertyId]);

    // Save form fields to localStorage
    useEffect(() => {
        const toSave = { fields: { ...formData } };
        const id = setTimeout(()=> saveFormState(FORM_KEY, toSave), 300);
        return () => clearTimeout(id);
    }, [formData]);

    // Save file changes
    useEffect(() => { if (newImages && newImages.length) saveFiles(FORM_KEY,'images', newImages.filter(f=> f instanceof File)).catch(()=>{}); }, [newImages]);
    useEffect(() => { if (videoFile && videoFile instanceof File) saveFiles(FORM_KEY,'video',[videoFile]).catch(()=>{}); }, [videoFile]);
    useEffect(() => { if (panorama && panorama instanceof File) saveFiles(FORM_KEY,'panorama',[panorama]).catch(()=>{}); }, [panorama]);
    const [manualPin, setManualPin] = useState(false);
    const [images, setImages] = useState([]);
    const [newImages, setNewImages] = useState([]);
    const [deletedImages, setDeletedImages] = useState([]);
    const [videoFile, setVideoFile] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);
    const [removeVideo, setRemoveVideo] = useState(false);
    const [panorama, setPanorama] = useState(null);
    const [panoramaPreview, setPanoramaPreview] = useState(null);
    const [existingPanorama, setExistingPanorama] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [priceFocused, setPriceFocused] = useState(false);
    const [priceError, setPriceError] = useState('');

    useEffect(() => {
        const fetchProperty = async () => {
            try {
                const userToken = localStorage.getItem("user_token");
                if (!userToken) throw new Error("Unauthorized access. Please log in.");

                const response = await fetch(buildApi(`/properties/${propertyId}`), {
                    headers: { Authorization: `Bearer ${userToken}` },
                });

                if (!response.ok) throw new Error("Failed to fetch property details.");

                const data = await response.json();
                setProperty(data);
                // Always convert landmarks to array for form
                let landmarksArr = [];
                if (Array.isArray(data.landmarks)) {
                  landmarksArr = data.landmarks;
                } else if (typeof data.landmarks === 'string' && data.landmarks.trim()) {
                  landmarksArr = data.landmarks.split(',').map(l => l.trim()).filter(l => l);
                }
                setFormData({
                    title: data.title,
                    description: data.description,
                    address: data.address,
                    price: data.price,
                    barangay: data.barangay,
                    // category removed
                    petFriendly: data.petFriendly,
                    allowedPets: data.allowedPets,
                    occupancy: data.occupancy,
                    availabilityStatus: data.availabilityStatus ?? 'Available',
                    // totalUnits removed from UI; availability is derived server-side from applications
                    parking: data.parking,
                    rules: data.rules,
                    landmarks: landmarksArr,
                    customLandmark: '',
                    numberOfRooms: data.numberOfRooms ?? "",
                    areaSqm: data.areaSqm ?? "",
                    latitude: data.latitude ?? "",
                    longitude: data.longitude ?? ""
                });
                setOriginalLatLng({
                    lat: data.latitude ?? "",
                    lng: data.longitude ?? ""
                });
                setImages(data.images || []);
                if (data.video) {
                    setVideoPreview(data.video.startsWith('http') ? data.video : buildUpload(data.video));
                }
                if (data.panorama360) {
                    setExistingPanorama(data.panorama360.startsWith('http') ? data.panorama360 : buildUpload(data.panorama360));
                }
                setLoading(false);
            } catch (error) {
                toast.error(error.message || "Error fetching property.");
                setLoading(false);
            }
        };
        fetchProperty();
    }, [propertyId]);

    useEffect(() => {
        return () => {
            if (videoFile && videoPreview?.startsWith('blob:')) URL.revokeObjectURL(videoPreview);
            if (panoramaPreview) URL.revokeObjectURL(panoramaPreview);
        };
    }, [videoFile, videoPreview, panoramaPreview]);

    const handlePanoramaChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const validType = file.type.startsWith('image/');
        const sizeOk = file.size <= 10 * 1024 * 1024;
        if (!validType) { toast.error('Panoramic image must be an image file.'); return; }
        if (!sizeOk) { toast.error('Panoramic file too large (max 10MB).'); return; }
        if (panoramaPreview) URL.revokeObjectURL(panoramaPreview);
        setPanorama(file);
        setPanoramaPreview(URL.createObjectURL(file));
        setExistingPanorama(null);
    };

    const removePanorama = () => {
        if (panoramaPreview) URL.revokeObjectURL(panoramaPreview);
        setPanorama(null);
        setPanoramaPreview(null);
        setExistingPanorama(null);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newValue = value;
        // Special handling for price: allow localized group/decimal while typing
        if (name === 'price') {
            const parts = new Intl.NumberFormat(navigator.language).formatToParts(12345.6);
            const group = parts.find(p => p.type === 'group')?.value || ',';
            const decimal = parts.find(p => p.type === 'decimal')?.value || '.';
            const esc = s => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
            const allowedRegex = new RegExp(`[^0-9${esc(group)}${esc(decimal)}]`, 'g');
            let sanitized = (value || '').replace(allowedRegex, '');
            const decCount = (sanitized.match(new RegExp(esc(decimal), 'g')) || []).length;
            if (decCount > 1) {
                const first = sanitized.indexOf(decimal);
                sanitized = sanitized.slice(0, first + 1) + sanitized.slice(first + 1).replace(new RegExp(esc(decimal), 'g'), '');
            }
            newValue = sanitized;
        }
        // Normalize landmark value to match filter (trim, exact string)
        if (name === 'landmarks') {
            const found = LANDMARKS.find(l => l === value);
            newValue = found || value;
        }
        setFormData({
            ...formData,
            [name]: type === "checkbox" ? checked : newValue,
        });
        if (name === "address") setManualPin(false);
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const MAX_FILES = 8;
        const currentCount = images.length + newImages.length;
        const availableSlots = MAX_FILES - currentCount;
        if (availableSlots <= 0) {
            toast.info(`Maximum of ${MAX_FILES} images reached.`);
            return;
        }
        const accepted = files.slice(0, availableSlots).filter(file => {
            const exists = newImages.some(f => f.name === file.name);
            const validType = file.type.startsWith('image/');
            const sizeOk = file.size <= 10 * 1024 * 1024;
            if (!validType) toast.warn(`${file.name} skipped (not an image).`);
            if (!sizeOk) toast.warn(`${file.name} skipped (image file too large, max 10MB).`);
            if (exists) toast.warn(`${file.name} already added.`);
            return !exists && validType && sizeOk;
        });
        if (!accepted.length) return;
        setNewImages(prev => [...prev, ...accepted]);
    };

    const handleDeleteImage = (index, isExisting) => {
        if (isExisting) {
            const imageToDelete = images[index];
            setDeletedImages((prev) => [...prev, imageToDelete]);
            setImages(images.filter((_, i) => i !== index));
        } else {
            setNewImages(newImages.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e) => {
  e.preventDefault();
  if (submitting) return;
  try {
    const userToken = localStorage.getItem("user_token");
    if (!userToken) throw new Error("Unauthorized access. Please log in.");
            if (!formData.title || !formData.description) {
                toast.error('Title & description are required.');
                return;
            }
    // Ensure required numeric fields are provided
    if (formData.price === undefined || formData.price === '' ) {
      toast.error("Don't forget to set a price");
      return;
    }
    if (formData.areaSqm === undefined || formData.areaSqm === '' || isNaN(Number(formData.areaSqm)) || Number(formData.areaSqm) <= 0) {
      toast.error('Please provide the floor area (in square meters)');
      return;
    }
    // ADD THIS VALIDATION FOR OCCUPANCY
    if (formData.occupancy === undefined || formData.occupancy === '') {
      toast.error('Please specify maximum occupancy');
      return;
    }
            // Validate and convert price (locale-aware)
            const parseLocaleNumber = (str) => {
                if (str === undefined || str === null || String(str).trim() === '') return NaN;
                const nfParts = new Intl.NumberFormat(navigator.language).formatToParts(12345.6);
                const group = nfParts.find(p => p.type === 'group')?.value || ',';
                const decimal = nfParts.find(p => p.type === 'decimal')?.value || '.';
                const esc = s => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
                let normalized = String(str).replace(new RegExp(esc(group), 'g'), '');
                if (decimal !== '.') normalized = normalized.replace(new RegExp(esc(decimal)), '.');
                normalized = normalized.replace(/\s/g, '');
                normalized = normalized.replace(/[^0-9.\-]/g, '');
                const num = Number(normalized);
                return isNaN(num) ? NaN : num;
            };
            const priceNum = parseLocaleNumber(formData.price);
            if (isNaN(priceNum) || priceNum < 0) {
                toast.error('Please enter a valid price');
                return;
            }

            setSubmitting(true);

            const formDataToSend = new FormData();
            // Combine landmarks array and customLandmark into a single string
            let landmarksArr = Array.isArray(formData.landmarks) ? [...formData.landmarks] : (formData.landmarks ? [formData.landmarks] : []);
            // Always save as lowercase and trimmed
            landmarksArr = landmarksArr.map(l => l.trim().toLowerCase()).filter(l => l);
            if (formData.customLandmark && formData.customLandmark.trim()) {
                landmarksArr.push(formData.customLandmark.trim().toLowerCase());
            }
            const landmarksString = landmarksArr.join(', ');

            Object.entries(formData).forEach(([key, value]) => {
                if (key === 'landmarks') {
                    formDataToSend.append('landmarks', landmarksString);
                } else if (key === 'customLandmark') {
                    /* skip, already merged above */
                } else if (key === 'price') {
                    // skip here; we'll append numeric price below
                } else if (value !== undefined && value !== null && value !== "") {
                    formDataToSend.append(key, value);
                }
            });
            // append numeric price value
            formDataToSend.append('price', priceNum);
            images.forEach(img => formDataToSend.append('existingImages', img));
            deletedImages.forEach(img => formDataToSend.append('deletedImages[]', img.split('/').pop()));
            newImages.forEach(file => formDataToSend.append('images', file));
            if (videoFile) formDataToSend.append('video', videoFile);
            if (removeVideo) formDataToSend.append('removeVideo', 'true');
            if (panorama) {
                formDataToSend.append('panorama360', panorama);
            } else if (existingPanorama === null && property && property.panorama360) {
                formDataToSend.append('removePanorama', 'true');
            }
            const response = await fetch(buildApi(`/properties/${propertyId}`), {
                method: 'PUT',
                headers: { Authorization: `Bearer ${userToken}` },
                body: formDataToSend
            });
            const data = await response.json();
            if (!response.ok) {
                if (data.errors && Array.isArray(data.errors)) {
                    data.errors.forEach(error => toast.error(error));
                } else if (data.error && typeof data.error === 'string') {
                    toast.error(data.error);
                } else if (data.message) {
                    toast.error(data.message);
                } else {
                    toast.error('Failed to update property');
                }
                return;
            }
            toast.success('Property updated successfully');
                try {
                    await clearFormPersistence(FORM_KEY);
                } catch (e) { console.error('Failed to clear draft after update', e); }
                navigate('/my-properties');
        } catch (err) {
            toast.error(err.message || 'Error updating property');
        } finally {
            setSubmitting(false);
        }
    };

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
                        <div className="map-preview-section">
                            <label>Property Location (drag marker to update)</label>
                            <div style={{ height: "300px", width: "100%", marginBottom: "1rem", borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 8px #0001" }}>
                                <MapContainer
                                    center={formData.latitude && formData.longitude ? [parseFloat(formData.latitude), parseFloat(formData.longitude)] : [14.813, 121.045]}
                                    zoom={15}
                                    style={{ height: "100%", width: "100%" }}
                                >
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                    {formData.latitude && formData.longitude && (
                                        <Marker
                                            position={[parseFloat(formData.latitude), parseFloat(formData.longitude)]}
                                            draggable={true}
                                            eventHandlers={{
                                                dragend: (e) => {
                                                    const latlng = e.target.getLatLng();
                                                    setFormData(f => ({ ...f, latitude: latlng.lat.toString(), longitude: latlng.lng.toString() }));
                                                    setManualPin(true);
                                                }
                                            }}
                                            icon={L.icon({
                                                iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
                                                iconSize: [25, 41],
                                                iconAnchor: [12, 41],
                                                popupAnchor: [1, -34],
                                                shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
                                                shadowSize: [41, 41]
                                            })}
                                        >
                                            <Popup>Drag to update location</Popup>
                                        </Marker>
                                    )}
                                </MapContainer>
                            </div>
                            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                                <input className="ll-field" type="text" name="latitude" value={formData.latitude} onChange={handleChange} placeholder="Latitude" style={{ width: "120px" }} />
                                <input className="ll-field" type="text" name="longitude" value={formData.longitude} onChange={handleChange} placeholder="Longitude" style={{ width: "120px" }} />
                                <button type="button" className="ll-btn tiny" onClick={() => {
                                    setFormData(f => ({
                                        ...f,
                                        latitude: originalLatLng.lat,
                                        longitude: originalLatLng.lng
                                    }));
                                    setManualPin(false);
                                    toast.info("Pin reset to original property location.");
                                }}>Reset Pin</button>
                                {manualPin && <span className="field-hint" style={{ color: "#1976d2" }}>Manual pin active</span>}
                            </div>
                        </div>
                        <div className="form-header">
                            <h2 className="form-title">Edit Property</h2>
                            <p className="form-subtitle">Update your listing details and images. Changes go live immediately after saving.</p>
                        </div>
                        <div className="form-grid">
                            
                            <div className="field-group">
                                <label className="required">Property Type</label>
                                <select className="ll-field" name="title" value={formData.title} onChange={handleChange} required>
                                    <option value="">Select Property Type</option>
                                    <option>House</option>
                                    <option>House and Lot</option>
                                    <option>Apartment</option>
                                    <option>Condominium</option>
                                    <option>Townhouse</option>
                                    <option>Dormitory</option>
                                    <option>Bedspace</option>
                                    <option>Studio Unit</option>
                                    <option>Lot</option>
                                    <option>Land</option>
                                    <option>Commercial Space</option>
                                    <option>Office Space</option>
                                    <option>Warehouse</option>
                                    <option>Building</option>
                                    <option>Bungalow</option>
                                    <option>Duplex</option>
                                    <option>Triplex</option>
                                    <option>Inner Lot</option>
                                    <option>Corner Lot</option>
                                </select>
                                <div className="field-hint small">{String(formData.title || '').length}/100</div>
                            </div>
                            <div className="field-group full">
                                <label className="required">Description</label>
                                <textarea className="ll-field" name="description" value={formData.description} onChange={handleChange} rows={5} maxLength={500} required />
                                <div className="field-hint small">{formData.description.length}/500</div>
                            </div>
                            <div className="field-group">
                                <label className="required">Address</label>
                                <input className="ll-field" name="address" value={formData.address} onChange={handleChange} required />
                            </div>
                            <div className="field-group">
                                <label className="required">Barangay</label>
                                <select className="ll-field" name="barangay" value={formData.barangay} onChange={handleChange} required>
                                    <option value="">Select barangay</option>
                                    {barangays.map(brgy => <option key={brgy} value={brgy}>{brgy}</option>)}
                                </select>
                            </div>
                            <div className="field-group">
                                <label className="required">Listing Type</label>
                                <select className="ll-field" name="propertyType" value={formData.propertyType} onChange={handleChange} required>
                                    <option value="For Rent">For Rent</option>
                                    <option value="For Sale">For Sale</option>
                                </select>
                            </div>
                            <div className="field-group">
                                <label className="required">Property Type</label>
                                <select className="ll-field" name="title" value={formData.title} onChange={handleChange} required>
                                    <option value="">Select Property Type</option>
                                    <option>House</option>
                                    <option>House and Lot</option>
                                    <option>Apartment</option>
                                    <option>Condominium</option>
                                    <option>Townhouse</option>
                                    <option>Dormitory</option>
                                    <option>Bedspace</option>
                                    <option>Studio Unit</option>
                                    <option>Lot</option>
                                    <option>Land</option>
                                    <option>Commercial Space</option>
                                    <option>Office Space</option>
                                    <option>Warehouse</option>
                                    <option>Building</option>
                                    <option>Bungalow</option>
                                    <option>Duplex</option>
                                    <option>Triplex</option>
                                    <option>Inner Lot</option>
                                    <option>Corner Lot</option>
                                </select>
                                <div className="field-hint small">{String(formData.title || '').length}/100</div>
                            </div>
                            <div className="field-group">
                                <label className="required">Price (₱)</label>
                                <input
                                    className="ll-field"
                                    type="text"
                                    name="price"
                                    pattern="^\d+(\.\d{1,2})?$"
                                    value={formData.price}
                                    onChange={handleChange}
                                    onFocus={() => { setPriceFocused(true); setPriceError(''); }}
                                    onBlur={() => {
                                        setPriceFocused(false);
                                        const num = parseLocaleNumber(formData.price);
                                        if (isNaN(num)) {
                                            setPriceError('Please enter a valid price');
                                        } else {
                                            try {
                                                const formatted = new Intl.NumberFormat(navigator.language, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
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
                                {priceError && <div className="field-error small" style={{color:'var(--danger)', marginTop:6}}>{priceError}</div>}
                            </div>
                            <div className="field-group">
                                <label>Number of Rooms</label>
                                <input className="ll-field" type="number" min={0} name="numberOfRooms" value={formData.numberOfRooms} onChange={handleChange} placeholder="e.g. 2" />
                            </div>
                            <div className="field-group">
                                <label className="required">Availability</label>
                                <select className="ll-field" name="availabilityStatus" value={formData.availabilityStatus} onChange={handleChange} required>
                                    <option value="Available">Available</option>
                                    <option value="Not Available">Not Available</option>
                                </select>
                                <div className="field-hint small">Choose the current availability for this listing.</div>
                            </div>
                            {/* Total Units is now system-managed on the backend; landlords cannot edit it here */}
                            <div className="field-group">
                                <label>Availability (system-managed)</label>
                                <div className="field-hint small">Available units are managed automatically by the system based on approved applications and the Total Units value.</div>
                            </div>
                            <div className="field-group">
                                <label className="required">Property Size (sqm)</label>
                                <input className="ll-field" type="number" min={0} step={0.1} name="areaSqm" value={formData.areaSqm} onChange={handleChange} placeholder="e.g. 45" required />
                            </div>
                            <div className="field-group">
                                <label className="required">Max Occupancy</label>
                                <input className="ll-field" type="number" min={1} name="occupancy" value={formData.occupancy} onChange={handleChange} required />
                            </div>
                            <div className="field-group toggle-field">
                                <label className="checkbox-label"><input type="checkbox" name="petFriendly" checked={formData.petFriendly} onChange={handleChange} /> Pet Friendly</label>
                                {formData.petFriendly && (
                                    <input className="ll-field mt-6" name="allowedPets" placeholder="Allowed pets (e.g. Cats, Dogs)" value={formData.allowedPets} onChange={handleChange} />
                                )}
                            </div>
                            <div className="field-group toggle-field">
                                <label className="checkbox-label"><input type="checkbox" name="parking" checked={formData.parking} onChange={handleChange} /> Parking Available</label>
                            </div>
                            <div className="field-group full">
                                <label>Nearby Landmarks</label>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                    alignItems: 'stretch',
                                    marginBottom: '8px'
                                }}>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: window.innerWidth < 768 ? '1fr' : 'repeat(2, 1fr)',
                                        gap: '8px 16px',
                                    }}>
                                        {LANDMARKS.map(l => (
                                            <label key={l} style={{display:'flex',alignItems:'center',gap:'8px',fontWeight:400,fontSize:'0.98em'}}>
                                                <input
                                                    type="checkbox"
                                                    name="landmarks"
                                                    value={l}
                                                    checked={Array.isArray(formData.landmarks) ? formData.landmarks.includes(l) : false}
                                                    onChange={e => {
                                                        const checked = e.target.checked;
                                                        setFormData(prev => {
                                                            let landmarksArr = Array.isArray(prev.landmarks) ? [...prev.landmarks] : (prev.landmarks ? [prev.landmarks] : []);
                                                            if (checked) {
                                                                if (!landmarksArr.includes(l)) landmarksArr.push(l);
                                                            } else {
                                                                landmarksArr = landmarksArr.filter(x => x !== l);
                                                            }
                                                            return { ...prev, landmarks: landmarksArr };
                                                        });
                                                    }}
                                                />
                                                {l.split(' ').map(word => word.includes('/') ? word.split('/').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('/') : word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="field-hint small">Check all that apply.</div>
                            </div>
                            <div className="field-group full">
                                <label>House Rules</label>
                                <textarea className="ll-field" name="rules" value={formData.rules} onChange={handleChange} placeholder="No loud noises after 10 PM, No smoking inside" rows={3} />
                            </div>
                        </div>

                        {/* 360° Panoramic Image Section - FIXED */}
                        <div className="panorama-section" style={{marginTop:'32px'}}>
                            <h3 className="section-title">360° Panoramic Image</h3>
                            <p className="field-hint">Optional: Add a panoramic 360° image (JPG/PNG/WebP, max 10MB, equirectangular projection).</p>
                            {(panoramaPreview || existingPanorama) ? (
                                <div style={{marginBottom:'12px'}}>
                                    <div className="panorama-preview-container">
                                        <PhotoDomeViewer 
                                            imageUrl={panoramaPreview || existingPanorama} 
                                            mode="MONOSCOPIC"
                                        />
                                    </div>
                                    <div style={{marginTop:'8px', display:'flex', gap:'8px'}}>
                                        <button type="button" className="ll-btn tiny danger" onClick={removePanorama}>Remove</button>
                                    </div>
                                </div>
                            ) : (
                                <label className="file-drop-modern">
                                    <input id="panorama-input" type="file" accept="image/*" style={{display:'none'}} onChange={handlePanoramaChange} />
                                    <span onClick={()=>document.getElementById('panorama-input').click()}>Add 360° Panoramic Image</span>
                                </label>
                            )}
                        </div>

                        <div className="images-section">
    {(() => {
        const existingCount = Array.isArray(images) ? images.length : 0;
        const newCount = Array.isArray(newImages) ? newImages.length : 0;
        return (<h3 className="section-title">Images <span style={{color:'red', marginLeft:'4px'}}>*</span> <span style={{fontWeight:400, fontSize:'0.7rem'}}>({existingCount + newCount}/8 total)</span></h3>);
    })()}
    <p className="field-hint">You can keep, remove, or add new images (max 8 total, JPG/PNG/WebP up to 10MB each).</p>
    <div className="current-images-grid">
        {images.length ? images.map((img, i) => {
            const url = img.startsWith('http') ? img : buildUpload(img);
            return (
                <div key={i} className="image-chip">
                    <img src={url} alt={`Property ${i}`} />
                    <button type="button" aria-label="Remove image" onClick={() => handleDeleteImage(i, true)}>&times;</button>
                </div>
            );
        }) : <div className="placeholder">No images</div>}
    </div>
    <div className="new-upload-block">
        <label className="file-drop-modern">
            <input type="file" multiple accept="image/*" onChange={handleImageChange} />
            <span>Add Images</span>
        </label>
        {newImages.length > 0 && (
            <div className="new-images-grid">
                {newImages.map((file, i) => (
                    <div key={i} className="image-chip pending">
                        <img src={URL.createObjectURL(file)} alt={`New ${i}`} />
                        <button type="button" aria-label="Remove pending image" onClick={() => handleDeleteImage(i, false)}>&times;</button>
                    </div>
                ))}
            </div>
        )}
    </div>
</div>
                        <div className="video-section">
                            <h3 className="section-title">Property Video <span style={{fontWeight:400, fontSize:'0.7rem'}}>({removeVideo ? 'will remove' : (videoFile ? 'new video selected' : (videoPreview ? 'existing' : 'none'))})</span></h3>
                            <p className="field-hint">Optional walkthrough clip (MP4/WebM/OGG, up to 50MB). Uploading a new one replaces the existing video.</p>
                            {!videoPreview && !videoFile && !removeVideo && (
                                <label className="file-drop-modern">
                                    <input type="file" accept="video/mp4,video/webm,video/ogg" onChange={(e)=>{
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const allowed = ['video/mp4','video/webm','video/ogg'];
                                        if (!allowed.includes(file.type)) { toast.error('Invalid video format.'); return; }
                                        if (file.size > 50*1024*1024) { toast.error('Video file too large (max 50MB).'); return; }
                                        setVideoFile(file);
                                        setVideoPreview(URL.createObjectURL(file));
                                        setRemoveVideo(false);
                                    }} />
                                    <span>Select Video</span>
                                </label>
                            )}
                            {(videoPreview || videoFile) && !removeVideo && (
                                <div className="video-preview-wrapper">
                                    <video src={videoPreview} controls preload="none" className="video-preview" />
                                    <div className="video-actions">
                                        <button type="button" className="ll-btn tiny danger" onClick={()=>{
                                            if (videoFile && videoPreview?.startsWith('blob:')) URL.revokeObjectURL(videoPreview);
                                            setVideoFile(null); setVideoPreview(null); setRemoveVideo(true);
                                        }}>Remove Video</button>
                                    </div>
                                </div>
                            )}
                            {removeVideo && (
                                <div className="removed-note">Video will be removed. <button type="button" className="link-btn" onClick={()=>setRemoveVideo(false)}>Undo</button></div>
                            )}
                        </div>
                        <div className="form-actions">
                            <button type="button" className="ll-btn outline" onClick={() => navigate(-1)}>Cancel</button>
                            <button type="submit" className="ll-btn primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default EditProperty;