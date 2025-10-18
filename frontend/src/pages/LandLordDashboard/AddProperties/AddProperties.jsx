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
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const barangayList = [
    'Assumption','Bagong Buhay I','Bagong Buhay II','Bagong Buhay III','Ciudad Real','Citrus','Dulong Bayan','Fatima I','Fatima II','Fatima III','Fatima IV','Fatima V','Francisco Homes – Guijo','Francisco Homes – Mulawin','Francisco Homes – Narra','Francisco Homes – Yakal','Gaya-gaya','Graceville','Gumaok Central','Gumaok East','Gumaok West','Kaybanban','Kaypian','Lawang Pare','Maharlika','Minuyan I','Minuyan II','Minuyan III','Minuyan IV','Minuyan V','Minuyan Proper','Muzon East','Muzon Proper','Muzon South','Muzon West','Paradise III','Poblacion','Poblacion 1','San Isidro','San Manuel','San Martin De Porres','San Martin I','San Martin II','San Martin III','San Martin IV','San Pedro','San Rafael I','San Rafael II','San Rafael III','San Rafael IV','San Rafael V','San Roque','Sapang Palay Proper','Sta. Cruz I','Sta. Cruz II','Sta. Cruz III','Sta. Cruz IV','Sta. Cruz V','Sto. Cristo','Sto. Nino I','Sto. Nino II','Tungkong Mangga'
];
// Property types to choose from (replaces previous 'category' and free-text title)
const PROPERTY_TYPES = ['House','House and Lot','Apartment','Condominium','Townhouse','Dormitory','Bedspace','Studio Unit','Lot','Land','Commercial Space','Office Space','Warehouse','Building','Bungalow','Duplex','Triplex','Inner Lot','Corner Lot'];

const LANDMARKS = [
          "park",
          "church",
          "public market",
          "major highway",
          "public transport stops",
          "banks and atms",
          "restaurant/food centers",
          "convenience store/supermarket",
          "school/university",
          "hospital/health care"
];

const AddProperties = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Panoramic image state
  const [panorama, setPanorama] = useState(null);
  const [panoramaPreview, setPanoramaPreview] = useState(null);

  // Handle panoramic image upload
  const handlePanoramaChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validType = file.type.startsWith('image/');
    const sizeOk = file.size <= 10*1024*1024;
    if (!validType) { 
      toast.error('360° Panorama upload failed: Only image files (JPG, PNG, WebP) are allowed.'); 
      return; 
    }
    if (!sizeOk) { 
      toast.error('360° Panorama upload failed: Image size exceeds 10MB limit. Please reduce the image resolution or compress the file.'); 
      return; 
    }
    if (panoramaPreview) URL.revokeObjectURL(panoramaPreview);
    setPanorama(file);
    setPanoramaPreview(URL.createObjectURL(file));
  };
  
  const removePanorama = () => {
    if (panoramaPreview) URL.revokeObjectURL(panoramaPreview);
    setPanorama(null);
    setPanoramaPreview(null);
  };
  
  const SJDM_CENTER = [14.8136, 121.0450];
  const SJDM_ZOOM = 13;
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [propertyData, setPropertyData] = useState({
  title:'', description:'', address:'', price:'', barangay:'', propertyType: 'For Rent', petFriendly:false, allowedPets:'', occupancy:'', parking:false, rules:'', landmarks:'', numberOfRooms:'', areaSqm:'', images:[], video:null, latitude:'', longitude:'', availabilityStatus: 'Available'
  });
  // Price input UI state
  const [priceFocused, setPriceFocused] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [imagePreviews, setImagePreviews] = useState([]);
  const [videoPreview, setVideoPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const MAX_IMAGES = 8;

  // Geocode address+barangay to get lat/lng
  const geocodeAddress = async (address, barangay) => {
    if (!address || !barangay) return;
    const query = encodeURIComponent(`${address}, ${barangay}, San Jose del Monte, Bulacan, Philippines`);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
      const data = await res.json();
      if (data && data.length > 0) {
        return { lat: data[0].lat, lon: data[0].lon };
      }
    } catch (err) { /* ignore */ }
    return null;
  };

  // Manual pin placement handler
  function LocationSelector() {
    useMapEvents({
      click(e) {
        setPropertyData(prev => ({ ...prev, latitude: e.latlng.lat, longitude: e.latlng.lng, manualPin: true }));
        toast.info('Pin location set!');
      }
    });
    return null;
  }

  const handleInputChange = async (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = value;
    // Special handling for price: allow decimals while typing, keep as string
    if (name === 'price') {
      // Determine locale group/decimal separators
      const parts = new Intl.NumberFormat(navigator.language).formatToParts(12345.6);
      const group = parts.find(p => p.type === 'group')?.value || ',';
      const decimal = parts.find(p => p.type === 'decimal')?.value || '.';
      // escape for regex
      const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const allowedRegex = new RegExp(`[^0-9${esc(group)}${esc(decimal)}]`, 'g');
      let sanitized = (value || '').replace(allowedRegex, '');
      // If multiple decimals, keep first and remove others
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
    setPropertyData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : newValue }));

    // If address or barangay changes, geocode
    if (name === 'address' || name === 'barangay') {
      const nextAddress = name === 'address' ? value : propertyData.address;
      const nextBarangay = name === 'barangay' ? value : propertyData.barangay;
      if (nextAddress && nextBarangay) {
        const coords = await geocodeAddress(nextAddress, nextBarangay);
        if (coords) {
          setPropertyData(prev => ({ ...prev, latitude: coords.lat, longitude: coords.lon }));
        }
      }
    }
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
  
  // Cleanup blob URLs on unmount
  useEffect(()=>{
    return () => {
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      if (videoPreview?.startsWith('blob:')) URL.revokeObjectURL(videoPreview);
      if (panoramaPreview) URL.revokeObjectURL(panoramaPreview);
    };
  },[imagePreviews, videoPreview, panoramaPreview]);

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['video/mp4','video/webm','video/ogg'];
    if (!allowed.includes(file.type)) { 
      toast.error('Video upload failed: Only MP4, WebM, or OGG video formats are allowed.'); 
      return; 
    }
    if (file.size > 50*1024*1024) { 
      toast.error('Video upload failed: File size exceeds 50MB limit. Please compress your video or choose a smaller file.'); 
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
  // Specific client-side required field checks to provide friendly messages
  const requiredChecks = [
    { key: 'title', ok: propertyData.title && propertyData.title.toString().trim() !== '', msg: "Please select a property type" },
    { key: 'description', ok: propertyData.description && propertyData.description.toString().trim() !== '', msg: "Please add a description to help people understand your property better" },
    { key: 'address', ok: propertyData.address && propertyData.address.toString().trim() !== '', msg: "Make sure to provide the complete address of your property" },
    { key: 'price', ok: propertyData.price && propertyData.price.toString().trim() !== '', msg: "Don't forget to set a price for your property" },
  { key: 'barangay', ok: propertyData.barangay && propertyData.barangay.toString().trim() !== '', msg: "Please select which barangay your property is located in" },
    { key: 'areaSqm', ok: propertyData.areaSqm !== undefined && propertyData.areaSqm !== '' && !isNaN(Number(propertyData.areaSqm)) && Number(propertyData.areaSqm) > 0, msg: "Please provide the floor area (in square meters)" },
    { key: 'occupancy', ok: propertyData.occupancy && propertyData.occupancy.toString().trim() !== '', msg: "Please specify maximum occupancy" }
  ];
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
  // Validate geocoding
  if (!propertyData.latitude || !propertyData.longitude || isNaN(Number(propertyData.latitude)) || isNaN(Number(propertyData.longitude))) {
    toast.error('Map location not found. Please check the address and barangay, then wait for the map preview to update before submitting.');
    return;
  }
  // Validate price before submit
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
  if (isNaN(priceNum) || priceNum < 0) {
    setPriceError('Please enter a valid price');
    return;
  } else {
    setPriceError('');
  }

  setIsSubmitting(true);
  const formData = new FormData();
  // Combine landmarks array and customLandmark into a single string
  let landmarksArr = Array.isArray(propertyData.landmarks) ? [...propertyData.landmarks] : (propertyData.landmarks ? [propertyData.landmarks] : []);
  // Always save as lowercase and trimmed
  landmarksArr = landmarksArr.map(l => l.trim().toLowerCase()).filter(l => l);
  if (propertyData.customLandmark && propertyData.customLandmark.trim()) {
    landmarksArr.push(propertyData.customLandmark.trim().toLowerCase());
  }
  const landmarksString = landmarksArr.join(', ');

  Object.entries(propertyData).forEach(([k,v]) => {
    if (k==='images') v.forEach(img => formData.append('images', img));
    else if (k==='video') { if (v) formData.append('video', v); }
    else if (k==='landmarks') { formData.append('landmarks', landmarksString); }
    else if (k==='customLandmark') { /* skip, already merged above */ }
    else formData.append(k,v);
  });
  // Add panorama if exists
  if (panorama) {
    formData.append('panorama360', panorama);
  }
  try {
    // Convert price to a numeric value before sending (use locale-aware parser)
    const parseForSend = (val) => {
      const num = parseLocaleNumber(val);
      return isNaN(num) ? '' : num;
    };
    formData.set('price', parseForSend(propertyData.price));

    const res = await fetch(buildApi('/properties/add'), { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:formData });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) {
      // Show detailed validation errors from backend
      if (data.errors && Array.isArray(data.errors)) {
        data.errors.forEach(error => toast.error(error));
      } else if (data.error && typeof data.error === 'string') {
        toast.error(data.error);
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
              {/* Property Info Section */}
              <div className="form-group">
                <label className="required">Listing Type</label>
                <select className="ll-field" name="propertyType" value={propertyData.propertyType} onChange={handleInputChange} required>
                  <option value="For Rent">For Rent</option>
                  <option value="For Sale">For Sale</option>
                </select>
              </div>

              <div className="form-group">
                <label className="required">Property Type</label>
                <select className="ll-field" name="title" value={propertyData.title} onChange={handleInputChange} required>
                  <option value="">Select Property Type</option>
                  {PROPERTY_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                </select>
              </div>

              <div className="form-group full">
                <label className="required">Description</label>
                <textarea className="ll-field" name="description" value={propertyData.description} onChange={handleInputChange} rows={isMobile ? 3 : 5} maxLength={500} required />
                <div className="field-hint small">{propertyData.description.length}/500</div>
              </div>

              <div className="form-group">
                <label className="required">Address</label>
                <input className="ll-field" name="address" value={propertyData.address} onChange={handleInputChange} required placeholder="Street, Building, etc." />
              </div>

              <div className="form-group">
                <label className="required">Barangay</label>
                <select className="ll-field" name="barangay" value={propertyData.barangay} onChange={handleInputChange} required>
                  <option value="">Select Barangay</option>
                  {barangayList.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              
              <div className="form-group">
                <label className="required">Price (₱)</label>
                <input
                  className="ll-field"
                  type="text"
                  name="price"
                  pattern="^\d+(\.\d{1,2})?$"
                  value={propertyData.price}
                  onChange={handleInputChange}
                  onFocus={() => { setPriceFocused(true); setPriceError(''); }}
                  onBlur={() => {
                    setPriceFocused(false);
                    // format value using locale
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
                    if (isNaN(num)) {
                      setPriceError('Please enter a valid price');
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
                <input className="ll-field" type="number" min={0} name="numberOfRooms" value={propertyData.numberOfRooms} onChange={handleInputChange} placeholder="e.g. 2" />
              </div>
              
              <div className="form-group">
                <label>Availability Status</label>
                <select className="ll-field" name="availabilityStatus" value={propertyData.availabilityStatus} onChange={handleInputChange}>
                  <option value="Available">Available</option>
                  <option value="Not Available">Not Available</option>
                </select>
              </div>
              
              {/* availableUnits removed - availability is derived from totalUnits and server-side approvals */}
              
              <div className="form-group">
                <label className="required">Property Size (sqm)</label>
                <input className="ll-field" type="number" min={0} step={0.1} name="areaSqm" value={propertyData.areaSqm} onChange={handleInputChange} placeholder="e.g. 45" required />
                <div className="field-hint small">Enter the floor area in square meters (must be greater than 0)</div>
              </div>
              
              <div className="form-group">
                <label className="required">Max Occupancy</label>
                <input className="ll-field" type="number" min={1} name="occupancy" value={propertyData.occupancy} onChange={handleInputChange} required />
              </div>
              
              <div className="form-group toggle-field">
                <label className="checkbox-label"><input type="checkbox" name="parking" checked={propertyData.parking} onChange={handleInputChange} /> Parking Available</label>
              </div>
              
              <div className="form-group toggle-field">
                <label className="checkbox-label"><input type="checkbox" name="petFriendly" checked={propertyData.petFriendly} onChange={handleInputChange} /> Pet Friendly</label>
                {propertyData.petFriendly && <input className="ll-field mt-6" name="allowedPets" value={propertyData.allowedPets} placeholder="Allowed pets (e.g. Cats, Dogs)" onChange={handleInputChange} />}
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
              
              <div className="form-group full">
                <label>House Rules</label>
                <textarea className="ll-field" name="rules" value={propertyData.rules} onChange={handleInputChange} placeholder="No loud noises after 10 PM, No smoking inside" rows={isMobile ? 2 : 3} />
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
             {/* Images Section */}
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

              {/* 360° Panoramic Image Section - FIXED */}
              <div className="panorama-section" style={{marginTop:'32px'}}>
                <h3 className="section-title">360° Panoramic Image</h3>
                <p className="field-hint">Optional: Add a panoramic 360° image (JPG/PNG/WebP, max 10MB, equirectangular projection).</p>
                {panoramaPreview ? (
                  <div style={{marginBottom:'12px'}}>
                    <div className="panorama-preview-container">
                      <PhotoDomeViewer imageUrl={panoramaPreview} mode="MONOSCOPIC" />
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
              
              {/* Video Section */}
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
              
              {/* Map Preview Section */}
              <div className="ll-card map-preview-section" style={{marginTop:'32px', padding:'24px', borderRadius:'12px', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', background:'#fafafa'}}>
                <h3 style={{marginBottom:'18px'}}>Map Preview (SJDM only)</h3>
                <div style={{height: isMobile ? '220px' : '320px', width:'100%', border:'1px solid #ccc', borderRadius:'8px', overflow:'hidden'}}>
                  <MapContainer center={propertyData.latitude && propertyData.longitude ? [parseFloat(propertyData.latitude), parseFloat(propertyData.longitude)] : SJDM_CENTER} zoom={SJDM_ZOOM} style={{height:'100%', width:'100%'}} scrollWheelZoom={true}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                    <LocationSelector />
                    {propertyData.latitude && propertyData.longitude && (
                      <Marker
                        position={[parseFloat(propertyData.latitude), parseFloat(propertyData.longitude)]}
                        draggable={true}
                        eventHandlers={{
                          dragend: (e) => {
                            const latlng = e.target.getLatLng();
                            setPropertyData(prev => ({ ...prev, latitude: latlng.lat, longitude: latlng.lng, manualPin: true }));
                            toast.info('Pin moved!');
                          }
                        }}
                      >
                        <Popup>
                          <strong>{propertyData.title || 'New Property'}</strong><br />
                          {propertyData.address}<br />
                          {propertyData.price ? `₱${propertyData.price}` : ''}
                          <br /><span style={{fontSize:'0.8em'}}>Manual pin: Click map or drag marker to set location</span>
                        </Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>
                <div style={{marginTop:'8px', fontSize:'0.95em', color:'#555'}}>
                  Tip: You can manually set the pin by clicking on the map or dragging the marker. Zoom in/out and pan to adjust view.<br />
                  {propertyData.manualPin && (
                    <button type="button" className="ll-btn tiny outline" style={{marginTop:'8px'}} onClick={() => {
                      // Reset pin to auto-geocoded value
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