import React, { useState, useEffect, useRef } from "react";
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

const EditProperty = () => {
    const { propertyId } = useParams();
    const navigate = useNavigate();
    
    // Base states
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [priceFocused, setPriceFocused] = useState(false);
    const [priceError, setPriceError] = useState('');
    const [manualPin, setManualPin] = useState(false);
    const [mapCenter, setMapCenter] = useState([14.8386, 120.8153]);
    const [mapZoom, setMapZoom] = useState(13);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [property, setProperty] = useState(null);
    const [originalLatLng, setOriginalLatLng] = useState({ lat: "", lng: "" });
    
    // Media states
    const [images, setImages] = useState([]);
    const [newImages, setNewImages] = useState([]);
    const [deletedImages, setDeletedImages] = useState([]);
    const [videoFile, setVideoFile] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);
    const [removeVideo, setRemoveVideo] = useState(false);
    
    // Panorama state management - FIXED: consistent naming
    const maxPanoramaImages = 5;
    const [panoramaImages, setPanoramaImages] = useState([]);
    const [newPanoramaImages, setNewPanoramaImages] = useState([]);
    const [deletedPanoramaImages, setDeletedPanoramaImages] = useState([]);
    const [panoramaPreviews, setPanoramaPreviews] = useState([]); // Correct name

    // Panorama viewer state
    const [expandedPanorama, setExpandedPanorama] = useState(null);

    const handleExpandPanorama = (imageUrl) => {
        setExpandedPanorama(imageUrl);
    };

    // Form data state
    const [formData, setFormData] = useState({
        listingType: '',
        propertyType: '',
        billsIncluded: [],
        propertyCondition: '',
        marketHighlights: [],
        address: '',
        barangay: '',
        price: '',
        numberOfRooms: '',
        availabilityStatus: 'Available',
        areaSqm: '',
        floorArea: '',
        lotArea: '',
        numberOfFloors: '',
        occupancy: '',
        petFriendly: false,
        allowedPets: [],
        parking: false,
        landmarks: [],
        rules: '',
        latitude: '',
        longitude: '',
        customLandmark: ''
    });

    const LISTING_TYPES = ['For Rent', 'For Sale'];
    const PROPERTY_TYPES = ['House','House and Lot','Apartment','Condominium','Townhouse','Dormitory','Bedspace','Studio Unit','Lot','Land','Commercial Space','Office Space','Warehouse','Building','Bungalow','Duplex','Triplex','Inner Lot','Corner Lot'];

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

    const FORM_KEY = `edit-property-${propertyId}-v1`;

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
                
                let landmarksArr = [];
                if (Array.isArray(data.landmarks)) {
                  landmarksArr = data.landmarks;
                } else if (typeof data.landmarks === 'string' && data.landmarks.trim()) {
                  landmarksArr = data.landmarks.split(',').map(l => l.trim()).filter(l => l);
                }
                
                // Initialize formData with null checks and proper type conversions
                setFormData({
                    propertyType: data.title || '',
                    billsIncluded: Array.isArray(data.billsIncluded) ? data.billsIncluded : 
                        (typeof data.billsIncluded === 'string' && data.billsIncluded.trim() ? 
                            data.billsIncluded.split(',').map(s=>s.trim()) : []),
                    propertyCondition: data.propertyCondition || '',
                    marketHighlights: Array.isArray(data.marketHighlights) ? data.marketHighlights : 
                        (typeof data.marketHighlights === 'string' && data.marketHighlights.trim() ? 
                            data.marketHighlights.split(',').map(s=>s.trim()) : []),
                    address: data.address || '',
                    price: String(data.price || ''),
                    barangay: data.barangay || '',
                    // Correctly determine and set listing type and property type
                    listingType: data.listingType || data.type || data.propertyListingType || '',  // Try different possible API field names
                    propertyType: data.title || data.propertyType || '',  // The actual property type
                    petFriendly: Boolean(data.petFriendly),
                    allowedPets: Array.isArray(data.allowedPets) ? data.allowedPets : 
                        (typeof data.allowedPets === 'string' && data.allowedPets.trim() ? 
                            data.allowedPets.split(',').map(s=>s.trim()) : []),
                    occupancy: String(data.occupancy || ''),
                    availabilityStatus: data.availabilityStatus || 'Available',
                    parking: Boolean(data.parking),
                    rules: data.rules || '',
                    landmarks: landmarksArr,
                    customLandmark: '',
                    numberOfRooms: String(data.numberOfRooms || ''),
                    areaSqm: String(data.areaSqm || ''),
                    floorArea: String(data.floorArea || ''),
                    lotArea: String(data.lotArea || ''),
                    numberOfFloors: String(data.numberOfFloors || ''),
                    latitude: String(data.latitude || ''),
                    longitude: String(data.longitude || '')
                });
                
                setOriginalLatLng({
                    lat: data.latitude ?? "",
                    lng: data.longitude ?? ""
                });
                setImages(data.images || []);
                if (data.video) {
                    setVideoPreview(data.video.startsWith('http') ? data.video : buildUpload(data.video));
                }
                if (data.panorama360Images && Array.isArray(data.panorama360Images)) {
                    setPanoramaImages(data.panorama360Images.map(url => 
                        url.startsWith('http') ? url : buildUpload(url)
                    ));
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
            // Clean up panorama preview URLs
            panoramaPreviews.forEach(url => {
                if (url.startsWith('blob:')) URL.revokeObjectURL(url);
            });
        };
    }, [videoFile, videoPreview, panoramaPreviews]);

    const handlePanoramaChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        // Check total number of images
        const currentTotal = panoramaImages.length + newPanoramaImages.length;
        if (currentTotal + files.length > maxPanoramaImages) {
            toast.error(`Maximum ${maxPanoramaImages} panoramic images allowed. You can add ${maxPanoramaImages - currentTotal} more.`);
            return;
        }

        // Validate each file
        const validFiles = files.filter(file => {
            const validType = file.type.startsWith('image/');
            const sizeOk = file.size <= 10 * 1024 * 1024;
            if (!validType) toast.error(`${file.name}: Only image files (JPG, PNG, WebP) allowed.`);
            if (!sizeOk) toast.error(`${file.name}: Image size exceeds 10MB limit.`);
            return validType && sizeOk;
        });

        if (!validFiles.length) return;

        // Add new images
        setNewPanoramaImages(prev => [...prev, ...validFiles]);
        setPanoramaPreviews(prev => [
            ...prev,
            ...validFiles.map(file => URL.createObjectURL(file))
        ]);
    };

    // Remove new panorama image
    const handleRemoveNewPanorama = (index) => {
        setPanoramaPreviews(prev => {
            const newPreviews = [...prev];
            URL.revokeObjectURL(newPreviews[index]);
            newPreviews.splice(index, 1);
            return newPreviews;
        });
        setNewPanoramaImages(prev => {
            const newImages = [...prev];
            newImages.splice(index, 1);
            return newImages;
        });
    };

    // Remove existing panorama image
    const handleRemovePanorama = (index) => {
        const imageToDelete = panoramaImages[index];
        setPanoramaImages(prev => prev.filter((_, i) => i !== index));
        setDeletedPanoramaImages(prev => [...prev, imageToDelete]);
    };

    // Use stable toast IDs and debounce geocoding to avoid spammy repeated toasts
    const GEOCODE_TOAST_WARN_ID = 'edit-geocode-warn';
    const GEOCODE_TOAST_ERROR_ID = 'edit-geocode-error';

    const geocodeAddress = async (address, barangay) => {
        if (!address || !barangay) return null;
        setIsGeocoding(true);
        const query = `${address}, ${barangay}, San Jose del Monte, Bulacan, Philippines`;
        try {
            // Try backend geocode first (if available) via buildApi
            const url = buildApi(`/geocode?q=${encodeURIComponent(query)}`);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) {
                // Fallback to public Nominatim
                try {
                    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
                    const nomRes = await fetch(nomUrl, { headers: { Accept: 'application/json' } });
                    if (nomRes.ok) {
                        const nomData = await nomRes.json().catch(() => null);
                        if (nomData && Array.isArray(nomData) && nomData.length > 0) {
                            const coords = { lat: parseFloat(nomData[0].lat), lon: parseFloat(nomData[0].lon) };
                            setMapCenter([coords.lat, coords.lon]);
                            setMapZoom(16);
                            setFormData(prev => ({ ...prev, latitude: coords.lat.toString(), longitude: coords.lon.toString() }));
                            setManualPin(false);
                            return coords;
                        }
                    }
                } catch (e) {
                    // ignore
                }
                // Friendly guidance for users: address format often needs commas
                toast.warn('Please include commas ( , ) in your address to get the correct location.', { toastId: GEOCODE_TOAST_ERROR_ID, autoClose: 5000 });
                return null;
            }
            const data = await res.json().catch(() => null);
            if (data && Array.isArray(data) && data.length > 0) {
                const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
                setMapCenter([coords.lat, coords.lon]);
                setMapZoom(16);
                setFormData(prev => ({
                    ...prev,
                    latitude: coords.lat.toString(),
                    longitude: coords.lon.toString()
                }));
                setManualPin(false);
                return coords;
            }
        } catch (err) {
            // If backend aborted or failed, try nominatim as a fallback
            try {
                const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
                const nomRes = await fetch(nomUrl, { headers: { Accept: 'application/json' } });
                if (nomRes.ok) {
                    const nomData = await nomRes.json().catch(() => null);
                    if (nomData && Array.isArray(nomData) && nomData.length > 0) {
                        const coords = { lat: parseFloat(nomData[0].lat), lon: parseFloat(nomData[0].lon) };
                        setMapCenter([coords.lat, coords.lon]);
                        setMapZoom(16);
                        setFormData(prev => ({ ...prev, latitude: coords.lat.toString(), longitude: coords.lon.toString() }));
                        setManualPin(false);
                        return coords;
                    }
                }
            } catch (e) {
                // ignore
            }
            toast.error('Error finding location. Please try again.', { toastId: GEOCODE_TOAST_ERROR_ID });
        } finally {
            setIsGeocoding(false);
        }
        return null;
    };

    // Debounce geocoding to reduce toast spam while typing
    const geocodeTimeoutRef = useRef(null);
    useEffect(() => {
        return () => { if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current); };
    }, []);

    const handleChange = async (e) => {
        const { name, value, type, checked } = e.target;
        let newValue = value;
        
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
        
        // Handle numeric fields (floorArea, lotArea)
        if (name === 'floorArea' || name === 'lotArea') {
            // Allow only numbers and decimal point
            const sanitized = value.replace(/[^\d.]/g, '');
            // Ensure only one decimal point
            const parts = sanitized.split('.');
            newValue = parts[0] + (parts.length > 1 ? '.' + parts[1] : '');
            console.log(`Debug - Field ${name} value:`, newValue);
        }
        
        // Use functional update to ensure we work with latest state and avoid stale reads
        setFormData(prev => {
            const next = { ...prev, [name]: type === "checkbox" ? checked : newValue };

            // Debounce geocoding trigger — wait a bit after user stops typing
            if (name === "address" || name === "barangay") {
                const nextAddress = next.address;
                const nextBarangay = next.barangay;

                if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
                geocodeTimeoutRef.current = setTimeout(async () => {
                    if (nextAddress && nextBarangay) {
                        await geocodeAddress(nextAddress, nextBarangay);
                    }
                }, 700);
            }

            return next;
        });
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

    useEffect(() => {
        const saved = loadFormState(FORM_KEY);
        if (saved) {
            const allowed = [
                'propertyType','billsIncluded','propertyCondition','marketHighlights','address','price','barangay','listingType','petFriendly','allowedPets','occupancy','parking','rules','landmarks','numberOfRooms','areaSqm','floorArea','lotArea','numberOfFloors','latitude','longitude','availabilityStatus'
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
                    setNewImages(prev => [...prev, ...imgs.filter(i=>i.blob).map(i=>i.blob)]);
                }
                const vid = await loadFiles(FORM_KEY, 'video');
                if (vid && vid.length) {
                    setVideoFile(vid[0].blob || null);
                    setVideoPreview(vid[0].url);
                }
                const pan = await loadFiles(FORM_KEY, 'panorama360Images');
                if (pan && pan.length) {
                    setNewPanoramaImages(pan.map(p => p.blob).filter(Boolean));
                    setPanoramaPreviews(pan.map(p => p.url).filter(Boolean));
                }
            } catch (e) { console.error('restore edit persistence', e); }
        })();
    }, [propertyId]);

    // Auto-clear fields and manage field visibility when listing type changes
    const isForRent = formData.listingType === 'For Rent';
    const isForSale = formData.listingType === 'For Sale';
    
    // Function to check if a field should be disabled based on listing type
    const isFieldDisabled = (fieldName) => {
        if (!formData.listingType) return true; // Disable all type-specific fields if no listing type selected
        
        const rentOnlyFields = ['occupancy', 'petFriendly', 'allowedPets', 'rules', 'billsIncluded'];
        const saleOnlyFields = ['propertyCondition', 'marketHighlights'];
        
        if (isForRent && saleOnlyFields.includes(fieldName)) return true;
        if (isForSale && rentOnlyFields.includes(fieldName)) return true;
        
        return false;
    };
    
    useEffect(() => {
        if (!formData.listingType) return;
        
        setFormData(prev => {
            const next = { ...prev };
            if (isForRent) {
                // Clear sale-only fields
                next.propertyCondition = '';
                next.marketHighlights = [];
            } else if (isForSale) {
                // Clear rent-only fields
                next.occupancy = '';
                next.petFriendly = false;
                next.allowedPets = [];
                next.rules = '';
                next.billsIncluded = [];
            }
            return next;
        });
    }, [formData.listingType]);

    useEffect(() => { if (newImages && newImages.length) saveFiles(FORM_KEY,'images', newImages.filter(f=> f instanceof File)).catch(()=>{}); }, [newImages]);
    useEffect(() => { if (videoFile && videoFile instanceof File) saveFiles(FORM_KEY,'video',[videoFile]).catch(()=>{}); }, [videoFile]);
    useEffect(() => { if (newPanoramaImages && newPanoramaImages.length) saveFiles(FORM_KEY,'panorama360Images', newPanoramaImages.filter(f=> f instanceof File)).catch(()=>{}); }, [newPanoramaImages]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;
        try {
            const userToken = localStorage.getItem("user_token");
            if (!userToken) throw new Error("Unauthorized access. Please log in.");
            
            const requiredChecks = [
                { key: 'propertyType', ok: formData.propertyType && formData.propertyType.toString().trim() !== '', msg: "Please select a property type" },
                { key: 'address', ok: formData.address && formData.address.toString().trim() !== '', msg: "The property address cannot be empty" },
                { key: 'price', ok: formData.price && formData.price.toString().trim() !== '', msg: "Don't forget to set a price" },
                { key: 'barangay', ok: formData.barangay && formData.barangay.toString().trim() !== '', msg: "Please select a barangay for your property" },
                { key: 'listingType', ok: formData.listingType && formData.listingType.toString().trim() !== '', msg: "Please select listing type" },
                { key: 'areaSqm', ok: formData.areaSqm !== undefined && formData.areaSqm !== '' && !isNaN(Number(formData.areaSqm)) && Number(formData.areaSqm) > 0, msg: "Please provide the floor area (in square meters)" },
                { key: 'floorArea', ok: formData.floorArea !== undefined && formData.floorArea !== '', msg: "Please provide the total floor area (floor area)" },
                { key: 'lotArea', ok: formData.lotArea !== undefined && formData.lotArea !== '', msg: "Please provide the lot area" },
                { key: 'numberOfFloors', ok: formData.numberOfFloors !== undefined && formData.numberOfFloors !== '', msg: "Please specify the number of floors" }
            ];
            
            // Add conditional validations based on listing type
            if (isForRent) {
                requiredChecks.push({ 
                    key: 'occupancy', 
                    ok: formData.occupancy && formData.occupancy.toString().trim() !== '' && !isNaN(Number(formData.occupancy)) && Number(formData.occupancy) > 0, 
                    msg: "Please specify maximum occupancy (must be greater than 0)" 
                });
            } else if (isForSale) {
                requiredChecks.push({ 
                    key: 'propertyCondition', 
                    ok: formData.propertyCondition && formData.propertyCondition.toString().trim() !== '', 
                    msg: "Please select the property condition" 
                });
            }
            
            for (const chk of requiredChecks) {
                if (!chk.ok) { toast.error(chk.msg); return; }
            }

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
            if (isNaN(priceNum) || priceNum <= 0) {
                toast.error('Please enter a valid price greater than 0');
                return;
            }

            const areaSqmNum = parseLocaleNumber(formData.areaSqm);
            if (isNaN(areaSqmNum) || areaSqmNum <= 0) {
                toast.error('Please enter a valid floor area greater than 0');
                return;
            }

            // Parse and validate required numeric fields
            console.log('Debug - Before parsing numeric fields:', {
                rawFloorArea: formData.floorArea,
                rawLotArea: formData.lotArea,
                rawFloors: formData.numberOfFloors
            });

            const floorAreaNum = parseLocaleNumber(formData.floorArea);
            console.log('Debug - Parsed floorArea:', {
                input: formData.floorArea,
                parsed: floorAreaNum,
                isValid: !isNaN(floorAreaNum) && floorAreaNum > 0
            });
            if (isNaN(floorAreaNum) || floorAreaNum <= 0) {
                toast.error('Floor area must be a number greater than 0');
                return;
            }

            const lotAreaNum = parseLocaleNumber(formData.lotArea);
            console.log('Debug - Parsed lotArea:', {
                input: formData.lotArea,
                parsed: lotAreaNum,
                isValid: !isNaN(lotAreaNum) && lotAreaNum > 0
            });
            if (isNaN(lotAreaNum) || lotAreaNum <= 0) {
                toast.error('Lot area must be a number greater than 0');
                return;
            }

            const floorsNumRaw = formData.numberOfFloors;
            const floorsNum = floorsNumRaw === '' || floorsNumRaw === null ? NaN : Number(floorsNumRaw);
            console.log('Debug - Parsed numberOfFloors:', {
                input: floorsNumRaw,
                parsed: floorsNum,
                isValid: !isNaN(floorsNum) && Number.isInteger(floorsNum) && floorsNum >= 1 && floorsNum <= 5
            });
            if (isNaN(floorsNum) || !Number.isInteger(floorsNum) || floorsNum < 1 || floorsNum > 5) {
                toast.error('Number of floors must be a whole number between 1 and 5');
                return;
            }

            if (formData.listingType === 'For Rent') {
                const occupancyNum = parseLocaleNumber(formData.occupancy);
                if (isNaN(occupancyNum) || occupancyNum <= 0) {
                    toast.error('Please enter a valid maximum occupancy greater than 0');
                    return;
                }
            }

            setSubmitting(true);

            const formDataToSend = new FormData();
            
            let landmarksArr = Array.isArray(formData.landmarks) ? [...formData.landmarks] : [];
            landmarksArr = landmarksArr.map(l => l.trim()).filter(l => l);
            const landmarksString = landmarksArr.join(', ');

            Object.entries(formData).forEach(([key, value]) => {
                // Skip validation for disabled fields based on listing type
                if (isFieldDisabled(key)) return;
                if (key === 'landmarks') {
                    formDataToSend.append('landmarks', landmarksString);
                } else if (key === 'allowedPets') {
                    formDataToSend.append('allowedPets', Array.isArray(value) ? value.join(', ') : (value || ''));
                } else if (key === 'billsIncluded') {
                    formDataToSend.append('billsIncluded', Array.isArray(value) ? value.join(', ') : '');
                } else if (key === 'marketHighlights') {
                    formDataToSend.append('marketHighlights', Array.isArray(value) ? value.join(', ') : '');
                } else if (key === 'propertyCondition') {
                    formDataToSend.append('propertyCondition', value || '');
                } else if (key === 'customLandmark') {
                    // Skip custom landmark
                } else if (key === 'price') {
                    // Price handled separately
                } else if (key === 'areaSqm') {
                    // areaSqm handled separately
                } else if (key === 'occupancy') {
                    // occupancy handled separately
                } else if (value !== undefined && value !== null && value !== "") {
                    formDataToSend.append(key, value);
                }
            });
            
            // Append parsed numeric values with proper checks
            formDataToSend.append('price', priceNum.toString());
            formDataToSend.append('areaSqm', areaSqmNum.toString());
            
            // Add the floor area, lot area, and number of floors
            console.log('Debug - Form Values:', {
                rawFloorArea: formData.floorArea,
                parsedFloorArea: floorAreaNum,
                rawLotArea: formData.lotArea,
                parsedLotArea: lotAreaNum,
                rawFloors: formData.numberOfFloors,
                parsedFloors: floorsNum
            });

            // Add the required numeric fields with proper validation
            console.log('Debug - Values being appended to FormData:', {
                floorArea: floorAreaNum,
                lotArea: lotAreaNum,
                numberOfFloors: floorsNum
            });

            formDataToSend.append('floorArea', floorAreaNum);
            formDataToSend.append('lotArea', lotAreaNum);
            formDataToSend.append('numberOfFloors', floorsNum);

            // Debug log FormData
            console.log('Debug - FormData contents:');
            for (let pair of formDataToSend.entries()) {
                console.log(pair[0] + ': ' + pair[1]);
            }
            
            if (formData.listingType === 'For Rent') {
                formDataToSend.append('occupancy', parseLocaleNumber(formData.occupancy).toString());
            }
            
            // Handle images
            newImages.forEach(file => formDataToSend.append('images', file));
            if (deletedImages.length > 0) {
                deletedImages.forEach(img => {
                    const filename = img.split('/').pop();
                    formDataToSend.append('deletedImages', filename);
                });
            }
            
            // Handle video
            if (videoFile) formDataToSend.append('video', videoFile);
            if (removeVideo) formDataToSend.append('removeVideo', 'true');
            
            // Handle panorama images - convert existing ones to files if needed
            const existingPanoramaFiles = await Promise.all(
                panoramaImages.map(async (url) => {
                    if (url.startsWith('blob:')) return null;
                    try {
                        const response = await fetch(url);
                        const blob = await response.blob();
                        return new File([blob], url.split('/').pop(), { type: blob.type });
                    } catch (e) {
                        console.error('Failed to convert panorama URL to file:', e);
                        return null;
                    }
                })
            );

            // Combine existing and new panorama files, filtering out nulls
            const allPanoramaFiles = [...existingPanoramaFiles.filter(Boolean), ...newPanoramaImages];
            
            // Append all panorama images
            allPanoramaFiles.forEach(file => {
                formDataToSend.append('panorama360Images', file);
            });
            
            // Add deleted panorama images to form data
            deletedPanoramaImages.forEach(url => {
                const filename = url.split('/').pop();
                formDataToSend.append('deletedPanoramaImages', filename);
            });
            
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
                } else if (data.details && Array.isArray(data.details)) {
                    data.details.forEach(error => toast.error(error));
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
            console.error('Update property error:', err);
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
                        <div className="map-preview-section ll-card" style={{padding: '24px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', background: '#fafafa', marginBottom: '32px'}}>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px'}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                    <h3 style={{margin: 0}}>Property Location</h3>
                                    {isGeocoding && (
                                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9em', color: '#666'}}>
                                            <div style={{width: '16px', height: '16px', border: '2px solid #666', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></div>
                                            Finding location...
                                        </div>
                                    )}
                                </div>
                                <div style={{
                                    padding: '12px',
                                    background: '#fff',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '8px',
                                    fontSize: '0.9em',
                                    color: '#555'
                                }}>
                                    <div style={{fontWeight: 'bold', marginBottom: '8px'}}>📍 How to update your property's location:</div>
                                    <ol style={{margin: '0', paddingLeft: '20px'}}>
                                        <li>Update address or barangay for automatic pin placement</li>
                                        <li>Fine-tune the location by either:
                                            <ul style={{marginTop: '4px'}}>
                                                <li>Clicking anywhere on the map to move the pin</li>
                                                <li>Dragging the red pin marker to the exact location</li>
                                            </ul>
                                        </li>
                                        <li>Zoom in/out using the +/- buttons or mouse wheel for better accuracy</li>
                                        <li>Click "Reset Pin" to restore the original location</li>
                                    </ol>
                                </div>
                            </div>
                            <div style={{ height: "300px", width: "100%", marginBottom: "1rem", borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 8px #0001" }}>
                                <MapContainer
                                    center={formData.latitude && formData.longitude ? [parseFloat(formData.latitude), parseFloat(formData.longitude)] : mapCenter}
                                    zoom={mapZoom}
                                    style={{ height: "100%", width: "100%" }}
                                >
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
                                                    setFormData(f => ({ ...f, latitude: latlng.lat.toString(), longitude: latlng.lng.toString() }));
                                                    setManualPin(true);
                                                    toast.success('Location updated! ✨', {autoClose: 2000});
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
                                            <Popup>
                                                <div style={{fontSize: '0.9em', padding: '4px'}}>
                                                    <div style={{fontWeight: 'bold', marginBottom: '4px'}}>{formData.propertyType || 'Property'}</div>
                                                    <div style={{color: '#666', marginBottom: '4px'}}>{formData.address}</div>
                                                    {formData.price && <div style={{color: '#2c5282', fontWeight: 'bold', marginBottom: '4px'}}>₱{formData.price}</div>}
                                                    <div style={{fontSize: '0.8em', color: '#666', marginTop: '8px'}}>
                                                        {manualPin ? '✏️ Manually placed' : '🎯 Auto-located'}<br/>
                                                        Drag pin or click map to adjust
                                                    </div>
                                                </div>
                                            </Popup>
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
                                <label className="required">Listing Type</label>
                                <select className="ll-field" name="listingType" value={formData.listingType} onChange={handleChange} required>
                                    <option value="">Select Listing Type</option>
                                    <option value="For Rent">For Rent</option>
                                    <option value="For Sale">For Sale</option>
                                </select>
                            </div>

                            <div className="field-group">
                                <label className="required">Property Type</label>
                                <select className="ll-field" name="propertyType" value={formData.propertyType} onChange={handleChange} required>
                                    <option value="">Select Property Type</option>
                                    {PROPERTY_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                                </select>
                            </div>

                            <div className="field-group full">
                                <label>Bills Included</label>
                                <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                                    {['Water','Electricity'].map(b => (
                                        <label key={b} style={{display:'flex',alignItems:'center',gap:8,fontWeight:500}}>
                                            <input 
                                                type="checkbox" 
                                                name="billsIncluded" 
                                                value={b} 
                                                checked={Array.isArray(formData.billsIncluded) ? formData.billsIncluded.includes(b) : false} 
                                                onChange={(e)=>{
                                                    const checked = e.target.checked;
                                                    setFormData(prev => {
                                                        const arr = Array.isArray(prev.billsIncluded) ? [...prev.billsIncluded] : [];
                                                        if (checked) {
                                                            if (!arr.includes(b)) arr.push(b);
                                                        } else {
                                                            const idx = arr.indexOf(b); if (idx>=0) arr.splice(idx,1);
                                                        }
                                                        return { ...prev, billsIncluded: arr };
                                                    });
                                                }} 
                                                disabled={isFieldDisabled('billsIncluded')} 
                                            />
                                            {b}
                                        </label>
                                    ))}
                                </div>
                                <div className="field-hint small">{formData.listingType === 'For Sale' ? 'Not applicable for sale listings' : 'Check bills that are included in the rent (optional)'}</div>
                            </div>

                            <div className="field-group">
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
                            </div>

                            <div className="field-group full">
                                <label>Market Highlights</label>
                                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                                    {['Ready for Occupancy (RFO)','Pre-selling (under construction)','Negotiable Price','Clean Title','Inclusive of Taxes and Fees','Good Investment Opportunity','Rush Sale / Below Market Value'].map(mh => (
                                        <label key={mh} style={{display:'flex',alignItems:'center',gap:8,fontWeight:500}}>
                                            <input 
                                                type="checkbox" 
                                                name="marketHighlights" 
                                                value={mh} 
                                                checked={Array.isArray(formData.marketHighlights) ? formData.marketHighlights.includes(mh) : false} 
                                                onChange={(e)=>{
                                                    const checked = e.target.checked;
                                                    setFormData(prev => {
                                                        const arr = Array.isArray(prev.marketHighlights) ? [...prev.marketHighlights] : [];
                                                        if (checked) {
                                                            if (!arr.includes(mh)) arr.push(mh);
                                                        } else {
                                                            const idx = arr.indexOf(mh); if (idx>=0) arr.splice(idx,1);
                                                        }
                                                        return { ...prev, marketHighlights: arr };
                                                    });
                                                }} 
                                            />
                                            {mh}
                                        </label>
                                    ))}
                                </div>
                                <div className="field-hint small">Optional - check any market highlights that apply.</div>
                            </div>

                            <div className="field-group">
                                <label className="required">Address</label>
                                <input className="ll-field" name="address" value={formData.address} onChange={handleChange} required placeholder="E.g., Heroesville 1, Blk 15, Lot 8" />
                                <div className="field-hint small">Tip: Include commas to separate street, block, lot (e.g., "Street, Blk, Lot") for better geocoding.</div>
                            </div>

                            <div className="field-group">
                                <label className="required">Barangay</label>
                                <select className="ll-field" name="barangay" value={formData.barangay} onChange={handleChange} required>
                                    <option value="">Select barangay</option>
                                    {barangays.map(brgy => <option key={brgy} value={brgy}>{brgy}</option>)}
                                </select>
                            </div>
                            
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
                                        const num = (function parseLocaleNumberLocal(str){
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
                                        })(formData.price);
                                        if (isNaN(num) || num <= 0) {
                                            setPriceError('Please enter a valid price greater than 0');
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
                                <select className="ll-field" name="numberOfRooms" value={formData.numberOfRooms} onChange={handleChange}>
                                    <option value="">Select number</option>
                                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>

                            <div className="field-group">
                                <label className="required">Availability</label>
                                <select className="ll-field" name="availabilityStatus" value={formData.availabilityStatus} onChange={handleChange} required>
                                    <option value="Available">Available</option>
                                    <option value="Not Available">Not Available</option>
                                </select>
                                <div className="field-hint small">Choose the current availability for this listing.</div>
                            </div>

                            <div className="field-group">
                                <label className="required">Property Size (sqm)</label>
                                <input className="ll-field" type="number" min={0.1} step={0.1} name="areaSqm" value={formData.areaSqm} onChange={handleChange} placeholder="e.g. 45" required />
                            </div>

                            <div className="field-group">
                                <label className="required">Floor Area (sqm)</label>
                                <input className="ll-field" type="text" name="floorArea" value={formData.floorArea} onChange={handleChange} placeholder="e.g. 45 or 45.5" required />
                                <div className="field-hint small">Total usable floor area in sqm (numbers only; decimals allowed). Required.</div>
                            </div>

                            <div className="field-group">
                                <label className="required">Lot Area (sqm)</label>
                                <input className="ll-field" type="text" name="lotArea" value={formData.lotArea} onChange={handleChange} placeholder="e.g. 100" required />
                                <div className="field-hint small">Lot size in sqm. Required.</div>
                            </div>

                            <div className="field-group">
                                <label className="required">Number of Floors</label>
                                <select className="ll-field" name="numberOfFloors" value={formData.numberOfFloors} onChange={handleChange} required>
                                    <option value="">Select number</option>
                                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <div className="field-hint small">Number of floors (1–5). Required.</div>
                            </div>

                            <div className="field-group">
                                <label className={formData.listingType === 'For Rent' ? 'required' : ''}>Max Occupancy</label>
                                <select className="ll-field" name="occupancy" value={formData.occupancy} onChange={handleChange} required={formData.listingType === 'For Rent'} disabled={formData.listingType === 'For Sale'}>
                                    <option value="">Select number</option>
                                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                {formData.listingType === 'For Sale' && <div className="field-hint small" style={{color:'#666'}}>Disabled for For Sale listings</div>}
                            </div>

                            <div className="field-group toggle-field">
                                <label className="checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        name="petFriendly" 
                                        checked={formData.petFriendly} 
                                        onChange={handleChange} 
                                        disabled={formData.listingType === 'For Sale'} 
                                    /> 
                                    Pet Friendly
                                </label>
                                {formData.petFriendly && formData.listingType !== 'For Sale' && (
                                    <div className="ll-field mt-6 pet-types" style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                                        {['Cat','Dog','Bird','Fish'].map(p=> (
                                            <label key={p} style={{display:'flex',alignItems:'center',gap:8,fontWeight:500}}>
                                                <input 
                                                    type="checkbox" 
                                                    name="allowedPets" 
                                                    value={p} 
                                                    checked={Array.isArray(formData.allowedPets) ? formData.allowedPets.includes(p) : false} 
                                                    onChange={(e)=>{
                                                        const checked = e.target.checked;
                                                        setFormData(prev=>{
                                                            const arr = Array.isArray(prev.allowedPets) ? [...prev.allowedPets] : [];
                                                            if (checked) { if (!arr.includes(p)) arr.push(p); }
                                                            else { const idx = arr.indexOf(p); if (idx>=0) arr.splice(idx,1); }
                                                            return { ...prev, allowedPets: arr };
                                                        });
                                                    }} 
                                                />
                                                {p}
                                            </label>
                                        ))}
                                    </div>
                                )}
                                {formData.listingType === 'For Sale' && <div className="field-hint small" style={{color:'#666'}}>Pets not applicable for sale listings</div>}
                            </div>

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
                                                            let landmarksArr = Array.isArray(prev.landmarks) ? [...prev.landmarks] : [];
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
                                <textarea className="ll-field" name="rules" value={formData.rules} onChange={handleChange} placeholder="No loud noises after 10 PM, No smoking inside" rows={3} disabled={formData.listingType === 'For Sale'} />
                                {formData.listingType === 'For Sale' && <div className="field-hint small" style={{color:'#666'}}>Not used for sale listings</div>}
                            </div>
                        </div>

                        <div className="panorama-section" style={{marginTop:'32px'}}>
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
                                                <button 
                                                    type="button"
                                                    className="panorama-control-btn remove"
                                                    title="Remove Image"
                                                    onClick={() => handleRemovePanorama(index)}
                                                >
                                                    <i className="fas fa-times"></i>
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
                                                <button 
                                                    type="button"
                                                    className="panorama-control-btn remove"
                                                    title="Remove Image"
                                                    onClick={() => handleRemoveNewPanorama(index)}
                                                >
                                                    <i className="fas fa-times"></i>
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
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Upload Section */}
                            <div className={`panorama-upload ${panoramaImages.length + newPanoramaImages.length >= maxPanoramaImages ? 'disabled' : ''}`}>
                                <label 
                                    htmlFor="panorama-input"
                                    style={{ cursor: panoramaImages.length + newPanoramaImages.length >= maxPanoramaImages ? 'not-allowed' : 'pointer' }}
                                >
                                    <input
                                        id="panorama-input"
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handlePanoramaChange}
                                        disabled={panoramaImages.length + newPanoramaImages.length >= maxPanoramaImages}
                                        style={{ display: 'none' }}
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
                                    <button type="button" className="ll-btn tiny danger" onClick={()=> {
                                        if (videoFile && videoPreview?.startsWith('blob:')) URL.revokeObjectURL(videoPreview);
                                        setVideoFile(null); 
                                        setVideoPreview(null); 
                                        setRemoveVideo(true);
                                    }}>Remove Video</button>
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
};

export default EditProperty;