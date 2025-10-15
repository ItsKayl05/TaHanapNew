import React, { useState, useEffect, useCallback, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { buildApi } from '../../services/apiConfig';
import { FaSearch, FaDog, FaParking, FaBed, FaMapMarkerAlt, FaTag, FaHome, FaHeart, FaRegHeart, FaDoorOpen, FaRulerCombined } from 'react-icons/fa';
import FavoriteService from '../../services/favorite/FavoriteService';
import { getToken } from '../../services/auth/getToken';
import './PropertyListingPage.css';

const landmarkOptions = [
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

const barangayList = [
    'Assumption','Bagong Buhay I','Bagong Buhay II','Bagong Buhay III','Ciudad Real','Citrus','Dulong Bayan','Fatima I','Fatima II','Fatima III','Fatima IV','Fatima V','Francisco Homes – Guijo','Francisco Homes – Mulawin','Francisco Homes – Narra','Francisco Homes – Yakal','Gaya-gaya','Graceville','Gumaok Central','Gumaok East','Gumaok West','Kaybanban','Kaypian','Lawang Pare','Maharlika','Minuyan I','Minuyan II','Minuyan III','Minuyan IV','Minuyan V','Minuyan Proper','Muzon East','Muzon Proper','Muzon South','Muzon West','Paradise III','Poblacion','Poblacion 1','San Isidro','San Manuel','San Martin De Porres','San Martin I','San Martin II','San Martin III','San Martin IV','San Pedro','San Rafael I','San Rafael II','San Rafael III','San Rafael IV','San Rafael V','San Roque','Sapang Palay Proper','Sta. Cruz I','Sta. Cruz II','Sta. Cruz III','Sta. Cruz IV','Sta. Cruz V','Sto. Cristo','Sto. Nino I','Sto. Nino II','Tungkong Mangga'
];
const categories = ['Apartment','Dorm','House','Studio'];

const PropertyListingPage = () => {
    const navigate = useNavigate();
    const { userRole } = useContext(AuthContext);
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        searchTerm:'', category:'', location:'', minPrice:'', maxPrice:'', petFriendly:false, occupancy:'', parking:false, landmarks:[], minRooms:'', maxRooms:'', minArea:'', maxArea:'', hasVideo:false, customLandmark:'', propertyType:''
    });
    const [sortOption, setSortOption] = useState('newest');
    const [showFilters, setShowFilters] = useState(false);
    const [favorites, setFavorites] = useState([]);

    const fetchProperties = useCallback(async ()=>{
        try {
            const res = await fetch(buildApi('/properties'));
            if(!res.ok) throw new Error('Failed to fetch properties');
            const data = await res.json();
            setProperties(data);
        } catch(err){
            toast.error('⚠️ Unable to load properties');
        } finally { setLoading(false); }
    },[]);

    const formatCreatedAt = (iso)=>{
        if(!iso) return '';
        const d = new Date(iso);
        if(isNaN(d)) return '';
        const now = Date.now();
        const diffMs = now - d.getTime();
        const diffSec = Math.floor(diffMs/1000);
        const diffMin = Math.floor(diffSec/60);
        const diffHr = Math.floor(diffMin/60);
        const diffDay = Math.floor(diffHr/24);
        if(diffSec < 60) return 'Just now';
        if(diffMin < 60) return diffMin + 'm ago';
        if(diffHr < 24) return diffHr + 'h ago';
        if(diffDay < 7) return diffDay + 'd ago';
        return d.toLocaleDateString('en-PH',{ year:'numeric', month:'short', day:'numeric'});
    };

    useEffect(()=>{
        const fetchFavorites = async ()=>{
            try { const token = getToken(); if(!token) return; const r= await FavoriteService.getFavorites(token); setFavorites(r.data.favorites.map(f=>f.property._id)); } catch(err){ if(err.response && err.response.status!==401) toast.error('Error fetching favorites'); }
        };
        fetchFavorites();
        fetchProperties();
    },[fetchProperties]);

    const updateFilter = (k,v)=> setFilters(p=>({...p,[k]:v}));
    const resetFilters = ()=> setFilters({ searchTerm:'', category:'', location:'', minPrice:'', maxPrice:'', petFriendly:false, occupancy:'', parking:false, landmarks:[], minRooms:'', maxRooms:'', minArea:'', maxArea:'', hasVideo:false, customLandmark:'' });

    const matches = ({ title='', category='', barangay='', price=0, petFriendly, occupancy=0, parking, landmarks='', numberOfRooms=0, areaSqm=0, video='', propertyType='For Rent' }) => {
        const s = filters.searchTerm.toLowerCase().trim();
        // Split property landmarks string into array
        const propertyLandmarksArr = typeof landmarks === 'string' ? landmarks.split(',').map(l => l.trim().toLowerCase()).filter(l => l) : [];
        // Check if any selected filter landmark is included in propertyLandmarksArr
        const landmarkMatch = filters.landmarks.length > 0
            ? filters.landmarks.some(l => propertyLandmarksArr.includes(l.trim().toLowerCase()))
            : true;
        // Custom landmark filter is now ignored to enforce dropdown-only
        return (
            (s ? title.toLowerCase().includes(s) || barangay.toLowerCase().includes(s) : true) &&
            (filters.category ? category===filters.category : true) &&
            (filters.location ? barangay===filters.location : true) &&
            (filters.minPrice ? price >= Number(filters.minPrice) : true) &&
            (filters.maxPrice ? price <= Number(filters.maxPrice) : true) &&
            (filters.petFriendly ? petFriendly === true : true) &&
            (filters.occupancy ? occupancy >= Number(filters.occupancy) : true) &&
            (filters.parking ? parking === true : true) &&
            landmarkMatch &&
            (filters.minRooms ? numberOfRooms >= Number(filters.minRooms) : true) &&
            (filters.maxRooms ? numberOfRooms <= Number(filters.maxRooms) : true) &&
            (filters.minArea ? areaSqm >= Number(filters.minArea) : true) &&
            (filters.maxArea ? areaSqm <= Number(filters.maxArea) : true) &&
            (filters.hasVideo ? !!video : true) &&
            (filters.propertyType ? propertyType === filters.propertyType : true)
        );
    };

    const filtered = properties.filter(matches);
    const sorted = [...filtered].sort((a,b)=>{
        switch(sortOption){
            case 'priceAsc': return (a.price||0)-(b.price||0);
            case 'priceDesc': return (b.price||0)-(a.price||0);
            case 'roomsAsc': return (a.numberOfRooms||0)-(b.numberOfRooms||0);
            case 'roomsDesc': return (b.numberOfRooms||0)-(a.numberOfRooms||0);
            case 'areaAsc': return (a.areaSqm||0)-(b.areaSqm||0);
            case 'areaDesc': return (b.areaSqm||0)-(a.areaSqm||0);
            case 'oldest': return new Date(a.createdAt||0)-new Date(b.createdAt||0);
            case 'newest': default: return new Date(b.createdAt||0)-new Date(a.createdAt||0);
        }
    });
    const avgArea = sorted.length ? sorted.reduce((s,p)=>s+(p.areaSqm||0),0)/sorted.length : 0;
    const avgPricePerSqm = sorted.filter(p=>p.areaSqm>0).length ? sorted.reduce((s,p)=> s + ((p.price||0)/(p.areaSqm||1)),0)/sorted.filter(p=>p.areaSqm>0).length : 0;

    const toggleFavorite = async (id)=>{
        const token = getToken(); if(!token){ toast.info('Please log in to use favorites.'); return; }
        if(userRole !== 'tenant') return;
        try {
            if(favorites.includes(id)) { await FavoriteService.removeFromFavorites(id, token); setFavorites(f=>f.filter(x=>x!==id)); toast.dismiss(); toast.info('Removed from favorites'); }
            else { await FavoriteService.addToFavorites(id, token); setFavorites(f=>[...f,id]); toast.dismiss(); toast.success('Added to favorites'); }
        } catch(err){ toast.error('Failed to update favorites.'); }
    };

    // helper: infer nearby landmarks from barangay/address using simple keyword matching
    const landmarkHints = (p)=>{
        if(p.landmarks && p.landmarks.trim()) return p.landmarks;
        const text = `${p.title||''} ${p.barangay||''} ${p.address||''}`.toLowerCase();
        const hints = [];
        const mapping = {
            'school': ['school','elementary','high school','university','college'],
            'mall': ['mall','market','plaza','shopping'],
            'hospital': ['hospital','clinic','medical','health'],
            'transport': ['terminal','terminal','station','bus','jeepney','lrt','metro']
        };
        Object.entries(mapping).forEach(([k,arr])=>{ if(arr.some(w=> text.includes(w))) hints.push(k); });
        return hints.length? hints.map(h=> ({school:'School',mall:'Mall',hospital:'Hospital',transport:'Transport Hub'}[h] )).join(', ') : '';
    };

    if(loading) return <div className="loading-container"><div className="loading-spinner"/><p>Loading properties...</p></div>;

    return (
        <div className="property-listing-container">
            <div className="property-listing-header glass-panel">
                <div className="listing-header-inner">
                    <h1 className="listing-title gradient-text">Find Your Perfect Home</h1>
                    <p className="subtitle">Browse verified rentals across San Jose Del Monte.</p>
                    <div className="controls-wrapper">
                    <div className="search-input-container controls-align-left">
                        <FaSearch className="search-icon" />
                        <input className="property-search" placeholder="Search by name or category..." value={filters.searchTerm} onChange={e=>updateFilter('searchTerm', e.target.value)} />
                        <button className={`toggle-filters-btn ${showFilters?'active':''}`} onClick={()=>setShowFilters(s=>!s)}>{showFilters?'Hide Filters':'Show Filters'}</button>
                    </div>
                    {showFilters && (
                        <div className="filters-container controls-align-left">
                            <div className="filters-grid">
                                <div className="filter-group">
                                    <label><FaHome/> Property Type</label>
                                    <select value={filters.category} onChange={e=>updateFilter('category', e.target.value)}>
                                        <option value="">All Categories</option>
                                        {categories.map(c=> <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label><FaMapMarkerAlt/> Location</label>
                                    <select value={filters.location} onChange={e=>updateFilter('location', e.target.value)}>
                                        <option value="">All Locations</option>
                                        {barangayList.map(b=> <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label><FaTag/> Price Range</label>
                                    <div className="price-range">
                                        <input type="number" placeholder="Min" value={filters.minPrice} onChange={e=>updateFilter('minPrice', e.target.value)} className="price-input" />
                                        <span>to</span>
                                        <input type="number" placeholder="Max" value={filters.maxPrice} onChange={e=>updateFilter('maxPrice', e.target.value)} className="price-input" />
                                    </div>
                                </div>
                                <div className="filter-group"><label><FaBed/> Min Occupancy</label><input type="number" placeholder="e.g. 2" value={filters.occupancy} onChange={e=>updateFilter('occupancy', e.target.value)} /></div>
                                <div className="filter-group"><label><FaDoorOpen/> Min Rooms</label><input type="number" placeholder="e.g. 1" value={filters.minRooms} onChange={e=>updateFilter('minRooms', e.target.value)} /></div>
                                <div className="filter-group"><label><FaDoorOpen/> Max Rooms</label><input type="number" placeholder="e.g. 5" value={filters.maxRooms} onChange={e=>updateFilter('maxRooms', e.target.value)} /></div>
                                <div className="filter-group"><label><FaRulerCombined/> Min Size (sqm)</label><input type="number" placeholder="e.g. 30" value={filters.minArea} onChange={e=>updateFilter('minArea', e.target.value)} /></div>
                                <div className="filter-group"><label><FaRulerCombined/> Max Size (sqm)</label><input type="number" placeholder="e.g. 120" value={filters.maxArea} onChange={e=>updateFilter('maxArea', e.target.value)} /></div>
                                <div className="filter-group amenities">
                                    <label>Amenities</label>
                                    <div className="amenity-checkbox">
                                        <input type="checkbox" id="petFriendly" checked={filters.petFriendly} onChange={()=>updateFilter('petFriendly', !filters.petFriendly)} />
                                        <label htmlFor="petFriendly"><FaDog/> Pet Friendly</label>
                                    </div>
                                    <div className="amenity-checkbox">
                                        <input type="checkbox" id="parking" checked={filters.parking} onChange={()=>updateFilter('parking', !filters.parking)} />
                                        <label htmlFor="parking"><FaParking/> Parking</label>
                                    </div>
                                    <div className="amenity-checkbox">
                                        <input type="checkbox" id="hasVideo" checked={filters.hasVideo} onChange={()=>updateFilter('hasVideo', !filters.hasVideo)} />
                                        <label htmlFor="hasVideo">🎥 Has Video</label>
                                    </div>
                                </div>

                                <div className="filter-group">
                                    <label>Nearby Landmarks</label>
                                    <div className="landmarks-grid">
                                        {[
                                            { value: "park", label: "Park" },
                                            { value: "church", label: "Church" },
                                            { value: "public market", label: "Public Market" },
                                            { value: "major highway", label: "Major Highway" },
                                            { value: "public transport stops", label: "Public Transportation Stops" },
                                            { value: "banks and atms", label: "Banks and ATMs" },
                                            { value: "restaurant/food centers", label: "Restaurants/Food Centers" },
                                            { value: "convenience store/supermarket", label: "Convenience Store/Supermarket" },
                                            { value: "school/university", label: "School/University" },
                                            { value: "hospital/health care", label: "Hospital/Health Care" }
                                        ].map(l => (
                                            <div key={l.value} className="amenity-checkbox landmark-option">
                                                <input
                                                    type="checkbox"
                                                    id={l.value}
                                                    checked={filters.landmarks.includes(l.value)}
                                                    onChange={() => {
                                                        if (filters.landmarks.includes(l.value)) {
                                                            updateFilter("landmarks", filters.landmarks.filter(x => x !== l.value));
                                                        } else {
                                                            updateFilter("landmarks", [...filters.landmarks, l.value]);
                                                        }
                                                    }}
                                                />
                                                <label htmlFor={l.value}>{l.label}</label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button className="reset-filters" onClick={resetFilters}>Reset Filters</button>
                        </div>
                    )}
                    <div className="results-row controls-align-left">
                        <div className="results-count">
                            {filtered.length} {filtered.length===1?'property':'properties'} found
                            {filtered.length>0 && <span className="results-metrics"> • Avg Size {avgArea.toFixed(1)} sqm {avgPricePerSqm>0 && `• Avg ₱${Math.round(avgPricePerSqm).toLocaleString()}/sqm`}</span>}
                        </div>
                        <div className="filters-bar">
                            <div className="filter-item">
                                <label htmlFor="propertyTypeSelect">Type:</label>
                                <select 
                                    id="propertyTypeSelect" 
                                    value={filters.propertyType} 
                                    onChange={e => setFilters(prev => ({...prev, propertyType: e.target.value}))}
                                >
                                    <option value="">All Types</option>
                                    <option value="For Rent">For Rent</option>
                                    <option value="For Sale">For Sale</option>
                                </select>
                            </div>
                            <div className="filter-item">
                                <label htmlFor="sortSelect">Sort:</label>
                                <select id="sortSelect" value={sortOption} onChange={e=>setSortOption(e.target.value)}>
                                    <option value="newest">Newest</option>
                                    <option value="oldest">Oldest</option>
                                    <option value="priceDesc">Price High-Low</option>
                                    <option value="priceAsc">Price Low-High</option>
                                    <option value="roomsDesc">Rooms High-Low</option>
                                    <option value="roomsAsc">Rooms Low-High</option>
                                    <option value="areaDesc">Area High-Low</option>
                                    <option value="areaAsc">Area Low-High</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
            <div className="properties-grid">
                {sorted.length ? sorted.map(p=>{
                    const {_id,title,category,barangay,price,images,petFriendly,parking,occupancy,landmarks,numberOfRooms,areaSqm,video, landlordProfile, createdAt, propertyType}=p;
                    return (
                        <div key={_id} className="property-card" onClick={()=>navigate(`/property/${_id}`)}>
                            <div className="property-badges">
                                <span className="property-badge">{category}</span>
                                <span className={`property-type-badge ${(propertyType || "For Rent")?.toLowerCase().replace(/\s+/g, '-')}`}>
                                    {propertyType || "For Rent"}
                                </span>
                            </div>
                            {userRole==='tenant' && (
                                <div className="favorite-icon" role="button" tabIndex={0} aria-label={favorites.includes(_id)?'Remove from favorites':'Add to favorites'} onClick={(e)=>{e.stopPropagation(); toggleFavorite(_id);}} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault(); e.stopPropagation(); toggleFavorite(_id);}}}>
                                    {favorites.includes(_id)?<FaHeart/>:<FaRegHeart/>}
                                </div>
                            )}
                            <div className="property-images">
                                <img src={images?.[0] || '/default-property.jpg'} alt={title} className="property-image" loading="lazy" />
                                {/* video badge intentionally removed */}
                                <div className="property-price-row">
                                    <div className="property-price">₱{(price||0).toLocaleString()}</div>
                                    {(() => {
                                        const status = p.availabilityStatus ? p.availabilityStatus : (occupancy >= (numberOfRooms || 1) ? 'Fully Occupied' : (numberOfRooms>0 ? 'Available' : 'Not Yet Ready'));
                                        let className = 'property-availability';
                                        if (/unavail|full/i.test(status)) className += ' unavailable';
                                        else if (/not yet ready/i.test(status)) className += ' not-ready';
                                        return <div className={className}>{status}</div>;
                                    })()}
                                </div>
                            </div>
                            <div className="property-details">
                                <h3>{title}</h3>
                                {createdAt && <span className="property-date" title={new Date(createdAt).toLocaleString()}>{formatCreatedAt(createdAt)}</span>}
                                {(typeof p.availableUnits !== 'undefined' || typeof p.totalUnits !== 'undefined') && (
                                    <div className="card-units-pill-row">
                                        <div className="card-units-pill">
                                            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{verticalAlign:'middle',marginRight:'5px'}}><rect x="3" y="7" width="14" height="8" rx="2.5" fill="#38bdf8"/><rect x="7" y="3" width="6" height="4" rx="2" fill="#60aaff"/></svg>
                                            {p.availableUnits !== undefined ? p.availableUnits : '0'}{p.totalUnits ? ` / ${p.totalUnits}` : ''}
                                        </div>
                                        <span className="card-units-label">Available units</span>
                                    </div>
                                )}
                                {landlordProfile && (
                                    <div className="landlord-mini" onClick={(e)=>{e.stopPropagation(); navigate(`/landlord/${landlordProfile.id}`);}} role="button" tabIndex={0} onKeyDown={(e)=>{if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); navigate(`/landlord/${landlordProfile.id}`);} }}>
                                        <img src={landlordProfile.profilePic || '/default-avatar.png'} alt={landlordProfile.fullName} className="landlord-avatar" loading="lazy" />
                                        <span className="landlord-name">{landlordProfile.fullName}{landlordProfile.verified && <span className="verified-badge" title="Verified">✔</span>}</span>
                                    </div>
                                )}
                                <p className="property-location"><FaMapMarkerAlt/> {barangay}</p>
                                <div className="property-features">
                                    {petFriendly && <span className="feature-tag"><FaDog/> Pet Friendly</span>}
                                    {parking && <span className="feature-tag"><FaParking/> Parking</span>}
                                    {!!occupancy && <span className="feature-tag"><FaBed/> {occupancy} pax</span>}
                                    {numberOfRooms>0 && <span className="feature-tag"><FaDoorOpen/> {numberOfRooms} {numberOfRooms===1?'room':'rooms'}</span>}
                                    {areaSqm>0 && <span className="feature-tag"><FaRulerCombined/> {areaSqm} sqm</span>}
                                </div>
                                { (landmarks || landmarkHints(p)) && <p className="property-landmarks"><strong>Near:</strong> {landmarks || landmarkHints(p)}</p>}
                                <button className="view-btn" onClick={(e)=>{e.stopPropagation(); navigate(`/property/${_id}`);}}>View Details</button>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="no-properties-message">
                        <img src="/no-results.svg" alt="No properties found" />
                        <h3>No properties match your search</h3>
                        <p>Try adjusting your filters or search term</p>
                        <button className="reset-filters" onClick={resetFilters}>Reset All Filters</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PropertyListingPage;