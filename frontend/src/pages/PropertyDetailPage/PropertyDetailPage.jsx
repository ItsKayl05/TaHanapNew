import React, { useState, useEffect, useContext } from "react";
import PhotoDomeViewer from '../../components/PhotoDomeViewer';
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { FaArrowLeft, FaHome, FaMapMarkerAlt, FaTag, FaPaw, FaCar, FaUsers, FaInfoCircle, FaDoorOpen, FaRulerCombined, FaFlag, FaBolt, FaWater, FaChartLine } from "react-icons/fa";
import { buildApi, buildUpload } from '../../services/apiConfig';
import { AuthContext } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { createApplication } from '../../services/application/ApplicationService';
import "./PropertyDetailPage.css";

const PropertyDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [property, setProperty] = useState(null);
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);
    const { userRole } = useContext(AuthContext);
    const currentUserId = localStorage.getItem('user_id') || null;
    const { socket } = useSocket();

    useEffect(() => {
        const fetchProperty = async () => {
            try {
                const response = await fetch(buildApi(`/properties/${id}`));
                if (!response.ok) {
                    throw new Error("⚠️ Unable to load property information");
                }
                const data = await response.json();
                console.log('Property data received:', data); // Debug log
                
                // Normalize media URLs
                const norm = { ...data };
                
                // Normalize images
                if(norm.images) {
                    norm.images = norm.images.map(img => 
                        img.startsWith('http') ? img : buildUpload(img)
                    );
                }
                
                // Normalize video
                if(norm.video) {
                    norm.video = norm.video.startsWith('http') ? norm.video : buildUpload(norm.video);
                }
                
                // landlordProfile media normalization
                if(norm.landlordProfile && norm.landlordProfile.profilePic && !norm.landlordProfile.profilePic.startsWith('http')) {
                    norm.landlordProfile.profilePic = buildUpload(`/profiles/${norm.landlordProfile.profilePic}`);
                }
                
                // Normalize panorama URLs - FIXED: More robust normalization
                if (norm.panorama360Images && Array.isArray(norm.panorama360Images)) {
                    console.log('Raw panorama images:', norm.panorama360Images); // Debug log
                    norm.panorama360Images = norm.panorama360Images.map(panorama => {
                        if (typeof panorama === 'string') {
                            return panorama.startsWith('http') ? panorama : buildUpload(panorama);
                        }
                        return panorama; // Return as-is if not a string
                    }).filter(panorama => panorama); // Remove any null/undefined values
                    console.log('Normalized panorama images:', norm.panorama360Images); // Debug log
                } else {
                    console.log('No panorama images found or not an array:', norm.panorama360Images);
                }
                
                setProperty(norm);
                setLoading(false);
            } catch (error) {
                toast.error("Error fetching property details");
                console.error("Error:", error);
                setLoading(false);
            }
        };
        fetchProperty();
        
        // Join socket room for this property to receive realtime updates
        try {
            if (socket && socket.connected) {
                socket.emit('joinRoom', { roomId: `property:${id}` });
            }
        } catch (e) { /* ignore */ }

        return () => {
            try { if (socket && socket.connected) socket.emit('leaveRoom', { roomId: `property:${id}` }); } catch(e){}
        };
    }, [id, socket]);

    // Listen for realtime updates to this property (availability changes)
    useEffect(() => {
        if (!socket) return;
        const handlePropertyUpdated = (payload) => {
            try {
                if (!payload || !payload.propertyId) return;
                const pid = String(payload.propertyId);
                if (pid === String(property?._id || property?.id || id)) {
                    // merge availabilityStatus and other updated fields
                    setProperty(prev => ({ ...(prev||{}), ...(payload || {}) }));
                    // optionally show a toast
                    if (payload.availabilityStatus) {
                        toast.info(`Property status updated: ${payload.availabilityStatus}`);
                    }
                }
            } catch (e) { console.warn('handlePropertyUpdated error', e); }
        };

        const handleApplicationUpdated = (payload) => {
            try {
                // if application affects this property, re-fetch property to get latest counts
                if (payload && payload.application && payload.application.property) {
                    const pid = String(payload.application.property);
                    if (pid === String(property?._id || property?.id || id)) {
                        // re-fetch property to ensure full normalization
                        (async ()=>{
                            try {
                                const resp = await fetch(buildApi(`/properties/${id}`));
                                if (resp.ok) {
                                    const data = await resp.json();
                                    // Re-normalize all media URLs
                                    if(data.images) data.images = data.images.map(img => buildUpload(img));
                                    if(data.video) data.video = buildUpload(data.video);
                                    if(data.panorama360Images && Array.isArray(data.panorama360Images)) {
                                        data.panorama360Images = data.panorama360Images.map(panorama => 
                                            panorama.startsWith('http') ? panorama : buildUpload(panorama)
                                        );
                                    }
                                    setProperty(data);
                                }
                            } catch(e) { console.warn('refetch after application update failed', e); }
                        })();
                    }
                }
            } catch (e) { console.warn('handleApplicationUpdated error', e); }
        };

        socket.on('propertyUpdated', handlePropertyUpdated);
        socket.on('applicationUpdated', handleApplicationUpdated);

        return () => {
            socket.off('propertyUpdated', handlePropertyUpdated);
            socket.off('applicationUpdated', handleApplicationUpdated);
        };
    }, [socket, property, id]);

    const landmarkHints = (p)=>{
        if(p.landmarks && p.landmarks.trim()) return p.landmarks;
        const text = `${p.title||''} ${p.barangay||''} ${p.address||''}`.toLowerCase();
        const hints = [];
        const mapping = {
            'school': ['school','elementary','high school','university','college'],
            'mall': ['mall','market','plaza','shopping'],
            'hospital': ['hospital','clinic','medical','health'],
            'transport': ['terminal','station','bus','jeepney','lrt','metro']
        };
        Object.entries(mapping).forEach(([k,arr])=>{ if(arr.some(w=> text.includes(w))) hints.push(k); });
        return hints.length? hints.map(h=> ({school:'School',mall:'Mall',hospital:'Hospital',transport:'Transport Hub'}[h] )).join(', ') : '';
    };

    if (loading) return (
        <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading property details...</p>
        </div>
    );
    
    if (!property) return (
        <div className="error-message">
            <h3>Property not found</h3>
            <button className="back-btn" onClick={() => navigate(-1)}>
                <FaArrowLeft /> Back to Listings
            </button>
        </div>
    );

    // Slideshow settings
    const sliderSettings = {
        dots: true,
        infinite: property.images && property.images.length > 1,
        speed: 500,
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 3000,
        arrows: true,
    };

    // Availability: normalize server value and treat variants like 'not available' / 'Not-Available' as unavailable
    const availabilityRaw = String(property.availabilityStatus || '').toLowerCase();
    const isAvailable = !(/not[\s-]*available/.test(availabilityRaw));

    // Determine if it's For Rent or For Sale (accept either propertyType or listingType, be case-insensitive and tolerant)
    const listingKindRaw = (property.propertyType || property.listingType || '').toString();
    const listingKind = listingKindRaw.trim().toLowerCase();
    const isForRent = listingKind.includes('rent') && !listingKind.includes('sale');
    const isForSale = listingKind.includes('sale') && !listingKind.includes('rent');

    const formatArea = (v) => {
        if (v === undefined || v === null) return '';
        const num = Number(v);
        if (isNaN(num)) return '';
        return Number.isInteger(num) ? String(num) : String(Math.round(num * 10) / 10);
    };

    return (
        <div className="property-detail-container">
            <div className="detail-glass-header">
                <button onClick={() => navigate(-1)} className="back-btn">
                    <FaArrowLeft /> Back to Listings
                </button>
                <div className="property-header">
                    <h1 className="gradient-text">{property.propertyType}</h1>
                    <p className="property-location"><FaMapMarkerAlt /> {property.barangay}, San Jose Del Monte</p>
                    <div className={`status-remark ${isAvailable ? 'available' : 'not-available'}`}>{ property.availabilityStatus ?? (property.numberOfRooms>0 ? 'Available' : 'Not Yet Ready') }</div>
                </div>
            </div>

            <div className="property-content">
                {/* Left Side: Media (Video if exists + Image Slideshow) */}
                <div className="property-gallery glass-panel">
                    {/* 360° Panoramic Image Viewers - IMPROVED: Better error handling and styling */}
                    {property.panorama360Images && property.panorama360Images.length > 0 && (
                        <div className="panorama-section" style={{marginBottom:'2rem'}}>
                            <h3 className="section-title white">360° Panoramic Views</h3>
                            <p className="panorama-hint" style={{color: '#ccc', fontSize: '0.9rem', marginBottom: '1rem'}}>
                                Drag to explore the 360° view of this property
                            </p>
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '1.5rem',
                                alignItems: 'center'
                            }}>
                                {property.panorama360Images.map((panorama, index) => (
                                    <div 
                                        key={index} 
                                        style={{ 
                                            width: '100%', 
                                            height: '400px', // Fixed height for better visibility
                                            borderRadius: '16px', 
                                            overflow: 'hidden', 
                                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                            position: 'relative'
                                        }}
                                    >
                                        <PhotoDomeViewer 
                                            imageUrl={panorama} 
                                            mode="MONOSCOPIC"
                                            onError={(error) => {
                                                console.error(`Failed to load panorama ${index}:`, error);
                                                toast.error(`Failed to load 360° view ${index + 1}`);
                                            }}
                                        />
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '10px',
                                            left: '10px',
                                            background: 'rgba(0,0,0,0.7)',
                                            color: 'white',
                                            padding: '5px 10px',
                                            borderRadius: '8px',
                                            fontSize: '0.8rem'
                                        }}>
                                            Room View {index + 1}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Video Section */}
                    {property.video && (
                        <div className="video-wrapper">
                            <video
                                src={property.video}
                                controls
                                preload="none"
                                className="property-video-player"
                                poster={property.images && property.images[0] ? property.images[0] : undefined}
                                onError={(e)=>{ 
                                    console.error('Video failed to load:', e);
                                    e.currentTarget.style.display='none'; 
                                }}
                            />
                        </div>
                    )}

                    {/* Image Slideshow */}
                    <div className="image-slideshow-section">
                        <h3 className="section-title white">Property Images</h3>
                        <Slider {...sliderSettings}>
                            {property.images && property.images.length > 0 ? (
                                property.images.map((image, index) => (
                                    <div key={index} className="slider-item">
                                        <img
                                            src={image}
                                            alt={`Property ${index + 1}`}
                                            className="property-gallery-image"
                                            loading="lazy"
                                            onError={(e) => { 
                                                e.currentTarget.onerror = null; 
                                                e.currentTarget.src = '/default-property.jpg'; 
                                            }}
                                        />
                                    </div>
                                ))
                            ) : (
                                <div className="slider-item">
                                    <img
                                        src="/default-property.jpg"
                                        alt="Default Property"
                                        className="property-gallery-image"
                                    />
                                </div>
                            )}
                        </Slider>
                    </div>
                </div>

                {/* Right Side: Property Details */}
                <div className="property-info glass-panel">
                    <div className="price-section">
                        <h2>₱{property.price.toLocaleString()}</h2>
                        <div className="property-badges-container">
                            <div className="badge-group">
                                <span className={`property-type-badge ${property.listingType?.toLowerCase().replace(/\s+/g, '-')}`}>
                                    {property.listingType || "For Rent"}
                                </span>
                                <span className={`property-badge availability-badge ${isAvailable ? 'available' : 'not-available'}`}>
                                    {property.availabilityStatus || (isAvailable ? 'Available' : 'Not Available')}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="property-features">
                        {/* Common Features for both Rent and Sale */}
                        {Number(property.numberOfRooms) > 0 && (
                            <div className="feature">
                                <FaDoorOpen className="feature-icon" />
                                <span>{property.numberOfRooms} {property.numberOfRooms === 1 ? 'Room' : 'Rooms'}</span>
                            </div>
                        )}
                        {Number(property.areaSqm) > 0 && (
                            <div className="feature">
                                <FaRulerCombined className="feature-icon" />
                                <span>{property.areaSqm} sqm</span>
                            </div>
                        )}
                        {property.parking && (
                            <div className="feature">
                                <FaCar className="feature-icon" />
                                <span>Parking Available</span>
                            </div>
                        )}

                        {/* NEW: Display floorArea, lotArea, and numberOfFloors */}
                        {Number(property.floorArea) > 0 && (
                            <div className="feature">
                                <FaRulerCombined className="feature-icon" />
                                <span>Floor: {formatArea(property.floorArea)} sqm</span>
                            </div>
                        )}
                        {Number(property.lotArea) > 0 && (
                            <div className="feature">
                                <FaRulerCombined className="feature-icon" />
                                <span>Lot: {formatArea(property.lotArea)} sqm</span>
                            </div>
                        )}
                        {Number(property.numberOfFloors) > 0 && (
                            <div className="feature">
                                <FaHome className="feature-icon" />
                                <span>{property.numberOfFloors} {property.numberOfFloors === 1 ? 'Floor' : 'Floors'}</span>
                            </div>
                        )}

                        {/* For Rent Specific Features */}
                        {isForRent && (
                            <>
                                <div className="feature">
                                    <FaUsers className="feature-icon" />
                                    <span>{property.occupancy} {property.occupancy === 1 ? 'Person' : 'People'}</span>
                                </div>
                            </>
                        )}

                        {/* For Sale Specific Features */}
                        {isForSale && property.propertyCondition && (
                            <div className="feature">
                                <FaInfoCircle className="feature-icon" />
                                <span>{property.propertyCondition}</span>
                            </div>
                        )}
                    </div>

                    <div className="details-section">
                        <h3><FaInfoCircle /> Property Details</h3>
                        <div className="detail-item">
                            <FaHome className="detail-icon" />
                            <div>
                                <strong>Address:</strong>
                                <p>{property.address}</p>
                            </div>
                        </div>
                        {Number(property.numberOfRooms) > 0 && (
                            <div className="detail-item">
                                <FaDoorOpen className="detail-icon" />
                                <div>
                                    <strong>Number of Rooms:</strong>
                                    <p>{property.numberOfRooms}</p>
                                </div>
                            </div>
                        )}
                        {Number(property.areaSqm) > 0 && (
                            <div className="detail-item">
                                <FaRulerCombined className="detail-icon" />
                                <div>
                                    <strong>Property Size:</strong>
                                    <p>{property.areaSqm} sqm</p>
                                </div>
                            </div>
                        )}
                        {/* NEW: Detailed floorArea, lotArea, and numberOfFloors in details section */}
                        {Number(property.floorArea) > 0 && (
                            <div className="detail-item">
                                <FaRulerCombined className="detail-icon" />
                                <div>
                                    <strong>Floor Area:</strong>
                                    <p>{formatArea(property.floorArea)} sqm</p>
                                </div>
                            </div>
                        )}
                        {Number(property.lotArea) > 0 && (
                            <div className="detail-item">
                                <FaRulerCombined className="detail-icon" />
                                <div>
                                    <strong>Lot Area:</strong>
                                    <p>{formatArea(property.lotArea)} sqm</p>
                                </div>
                            </div>
                        )}
                        {Number(property.numberOfFloors) > 0 && (
                            <div className="detail-item">
                                <FaInfoCircle className="detail-icon" />
                                <div>
                                    <strong>Number of Floors:</strong>
                                    <p>{property.numberOfFloors}</p>
                                </div>
                            </div>
                        )}
                        {(property.landmarks || landmarkHints(property)) && (
                            <div className="detail-item">
                                <FaMapMarkerAlt className="detail-icon" />
                                <div>
                                    <strong>Nearby Landmarks:</strong>
                                    <p>{property.landmarks || landmarkHints(property)}</p>
                                </div>
                            </div>
                        )}

                        {/* For Rent Specific Details */}
                        {isForRent && property.rules && (
                            <div className="detail-item">
                                <FaInfoCircle className="detail-icon" />
                                <div>
                                    <strong>House Rules:</strong>
                                    <p>{property.rules}</p>
                                </div>
                            </div>
                        )}

                        {/* For Sale Specific Details */}
                        {isForSale && property.propertyCondition && (
                            <div className="detail-item">
                                <FaInfoCircle className="detail-icon" />
                                <div>
                                    <strong>Property Condition:</strong>
                                    <p>{property.propertyCondition}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Property Highlights Section */}
                    <div className="description-section">
                        <h3>Property Highlights</h3>
                        
                        {/* For Rent Highlights */}
                        {isForRent && (
                            <>
                                {property.billsIncluded && property.billsIncluded.length > 0 && (
                                    <div className="highlight-item">
                                        <div className="highlight-header">
                                            <FaBolt className="highlight-icon" />
                                            <strong>Bills Included:</strong>
                                        </div>
                                        <div className="highlight-content">
                                            {Array.isArray(property.billsIncluded) ? property.billsIncluded.join(', ') : property.billsIncluded}
                                        </div>
                                    </div>
                                )}
                                {property.petFriendly && (
                                    <div className="highlight-item">
                                        <div className="highlight-header">
                                            <FaPaw className="highlight-icon" />
                                            <strong>Pet Policy:</strong>
                                        </div>
                                        <div className="highlight-content">
                                            Pet Friendly
                                            {property.allowedPets && property.allowedPets.length > 0 && (
                                                <span> - Allowed: {Array.isArray(property.allowedPets) ? property.allowedPets.join(', ') : property.allowedPets}</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {property.occupancy && (
                                    <div className="highlight-item">
                                        <div className="highlight-header">
                                            <FaUsers className="highlight-icon" />
                                            <strong>Maximum Occupancy:</strong>
                                        </div>
                                        <div className="highlight-content">
                                            {property.occupancy} {property.occupancy === 1 ? 'person' : 'people'}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* For Sale Highlights */}
                        {isForSale && (
                            <>
                                {property.propertyCondition && (
                                    <div className="highlight-item">
                                        <div className="highlight-header">
                                            <FaInfoCircle className="highlight-icon" />
                                            <strong>Property Condition:</strong>
                                        </div>
                                        <div className="highlight-content">
                                            {property.propertyCondition}
                                        </div>
                                    </div>
                                )}
                                {property.marketHighlights && property.marketHighlights.length > 0 && (
                                    <div className="highlight-item">
                                        <div className="highlight-header">
                                            <FaChartLine className="highlight-icon" />
                                            <strong>Market Highlights:</strong>
                                        </div>
                                        <div className="highlight-tags">
                                            {(Array.isArray(property.marketHighlights) ? property.marketHighlights : String(property.marketHighlights).split(',').map(s=>s.trim())).map((mh,idx)=> (
                                                <span key={idx} className="market-highlight-tag">{mh}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Common Highlights */}
                        {property.parking && (
                            <div className="highlight-item">
                                <div className="highlight-header">
                                    <FaCar className="highlight-icon" />
                                    <strong>Parking:</strong>
                                </div>
                                <div className="highlight-content">
                                    Parking space available
                                </div>
                            </div>
                        )}
                    </div>

                    {property.landlordProfile && (
                        <div className="landlord-card">
                            <div className="landlord-card-header">
                                <img src={property.landlordProfile.profilePic || '/default-avatar.png'} alt={property.landlordProfile.fullName} className="landlord-card-avatar" />
                                <div className="landlord-card-meta">
                                    <h4>{property.landlordProfile.fullName} {property.landlordProfile.verified && <span className="verified-badge" title="Verified">✔</span>}</h4>
                                    {property.landlordProfile.address && <p className="landlord-address">{property.landlordProfile.address}</p>}
                                    {property.landlordProfile.contactNumber && <p className="landlord-contact">📞 {property.landlordProfile.contactNumber}</p>}
                                </div>
                            </div>
                            <div className="landlord-card-actions">
                                <button type="button" className="landlord-profile-btn" onClick={()=>navigate(`/landlord/${property.landlordProfile.id}`)}>View Property Owner Profile</button>
                            </div>
                        </div>
                    )}

                    <div className="detail-actions">
                        {/* Apply button: visible for all viewers when For Rent (click requires tenant login) */}
                        {isForRent && (
                            <button
                                className="apply-btn"
                                disabled={applying || !isAvailable}
                                onClick={async () => {
                                    if (!isAvailable) {
                                        toast.error('This property is no longer available');
                                        return;
                                    }
                                    setApplying(true);
                                    try {
                                        const token = localStorage.getItem('user_token');
                                        if (!token) {
                                            // Not logged in -> prompt login
                                            navigate('/login');
                                            setApplying(false);
                                            return;
                                        }
                                        const role = localStorage.getItem('user_role');
                                        if (role !== 'tenant') {
                                            toast.error('Only tenants can apply for rentals');
                                            setApplying(false);
                                            return;
                                        }
                                        const res = await createApplication(property._id || property.id || id, '');
                                        toast.success(res.message || 'Application sent');
                                        setApplying(false);
                                    } catch (err) {
                                        if (err.response && err.response.data && err.response.data.error) {
                                            toast.error(err.response.data.error);
                                        } else {
                                            toast.error('Failed to submit application');
                                        }
                                        setApplying(false);
                                    }
                                }}
                            >
                                {applying ? 'Applying...' : (isAvailable ? 'Apply for Rental' : 'Not Available')}
                            </button>
                        )}
                        
                        <button
                            className="contact-btn"
                            onClick={() => {
                                if (property.landlordProfile) {
                                    console.log('Message Property Owner clicked. landlordProfile:', property.landlordProfile);
                                    const ownerId = property.landlordProfile.id || property.landlordProfile._id;
                                    if (!ownerId) {
                                        toast.error('Owner user ID not found.');
                                        return;
                                    }
                                    const role = localStorage.getItem('user_role');
                                    const params = new URLSearchParams({
                                        user: ownerId,
                                        propertyTitle: property.title || '',
                                        propertyImage: (property.images && property.images[0]) ? property.images[0] : '',
                                        propertyPrice: property.price ? String(property.price) : '',
                                        propertyId: property._id || property.id || id || ''
                                    }).toString();
                                    if (role === 'landlord') {
                                        navigate(`/landlord/messages?${params}`);
                                    } else {
                                        navigate(`/tenant/messages?${params}`);
                                    }
                                } else {
                                    toast.error('Owner information not available');
                                }
                            }}
                        >
                            Message Property Owner
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PropertyDetailPage;