import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthContext } from '../../../context/AuthContext';
import { buildApi } from '../../../services/apiConfig';
import Sidebar from '../Sidebar/Sidebar';
import '../landlord-theme.css';
import './AddProperties.css';
import PhotoDomeViewer from '../../../components/PhotoDomeViewer';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const barangayList = [
    'Assumption','Bagong Buhay I','Bagong Buhay II','Bagong Buhay III','Ciudad Real','Citrus','Dulong Bayan','Fatima I','Fatima II','Fatima III','Fatima IV','Fatima V','Francisco Homes – Guijo','Francisco Homes – Mulawin','Francisco Homes – Narra','Francisco Homes – Yakal','Gaya-gaya','Graceville','Gumaok Central','Gumaok East','Gumaok West','Kaybanban','Kaypian','Lawang Pare','Maharlika','Minuyan I','Minuyan II','Minuyan III','Minuyan IV','Minuyan V','Minuyan Proper','Muzon East','Muzon Proper','Muzon South','Muzon West','Paradise III','Poblacion','Poblacion 1','San Isidro','San Manuel','San Martin De Porres','San Martin I','San Martin II','San Martin III','San Martin IV','San Pedro','San Rafael I','San Rafael II','San Rafael III','San Rafael IV','San Rafael V','San Roque','Sapang Palay Proper','Sta. Cruz I','Sta. Cruz II','Sta. Cruz III','Sta. Cruz IV','Sta. Cruz V','Sto. Cristo','Sto. Nino I','Sto. Nino II','Tungkong Mangga'
];

const PROPERTY_TYPES = ['House','House and Lot','Apartment','Condominium','Townhouse','Dormitory','Bedspace','Studio Unit','Lot','Land','Commercial Space','Office Space','Warehouse','Building','Bungalow','Duplex','Triplex','Inner Lot','Corner Lot'];

const LANDMARKS = [
    "park", "church", "public market", "major highway", "public transport stops",
    "banks and atms", "restaurant/food centers", "convenience store/supermarket",
    "school/university", "hospital/health care"
];

// Default map center and zoom for San Jose del Monte
const SJDM_CENTER = [14.8136, 121.0450];
const SJDM_ZOOM = 13;

const AddProperties = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapCenter, setMapCenter] = useState(SJDM_CENTER);
  const [mapZoom, setMapZoom] = useState(SJDM_ZOOM);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Multiple panoramas
  const [panoramas, setPanoramas] = useState([]);
  const [panoramaPreviews, setPanoramaPreviews] = useState([]);

  const handlePanoramaChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const validFiles = files.filter(file => {
      const validType = file.type.startsWith('image/');
      const sizeOk = file.size <= 10*1024*1024;
      if (!validType) toast.error(`${file.name}: Only image files (JPG, PNG, WebP) allowed.`);
      if (!sizeOk) toast.error(`${file.name}: Image size exceeds 10MB limit.`);
      return validType && sizeOk;
    });
    if (!validFiles.length) return;
    const existingNames = panoramas.map(f => f.name);
    const newFiles = validFiles.filter(f => !existingNames.includes(f.name));
    setPanoramas(prev => [...prev, ...newFiles]);
    setPanoramaPreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))]);
  };

  const removePanorama = (idx) => {
    setPanoramaPreviews(prev => {
      if (prev[idx]) URL.revokeObjectURL(prev[idx]);
      return prev.filter((_,i)=>i!==idx);
    });
    setPanoramas(prev => prev.filter((_,i)=>i!==idx));
  };
  
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [propertyData, setPropertyData] = useState({
    propertyType: '', 
    billsIncluded: [], 
    propertyCondition: '', 
    marketHighlights: [], 
    address:'', 
    price:'', 
    barangay:'', 
    listingType: '', 
    petFriendly:false, 
    allowedPets:[], 
    occupancy:'', 
    parking:false, 
    rules:'', 
    landmarks:[], 
    numberOfRooms:'', 
    areaSqm:'', 
    floorArea:'',
    lotArea:'',
    numberOfFloors:'',
    images:[], 
    video:null, 
    latitude:'', 
    longitude:'', 
    availabilityStatus: 'Available'
  });

  // Auto-clear fields when listing type changes
  useEffect(() => {
    const lt = propertyData.listingType;
    setPropertyData(prev => {
      const next = { ...prev };
      if (lt === 'For Rent') {
        next.propertyCondition = '';
        next.marketHighlights = [];
      } else if (lt === 'For Sale') {
        next.occupancy = '';
        next.petFriendly = false;
        next.allowedPets = [];
        next.rules = '';
        next.billsIncluded = [];
      }
      return next;
    });
  }, [propertyData.listingType]);

  const [priceFocused, setPriceFocused] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [imagePreviews, setImagePreviews] = useState([]);
  const [videoPreview, setVideoPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const MAX_IMAGES = 8;

  const GEOCODE_TOAST_WARN_ID = 'geocode-warn';
  const GEOCODE_TOAST_ERROR_ID = 'geocode-error';
  const GEOCODE_TOAST_TIMEOUT_ID = 'geocode-timeout';

  const geocodeAddress = async (address, barangay) => {
    if (!address || !barangay) return null;
    setIsGeocoding(true);
    const query = `${address}, ${barangay}, San Jose del Monte, Bulacan, Philippines`;
    try {
      const url = buildApi(`/geocode?q=${encodeURIComponent(query)}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
          const nomRes = await fetch(nomUrl, { headers: { Accept: 'application/json' } });
          if (nomRes.ok) {
            const nomData = await nomRes.json().catch(() => null);
            if (nomData && Array.isArray(nomData) && nomData.length > 0) {
              const coords = { lat: parseFloat(nomData[0].lat), lon: parseFloat(nomData[0].lon) };
              setMapCenter([coords.lat, coords.lon]);
              setMapZoom(16);
              return coords;
            }
          }
        } catch (e) {}
        toast.warn('Please include commas ( , ) in your address to get the correct location.', { toastId: GEOCODE_TOAST_ERROR_ID, autoClose: 5000 });
        return null;
      }
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data) && data.length > 0) {
        const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        setMapCenter([coords.lat, coords.lon]);
        setMapZoom(16);
        return coords;
      }
      return null;
    } catch (err) {
      if (err.name === 'AbortError') {
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
          const nomRes = await fetch(nomUrl, { headers: { Accept: 'application/json' } });
          if (nomRes.ok) {
            const nomData = await nomRes.json().catch(() => null);
            if (nomData && Array.isArray(nomData) && nomData.length > 0) {
              const coords = { lat: parseFloat(nomData[0].lat), lon: parseFloat(nomData[0].lon) };
              setMapCenter([coords.lat, coords.lon]);
              setMapZoom(16);
              return coords;
            }
          }
        } catch (e) {}
        toast.error('Geocoding request timed out. Try again.', { toastId: GEOCODE_TOAST_TIMEOUT_ID });
      } else {
        console.error('Geocode error:', err);
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
          const nomRes = await fetch(nomUrl, { headers: { Accept: 'application/json' } });
          if (nomRes.ok) {
            const nomData = await nomRes.json().catch(() => null);
            if (nomData && Array.isArray(nomData) && nomData.length > 0) {
              const coords = { lat: parseFloat(nomData[0].lat), lon: parseFloat(nomData[0].lon) };
              setMapCenter([coords.lat, coords.lon]);
              setMapZoom(16);
              return coords;
            }
          }
        } catch (e) {}
        toast.error('Error finding location. Please try again.', { toastId: GEOCODE_TOAST_ERROR_ID });
      }
      return null;
    } finally {
      setIsGeocoding(false);
    }
  };

  function LocationSelector() {
    useMapEvents({
      click(e) {
        setPropertyData(prev => ({ ...prev, latitude: e.latlng.lat, longitude: e.latlng.lng, manualPin: true }));
        toast.info('Pin location set!');
      }
    });
    return null;
  }

  function MapCenterSync({ lat, lng }) {
    const map = useMap();
    useEffect(() => {
      if (!lat || !lng) return;
      try {
        map.setView([parseFloat(lat), parseFloat(lng)], Math.max(map.getZoom(), 15), { animate: true });
      } catch (e) {}
    }, [lat, lng, map]);
    return null;
  }

  const geocodeTimeoutRef = React.useRef(null);

  useEffect(() => {
    return () => {
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
    };
  }, []);

  const handleInputChange = async (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = value;
    
    if (name === 'price') {
      const parts = new Intl.NumberFormat(navigator.language).formatToParts(12345.6);
      const group = parts.find(p => p.type === 'group')?.value || ',';
      const decimal = parts.find(p => p.type === 'decimal')?.value || '.';
      const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const allowedRegex = new RegExp(`[^0-9${esc(group)}${esc(decimal)}]`, 'g');
      let sanitized = (value || '').replace(allowedRegex, '');
      const decCount = (sanitized.match(new RegExp(esc(decimal), 'g')) || []).length;
      if (decCount > 1) {
        const first = sanitized.indexOf(decimal);
        sanitized = sanitized.slice(0, first + 1) + sanitized.slice(first + 1).replace(new RegExp(esc(decimal), 'g'), '');
      }
      newValue = sanitized;
    }
    
    setPropertyData(prev => {
      const nextState = { ...prev, [name]: type === 'checkbox' ? checked : newValue };

      if (name === 'address' || name === 'barangay') {
        const nextAddress = nextState.address;
        const nextBarangay = nextState.barangay;

        if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
        geocodeTimeoutRef.current = setTimeout(async () => {
          if (nextAddress && nextBarangay) {
            const coords = await geocodeAddress(nextAddress, nextBarangay);
            if (coords) {
              setPropertyData(p => ({ ...p, latitude: coords.lat, longitude: coords.lon }));
            }
          }
        }, 700);
      }

      return nextState;
    });
  };

  const handleImageChange = (e) => {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;
    const spaceLeft = MAX_IMAGES - propertyData.images.length;
    if (spaceLeft <= 0) { 
      toast.info(`Cannot add more images. Maximum limit of ${MAX_IMAGES} images has been reached.`); 
      return; 
    }
    const usable = selected.slice(0, spaceLeft).filter(f => {
      const validType = f.type.startsWith('image/');
      const sizeOk = f.size <= 10*1024*1024;
      if (!validType) toast.error(`${f.name} was not added: Only image files (JPG, PNG, WebP) are allowed.`);
      if (!sizeOk) toast.error(`${f.name} was not added: Image size exceeds 10MB limit.`);
      return validType && sizeOk;
    });
    if (!usable.length) return;
    setPropertyData(p => ({ ...p, images:[...p.images, ...usable] }));
    setImagePreviews(p => [...p, ...usable.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (index) => {
    setPropertyData(p => ({ ...p, images: p.images.filter((_,i)=>i!==index) }));
    setImagePreviews(p => p.filter((_,i)=>i!==index));
  };
  
  useEffect(()=>{
    return () => {
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      if (videoPreview?.startsWith('blob:')) URL.revokeObjectURL(videoPreview);
      panoramaPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  },[imagePreviews, videoPreview, panoramaPreviews]);

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['video/mp4','video/webm','video/ogg'];
    if (!allowed.includes(file.type)) { 
      toast.error('Video upload failed: Only MP4, WebM, or OGG video formats are allowed.'); 
      return; 
    }
    if (file.size > 50*1024*1024) { 
      toast.error('Video upload failed: File size exceeds 50MB limit.'); 
      return; 
    }
    if (propertyData.video) URL.revokeObjectURL(videoPreview);
    setPropertyData(p => ({ ...p, video:file }));
    setVideoPreview(URL.createObjectURL(file));
  };
  
  const removeVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setPropertyData(p => ({ ...p, video:null }));
    setVideoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    const token = localStorage.getItem('user_token');
    if (!token) { toast.error('No token found. Please log in.'); navigate('/login'); return; }
    
    // Enhanced validation
    const requiredChecks = [];
    requiredChecks.push({ key: 'propertyType', ok: propertyData.propertyType && propertyData.propertyType.toString().trim() !== '', msg: "Please select a property type" });
    requiredChecks.push({ key: 'listingType', ok: propertyData.listingType && propertyData.listingType.toString().trim() !== '', msg: "Please select listing type" });
    requiredChecks.push({ key: 'address', ok: propertyData.address && propertyData.address.toString().trim() !== '', msg: "Make sure to provide the complete address of your property" });
    requiredChecks.push({ key: 'price', ok: propertyData.price && propertyData.price.toString().trim() !== '', msg: "Don't forget to set a price for your property" });
    requiredChecks.push({ key: 'barangay', ok: propertyData.barangay && propertyData.barangay.toString().trim() !== '', msg: "Please select which barangay your property is located in" });
    requiredChecks.push({ key: 'areaSqm', ok: propertyData.areaSqm !== undefined && propertyData.areaSqm !== '' && !isNaN(Number(propertyData.areaSqm)) && Number(propertyData.areaSqm) > 0, msg: "Please provide the floor area (in square meters)" });
    requiredChecks.push({ key: 'floorArea', ok: propertyData.floorArea !== undefined && propertyData.floorArea !== '' && !isNaN(Number(propertyData.floorArea)) && Number(propertyData.floorArea) > 0, msg: "Please provide a valid floor area greater than 0" });
    requiredChecks.push({ key: 'lotArea', ok: propertyData.lotArea !== undefined && propertyData.lotArea !== '' && !isNaN(Number(propertyData.lotArea)) && Number(propertyData.lotArea) > 0, msg: "Please provide a valid lot area greater than 0" });
    requiredChecks.push({ key: 'numberOfFloors', ok: propertyData.numberOfFloors !== undefined && propertyData.numberOfFloors !== '' && !isNaN(Number(propertyData.numberOfFloors)) && Number(propertyData.numberOfFloors) > 0, msg: "Please specify the number of floors (1-5)" });
    
    if (propertyData.listingType === 'For Rent') {
      requiredChecks.push({ key: 'occupancy', ok: propertyData.occupancy && propertyData.occupancy.toString().trim() !== '' && !isNaN(Number(propertyData.occupancy)) && Number(propertyData.occupancy) > 0, msg: "Please specify maximum occupancy (must be greater than 0)" });
    } else if (propertyData.listingType === 'For Sale') {
      requiredChecks.push({ key: 'propertyCondition', ok: propertyData.propertyCondition && propertyData.propertyCondition.toString().trim() !== '', msg: "Please select the property condition" });
    }
    
    for (const chk of requiredChecks) {
      if (!chk.ok) { toast.error(chk.msg); return; }
    }

    if (!propertyData.images.length) {
      toast.error('Please add at least one image');
      return;
    }
    
    if (propertyData.images.length > MAX_IMAGES) {
      toast.error(`Maximum of ${MAX_IMAGES} images allowed.`);
      return;
    }
    
    if (!propertyData.latitude || !propertyData.longitude || isNaN(Number(propertyData.latitude)) || isNaN(Number(propertyData.longitude))) {
      toast.error('Map location not found. Please check the address and barangay, then wait for the map preview to update before submitting.');
      return;
    }
    
    const parseLocaleNumber = (str) => {
      if (str === undefined || str === null || String(str).trim() === '') return NaN;
      const nfParts = new Intl.NumberFormat(navigator.language).formatToParts(12345.6);
      const group = nfParts.find(p => p.type === 'group')?.value || ',';
      const decimal = nfParts.find(p => p.type === 'decimal')?.value || '.';
      const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let normalized = String(str).replace(new RegExp(esc(group), 'g'), '');
      if (decimal !== '.') normalized = normalized.replace(new RegExp(esc(decimal)), '.');
      normalized = normalized.replace(/\s/g, '');
      normalized = normalized.replace(/[^0-9.\-]/g, '');
      const num = Number(normalized);
      return isNaN(num) ? NaN : num;
    };

    const priceNum = parseLocaleNumber(propertyData.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setPriceError('Please enter a valid price greater than 0');
      toast.error('Please enter a valid price greater than 0');
      return;
    } else {
      setPriceError('');
    }

    const areaSqmNum = parseLocaleNumber(propertyData.areaSqm);
    if (isNaN(areaSqmNum) || areaSqmNum <= 0) {
      toast.error('Please enter a valid floor area greater than 0');
      return;
    }

    // Parse and validate required numeric fields
    const floorAreaNum = parseLocaleNumber(propertyData.floorArea);
    if (isNaN(floorAreaNum) || floorAreaNum <= 0) {
      toast.error('Floor area must be a number greater than 0');
      return;
    }

    const lotAreaNum = parseLocaleNumber(propertyData.lotArea);
    if (isNaN(lotAreaNum) || lotAreaNum <= 0) {
      toast.error('Lot area must be a number greater than 0');
      return;
    }

    const floorsNumRaw = propertyData.numberOfFloors;
    const floorsNum = floorsNumRaw === '' || floorsNumRaw === null ? NaN : Number(floorsNumRaw);
    if (isNaN(floorsNum) || !Number.isInteger(floorsNum) || floorsNum < 1 || floorsNum > 5) {
      toast.error('Number of floors must be between 1 and 5');
      return;
    }

    if (propertyData.listingType === 'For Rent') {
      const occupancyNum = parseLocaleNumber(propertyData.occupancy);
      if (isNaN(occupancyNum) || occupancyNum <= 0 || occupancyNum > 5) {
        toast.error('Maximum occupancy must be between 1 and 5');
        return;
      }
    }

    // Validate dropdown fields
    if (propertyData.numberOfRooms && (propertyData.numberOfRooms < 1 || propertyData.numberOfRooms > 5)) {
      toast.error('Number of rooms must be between 1 and 5');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    
    // Handle landmarks - ensure it's always an array
    let landmarksArr = Array.isArray(propertyData.landmarks) ? [...propertyData.landmarks] : [];
    landmarksArr = landmarksArr.map(l => l.trim()).filter(l => l);
    const landmarksString = landmarksArr.join(', ');

    const listingType = propertyData.listingType;
    
    // Append all fields with proper field names
    Object.entries(propertyData).forEach(([k,v]) => {
      // Skip fields that shouldn't be sent based on listing type
      if (listingType === 'For Rent' && (k === 'propertyCondition' || k === 'marketHighlights')) return;
      if (listingType === 'For Sale' && (k === 'occupancy' || k === 'petFriendly' || k === 'allowedPets' || k === 'rules' || k === 'billsIncluded')) return;
      
      if (k==='images') {
        v.forEach(img => formData.append('images', img));
      } else if (k==='video') { 
        if (v) formData.append('video', v); 
      } else if (k==='landmarks') { 
        formData.append('landmarks', landmarksString); 
      } else if (k==='allowedPets') { 
        formData.append('allowedPets', Array.isArray(v) ? v.join(', ') : (v || '')); 
      } else if (k==='billsIncluded') { 
        formData.append('billsIncluded', Array.isArray(v) ? v.join(', ') : ''); 
      } else if (k==='marketHighlights') { 
        formData.append('marketHighlights', Array.isArray(v) ? v.join(', ') : ''); 
      } else if (k==='propertyCondition') { 
        formData.append('propertyCondition', v || ''); 
      } else if (k === 'price') {
        // Price will be handled separately with parsed value
      } else if (k === 'areaSqm') {
        // areaSqm will be handled separately with parsed value
      } else if (k === 'occupancy') {
        // occupancy will be handled separately with parsed value
      } else {
        formData.append(k, v);
      }
    });
    
    // Append parsed numeric values
    formData.append('price', priceNum.toString());
    formData.append('areaSqm', areaSqmNum.toString());
    if (propertyData.listingType === 'For Rent') {
      formData.append('occupancy', parseLocaleNumber(propertyData.occupancy).toString());
    }
    // Append required numeric fields
    formData.append('floorArea', floorAreaNum.toString());
    formData.append('lotArea', lotAreaNum.toString());
    formData.append('numberOfFloors', String(floorsNum));
    
    // Handle panoramic images with the correct field name
    if (panoramas.length) {
      if (panoramas.length > 5) {
        toast.error('Maximum of 5 panoramic images allowed');
        setIsSubmitting(false);
        return;
      }
      panoramas.forEach(file => formData.append('panorama360Images', file));
    }
    
    try {
      const res = await fetch(buildApi('/properties/add'), { 
        method:'POST', 
        headers:{ Authorization:`Bearer ${token}` }, 
        body:formData 
      });
      
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          data.errors.forEach(error => toast.error(error));
        } else if (data.detail) {
          toast.error(data.detail);
        } else if (data.error && typeof data.error === 'string') {
          toast.error(data.error);
        } else if (data.details && Array.isArray(data.details)) {
          data.details.forEach(error => toast.error(error));
        } else if (data.message) {
          toast.error(data.message);
        } else {
          toast.error('Failed to add property');
        }
        setIsSubmitting(false);
        return;
      }
      toast.success('Property added successfully');
      navigate('/my-properties');
    } catch (err) {
      console.error('Add property error:', err);
      toast.error(err.message || 'Error adding property');
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleLogout = () => {
    logout();
    localStorage.removeItem('user_token');
    toast.success('Logged out successfully');
    navigate('/');
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <div className="dashboard-container landlord-dashboard">
      <Sidebar handleLogout={handleLogout} activeItem="add-properties" />
      <div className="landlord-main add-property-main">
        <form onSubmit={handleSubmit} className="ll-card add-property-form" noValidate>
          <div className="form-header" style={{marginBottom:'32px'}}>
            <h2 className="form-title">Add New Property</h2>
            <p className="form-subtitle">Create a new listing. All fields marked with * are required.</p>
          </div>
          <div className="info-banner" style={{marginBottom:'32px', padding:'12px 18px', background:'#f7f7f7', borderRadius:'8px', fontSize:'15px'}}>
            <strong>Verification Reminder:</strong> Upload <strong>one clear government ID</strong> in the sidebar verification panel to unlock publishing. Review may take up to <strong>1 hour</strong>.
          </div>
          
          <div className={`ll-grid ${isMobile ? 'mobile-grid' : ''} ll-gap-md`}>
            <div className="ll-stack">
              <div className="form-group">
                <label className="required">Listing Type</label>
                <select className="ll-field" name="listingType" value={propertyData.listingType} onChange={handleInputChange} required>
                  <option value="">Select Listing Type</option>
                  <option value="For Rent">For Rent</option>
                  <option value="For Sale">For Sale</option>
                </select>
              </div>

              <div className="form-group">
                <label className="required">Property Type</label>
                <select className="ll-field" name="propertyType" value={propertyData.propertyType} onChange={handleInputChange} required>
                  <option value="">Select Property Type</option>
                  {PROPERTY_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                </select>
              </div>

              <div className="form-group full">
                <label>Bills Included</label>
                <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                  {['Water','Electricity'].map(b => (
                    <label key={b} style={{display:'flex',alignItems:'center',gap:8,fontWeight:500}}>
                      <input 
                        type="checkbox" 
                        name="billsIncluded" 
                        value={b} 
                        checked={Array.isArray(propertyData.billsIncluded) ? propertyData.billsIncluded.includes(b) : false} 
                        onChange={(e)=>{
                          const checked = e.target.checked;
                          setPropertyData(prev => {
                            const arr = Array.isArray(prev.billsIncluded) ? [...prev.billsIncluded] : [];
                            if (checked) {
                              if (!arr.includes(b)) arr.push(b);
                            } else {
                              const idx = arr.indexOf(b); if (idx>=0) arr.splice(idx,1);
                            }
                            return { ...prev, billsIncluded: arr };
                          });
                        }} 
                        disabled={propertyData.listingType === 'For Sale'} 
                      />
                      {b}
                    </label>
                  ))}
                </div>
                <div className="field-hint small">{propertyData.listingType === 'For Sale' ? 'Not applicable for sale listings' : 'Check bills that are included in the rent (optional)'}</div>
              </div>

              <div className="form-group">
                <label className={propertyData.listingType === 'For Sale' ? 'required' : ''}>Property Condition</label>
                <select 
                  className="ll-field" 
                  name="propertyCondition" 
                  value={propertyData.propertyCondition} 
                  onChange={handleInputChange} 
                  required={propertyData.listingType === 'For Sale'}
                  disabled={propertyData.listingType === 'For Rent'}
                >
                  <option value="">Select Property Condition</option>
                  <option value="Fully Furnished">Fully Furnished</option>
                  <option value="Semi-Furnished">Semi-Furnished</option>
                  <option value="Unfurnished">Unfurnished</option>
                  <option value="Brand New">Brand New</option>
                  <option value="Pre-owned / Resale">Pre-owned / Resale</option>
                </select>
                {propertyData.listingType === 'For Rent' && <div className="field-hint small" style={{color:'#666'}}>Disabled for For Rent listings</div>}
              </div>

              <div className="form-group full">
                <label>Market Highlights</label>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {['Ready for Occupancy (RFO)','Pre-selling (under construction)','Negotiable Price','Clean Title','Inclusive of Taxes and Fees','Good Investment Opportunity','Rush Sale / Below Market Value'].map(mh => (
                    <label key={mh} style={{display:'flex',alignItems:'center',gap:8,fontWeight:500}}>
                      <input 
                        type="checkbox" 
                        name="marketHighlights" 
                        value={mh} 
                        checked={Array.isArray(propertyData.marketHighlights) ? propertyData.marketHighlights.includes(mh) : false} 
                        onChange={(e)=>{
                          const checked = e.target.checked;
                          setPropertyData(prev => {
                            const arr = Array.isArray(prev.marketHighlights) ? [...prev.marketHighlights] : [];
                            if (checked) {
                              if (!arr.includes(mh)) arr.push(mh);
                            } else {
                              const idx = arr.indexOf(mh); if (idx>=0) arr.splice(idx,1);
                            }
                            return { ...prev, marketHighlights: arr };
                          });
                        }} 
                        disabled={propertyData.listingType === 'For Rent'} 
                      />
                      {mh}
                    </label>
                  ))}
                </div>
                <div className="field-hint small">Optional - check any market highlights that apply.</div>
              </div>

              <div className="form-group">
                <label className="required">Barangay</label>
                <select className="ll-field" name="barangay" value={propertyData.barangay} onChange={handleInputChange} required>
                  <option value="">Select Barangay</option>
                  {barangayList.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="required">Address</label>
                <input className="ll-field" name="address" value={propertyData.address} onChange={handleInputChange} required placeholder="E.g., Heroesville 1, Blk 15, Lot 8" />
                <div className="field-hint small">Tip: Include commas to separate street, block, lot (e.g., "Street, Blk, Lot") for better geocoding.</div>
              </div>
              
              <div className="form-group">
                <label className="required">Price (₱)</label>
                <input
                  className="ll-field"
                  type="text"
                  name="price"
                  value={propertyData.price}
                  onChange={handleInputChange}
                  onFocus={() => { setPriceFocused(true); setPriceError(''); }}
                  onBlur={() => {
                    setPriceFocused(false);
                    const num = (function parseLocaleNumberLocal(str){
                      if (str === undefined || str === null || String(str).trim() === '') return NaN;
                      const nfParts = new Intl.NumberFormat(navigator.language).formatToParts(12345.6);
                      const group = nfParts.find(p => p.type === 'group')?.value || ',';
                      const decimal = nfParts.find(p => p.type === 'decimal')?.value || '.';
                      const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                      let normalized = String(str).replace(new RegExp(esc(group), 'g'), '');
                      if (decimal !== '.') normalized = normalized.replace(new RegExp(esc(decimal)), '.');
                      normalized = normalized.replace(/\s/g, '');
                      normalized = normalized.replace(/[^0-9.\-]/g, '');
                      const num = Number(normalized);
                      return isNaN(num) ? NaN : num;
                    })(propertyData.price);
                    if (isNaN(num) || num <= 0) {
                      setPriceError('Please enter a valid price greater than 0');
                    } else {
                      try {
                        const formatted = new Intl.NumberFormat(navigator.language, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
                        setPropertyData(prev => ({ ...prev, price: String(formatted) }));
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
                <div className="field-hint small">Use decimal format for price (e.g., 1500.00)</div>
              </div>
              
              <div className="form-group">
                <label>Number of Rooms</label>
                <select className="ll-field" name="numberOfRooms" value={propertyData.numberOfRooms} onChange={handleInputChange}>
                  <option value="">Select number</option>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Room' : 'Rooms'}</option>)}
                </select>
                <div className="field-hint small">Choose number of rooms (optional)</div>
              </div>
              
              <div className="form-group">
                <label>Availability Status</label>
                <select className="ll-field" name="availabilityStatus" value={propertyData.availabilityStatus} onChange={handleInputChange}>
                  <option value="Available">Available</option>
                  <option value="Not Available">Not Available</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="required">Property Size (sqm)</label>
                <input className="ll-field" type="number" min={0.1} step={0.1} name="areaSqm" value={propertyData.areaSqm} onChange={handleInputChange} placeholder="e.g. 45" required />
                <div className="field-hint small">Enter the floor area in square meters (must be greater than 0)</div>
              </div>
              
              <div className="form-group">
                <label className="required">Floor Area (sqm)</label>
                <input className="ll-field" type="number" min={0.1} step={0.1} name="floorArea" value={propertyData.floorArea} onChange={handleInputChange} placeholder="e.g. 45 or 45.5" required />
                <div className="field-hint small">Enter total usable floor area in square meters (numbers only; decimals allowed). Required.</div>
              </div>

              <div className="form-group">
                <label className="required">Lot Area (sqm)</label>
                <input className="ll-field" type="number" min={0.1} step={0.1} name="lotArea" value={propertyData.lotArea} onChange={handleInputChange} placeholder="e.g. 100" required />
                <div className="field-hint small">Enter lot size in square meters (numbers only; decimals allowed). Required.</div>
              </div>

              <div className="form-group">
                <label className="required">Number of Floors</label>
                <select className="ll-field" name="numberOfFloors" value={propertyData.numberOfFloors} onChange={handleInputChange} required>
                  <option value="">Select number</option>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Floor' : 'Floors'}</option>)}
                </select>
                <div className="field-hint small">Select number of floors (1–5). Required.</div>
              </div>
              
              <div className="form-group">
                <label className={propertyData.listingType === 'For Rent' ? 'required' : ''}>Max Occupancy</label>
                <select 
                  className="ll-field" 
                  name="occupancy" 
                  value={propertyData.occupancy} 
                  onChange={handleInputChange} 
                  required={propertyData.listingType === 'For Rent'}
                  disabled={propertyData.listingType === 'For Sale'}
                >
                  <option value="">Select number</option>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Person' : 'People'}</option>)}
                </select>
                {propertyData.listingType === 'For Sale' && <div className="field-hint small" style={{color:'#666'}}>Disabled for For Sale listings</div>}
              </div>
              
              <div className="form-group toggle-field">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    name="parking" 
                    checked={propertyData.parking} 
                    onChange={handleInputChange} 
                  /> 
                  Parking Available
                </label>
              </div>
              
              <div className="form-group toggle-field">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    name="petFriendly" 
                    checked={propertyData.petFriendly} 
                    onChange={handleInputChange} 
                    disabled={propertyData.listingType === 'For Sale'} 
                  /> 
                  Pet Friendly
                </label>
                {propertyData.petFriendly && propertyData.listingType !== 'For Sale' && (
                  <div className="ll-field mt-6 pet-types" style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    {['Cat','Dog','Bird','Fish'].map(p => (
                      <label key={p} style={{display:'flex',alignItems:'center',gap:8,fontWeight:500}}>
                        <input 
                          type="checkbox" 
                          name="allowedPets" 
                          value={p} 
                          checked={Array.isArray(propertyData.allowedPets) ? propertyData.allowedPets.includes(p) : false} 
                          onChange={(e)=>{
                            const checked = e.target.checked;
                            setPropertyData(prev => {
                              const arr = Array.isArray(prev.allowedPets) ? [...prev.allowedPets] : [];
                              if (checked) {
                                if (!arr.includes(p)) arr.push(p);
                              } else {
                                const idx = arr.indexOf(p); if (idx>=0) arr.splice(idx,1);
                              }
                              return { ...prev, allowedPets: arr };
                            });
                          }} 
                        />
                        {p}
                      </label>
                    ))}
                  </div>
                )}
                {propertyData.listingType === 'For Sale' && <div className="field-hint small" style={{color:'#666'}}>Pets not applicable for sale listings</div>}
              </div>
              
              <div className="form-group full">
                <label>Nearby Landmarks</label>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isMobile ? '10px' : '12px',
                  alignItems: 'stretch',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                    gap: '8px 16px',
                  }}>
                    {LANDMARKS.map(l => (
                      <label key={l} style={{display:'flex',alignItems:'center',gap:'8px',fontWeight:400,fontSize:'0.98em'}}>
                        <input
                          type="checkbox"
                          name="landmarks"
                          value={l}
                          checked={Array.isArray(propertyData.landmarks) ? propertyData.landmarks.includes(l) : false}
                          onChange={e => {
                            const checked = e.target.checked;
                            setPropertyData(prev => {
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
              
              <div className="form-group full">
                <label>House Rules</label>
                <textarea className="ll-field" name="rules" value={propertyData.rules} onChange={handleInputChange} placeholder="No loud noises after 10 PM, No smoking inside" rows={isMobile ? 2 : 3} disabled={propertyData.listingType === 'For Sale'} />
                {propertyData.listingType === 'For Sale' && <div className="field-hint small" style={{color:'#666'}}>Not used for sale listings</div>}
              </div>
              
              <div className={`form-row ${isMobile ? 'mobile-column' : ''}`}>
                <div className="form-group">
                  <label htmlFor="latitude">Latitude (auto-filled)</label>
                  <input id="latitude" name="latitude" type="number" step="any" value={propertyData.latitude} readOnly style={{background:'#f5f5f5'}} placeholder="Auto-filled" />
                </div>
                <div className="form-group">
                  <label htmlFor="longitude">Longitude (auto-filled)</label>
                  <input id="longitude" name="longitude" type="number" step="any" value={propertyData.longitude} readOnly style={{background:'#f5f5f5'}} placeholder="Auto-filled" />
                </div>
              </div>
            </div>
            
            <div className="ll-stack">
              <div className="images-section" style={{marginTop:'0'}}>
                <h3 className="section-title">Images <span style={{color:'red', marginLeft:'4px'}}>*</span> <span style={{fontWeight:400, fontSize:'0.7rem'}}>({propertyData.images.length}/8 total)</span></h3>
                <p className="field-hint">Add up to 8 images (JPG/PNG/WebP, max 10MB each).</p>
                <div className="current-images-grid">
                  {imagePreviews.length ? imagePreviews.map((url, i) => (
                    <div key={i} className="image-chip">
                      <img src={url} alt={`Property ${i}`} />
                      <button type="button" aria-label="Remove image" onClick={() => removeImage(i)}>&times;</button>
                    </div>
                  )) : <div className="placeholder">No images</div>}
                </div>
                <div className="new-upload-block">
                  <label className="file-drop-modern">
                    <input type="file" multiple accept="image/*" onChange={handleImageChange} />
                    <span>Add Images</span>
                  </label>
                </div>
              </div>

              <div className="panorama-section" style={{marginTop:'32px'}}>
                <h3 className="section-title">360° Panoramic Images</h3>
                <p className="field-hint">Optional: Add one or more panoramic 360° images (JPG/PNG/WebP, max 10MB each, equirectangular projection).</p>
                <label className="file-drop-modern">
                  <input id="panorama-input" type="file" accept="image/*" multiple style={{display:'none'}} onChange={handlePanoramaChange} />
                  <span onClick={()=>document.getElementById('panorama-input').click()}>Add 360° Panoramic Images</span>
                </label>
                {panoramaPreviews.length > 0 && (
                  <div className="panorama-previews-grid">
                    {panoramaPreviews.map((url, idx) => (
                      <div key={idx} className="panorama-card">
                        <div className="panorama-preview-container">
                          <PhotoDomeViewer imageUrl={url} mode="MONOSCOPIC" />
                        </div>
                        <button type="button" className="ll-btn tiny danger remove-panorama" onClick={()=>removePanorama(idx)}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="video-section" style={{marginTop:'32px'}}>
                <h3 className="section-title">Property Video <span style={{fontWeight:400, fontSize:'0.7rem'}}>{propertyData.video ? 'selected' : 'none'}</span></h3>
                <p className="field-hint">Optional walkthrough clip (MP4/WebM/OGG, up to 50MB). Uploading a new one replaces the existing video.</p>
                {!videoPreview && !propertyData.video && (
                  <label className="file-drop-modern">
                    <input type="file" accept="video/mp4,video/webm,video/ogg" onChange={handleVideoChange} />
                    <span>Select Video</span>
                  </label>
                )}
                {(videoPreview || propertyData.video) && (
                  <div className="video-preview-wrapper">
                    <video src={videoPreview} controls preload="none" className="video-preview" />
                    <div className="video-actions">
                      <button type="button" className="ll-btn tiny danger" onClick={removeVideo}>Remove Video</button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="ll-card map-preview-section" style={{marginTop:'32px', padding:'24px', borderRadius:'12px', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', background:'#fafafa'}}>
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px', marginBottom:'18px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <h3 style={{margin: 0}}>Map Preview (SJDM only)</h3>
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
                    <div style={{fontWeight: 'bold', marginBottom: '8px'}}>📍 How to set your property's location:</div>
                    <ol style={{margin: '0', paddingLeft: '20px'}}>
                      <li>Enter your complete address and select barangay for automatic pin placement</li>
                      <li>Fine-tune the location by either:
                        <ul style={{marginTop: '4px'}}>
                          <li>Clicking anywhere on the map to move the pin</li>
                          <li>Dragging the blue pin marker to the exact location</li>
                        </ul>
                      </li>
                      <li>Zoom in/out using the +/- buttons or mouse wheel for better accuracy</li>
                    </ol>
                  </div>
                </div>
                <div style={{height: isMobile ? '220px' : '320px', width:'100%', border:'1px solid #ccc', borderRadius:'8px', overflow:'hidden'}}>
                  <MapContainer center={mapCenter} zoom={mapZoom} style={{height:'100%', width:'100%'}} scrollWheelZoom={true}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                    <LocationSelector />
                    {propertyData.latitude && propertyData.longitude && (
                      <MapCenterSync lat={propertyData.latitude} lng={propertyData.longitude} />
                    )}
                    {propertyData.latitude && propertyData.longitude && (
                      <Marker
                        position={[parseFloat(propertyData.latitude), parseFloat(propertyData.longitude)]}
                        draggable={true}
                        eventHandlers={{
                          dragstart: () => {
                            toast.info('Dragging pin to adjust location...', {autoClose: 2000});
                          },
                          dragend: (e) => {
                            const latlng = e.target.getLatLng();
                            setPropertyData(prev => ({ ...prev, latitude: latlng.lat, longitude: latlng.lng, manualPin: true }));
                            toast.success('Location updated! ✨', {autoClose: 2000});
                          }
                        }}
                      >
                        <Popup>
                          <div style={{fontSize: '0.9em', padding: '4px'}}>
                            <div style={{fontWeight: 'bold', marginBottom: '4px'}}>{propertyData.propertyType || 'New Property'}</div>
                            <div style={{color: '#666', marginBottom: '4px'}}>{propertyData.address}</div>
                            {propertyData.price && <div style={{color: '#2c5282', fontWeight: 'bold', marginBottom: '4px'}}>₱{propertyData.price}</div>}
                            <div style={{fontSize: '0.8em', color: '#666', marginTop: '8px'}}>
                              {propertyData.manualPin ? '✏️ Manually placed' : '🎯 Auto-located'}<br/>
                              Drag pin or click map to adjust
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>
                <div style={{marginTop:'8px', fontSize:'0.95em', color:'#555'}}>
                  Tip: You can manually set the pin by clicking on the map or dragging the marker. Zoom in/out and pan to adjust view.<br />
                  {propertyData.manualPin && (
                    <button type="button" className="ll-btn tiny outline" style={{marginTop:'8px'}} onClick={() => {
                      setPropertyData(prev => ({ ...prev, latitude:'', longitude:'', manualPin: false }));
                      toast.info('Pin reset. Enter address and barangay to auto-fill location.');
                    }}>Reset Pin to Auto</button>
                  )}
                </div>
              </div>
              
              <div className="form-actions" style={{marginTop:'32px', display:'flex', gap:'16px', justifyContent:'flex-end'}}>
                <button type="button" className="ll-btn outline" onClick={()=>navigate(-1)}>Cancel</button>
                <button type="submit" className="ll-btn primary" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Property'}</button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProperties;