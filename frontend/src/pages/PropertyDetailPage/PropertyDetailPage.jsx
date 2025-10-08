import React, { useState, useEffect, useContext } from "react";
import PhotoDomeViewer from '../../components/PhotoDomeViewer';
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { FaArrowLeft, FaHome, FaMapMarkerAlt, FaTag, FaPaw, FaCar, FaUsers, FaInfoCircle, FaDoorOpen, FaRulerCombined, FaFlag } from "react-icons/fa";
import { buildApi, buildUpload } from '../../services/apiConfig';
import { AuthContext } from '../../context/AuthContext';
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

    useEffect(() => {
        const fetchProperty = async () => {
            try {
                const response = await fetch(buildApi(`/properties/${id}`));
                if (!response.ok) {
                    throw new Error("Failed to fetch property");
                }
                const data = await response.json();
                // Normalize media URLs
                const norm = { ...data };
                if(norm.images) norm.images = norm.images.map(img => buildUpload(img));
                if(norm.video) norm.video = buildUpload(norm.video);
                // landlordProfile media normalization
                if(norm.landlordProfile && norm.landlordProfile.profilePic && !norm.landlordProfile.profilePic.startsWith('http')) {
                    norm.landlordProfile.profilePic = buildUpload(`/profiles/${norm.landlordProfile.profilePic}`);
                }
                // Normalize panorama URL
                if (norm.panorama360 && !norm.panorama360.startsWith('http')) {
                    norm.panorama360 = buildUpload(norm.panorama360);
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
    }, [id]);

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

    const isAvailable = (typeof property.availableUnits !== 'undefined') ? (property.availableUnits > 0) : (property.availabilityStatus !== 'Fully Occupied');

    return (
        <div className="property-detail-container">
            <div className="detail-glass-header">
                <button onClick={() => navigate(-1)} className="back-btn">
                    <FaArrowLeft /> Back to Listings
                </button>
                <div className="property-header">
                    <h1 className="gradient-text">{property.title}</h1>
                    <p className="property-location"><FaMapMarkerAlt /> {property.barangay}, San Jose Del Monte</p>
                    <div className="status-remark">{ property.availabilityStatus ? property.availabilityStatus : (property.occupancy >= (property.numberOfRooms || 1) ? 'Fully Occupied' : (property.numberOfRooms>0 ? 'Available' : 'Not Yet Ready')) }</div>
                </div>
            </div>

            <div className="property-content">
                {/* Left Side: Media (Video if exists + Image Slideshow) */}
                <div className="property-gallery glass-panel">
                    {/* 360° Panoramic Image Viewer - FIXED */}
                    {property.panorama360 && (
                        <div className="panorama-section" style={{marginBottom:'2rem'}}>
                            <h3 className="section-title white">360° Panoramic View</h3>
                            <div style={{
                                width: '100%',
                                height: '400px',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                            }}>
                                <PhotoDomeViewer 
                                    imageUrl={property.panorama360} 
                                    mode="MONOSCOPIC"
                                />
                            </div>
                        </div>
                    )}
                    {property.video && (
                        <div className="video-wrapper">
                            <video
                                src={property.video}
                                controls
                                preload="none"
                                className="property-video-player"
                                poster={property.images && property.images[0] ? property.images[0] : undefined}
                                onError={(e)=>{ e.currentTarget.style.display='none'; }}
                            />
                        </div>
                    )}
                    <Slider {...sliderSettings}>
                        {property.images && property.images.length > 0 ? (
                            property.images.map((image, index) => (
                                <div key={index} className="slider-item">
                                    <img
                                        src={image}
                                        alt={`Property ${index + 1}`}
                                        className="property-gallery-image"
                                        loading="lazy"
                                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/default-property.jpg'; }}
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

                {/* Right Side: Property Details */}
                <div className="property-info glass-panel">
                    <div className="price-section">
                        <h2>₱{property.price.toLocaleString()}</h2>
                        <span className="property-badge">{property.category}</span>
                    </div>

                    <div className="property-features">
                        <div className="feature">
                            <FaUsers className="feature-icon" />
                            <span>{property.occupancy} {property.occupancy === 1 ? 'Person' : 'People'}</span>
                        </div>
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
                        {property.petFriendly && (
                            <div className="feature">
                                <FaPaw className="feature-icon" />
                                <span>Pet Friendly</span>
                            </div>
                        )}
                        {property.parking && (
                            <div className="feature">
                                <FaCar className="feature-icon" />
                                <span>Parking Available</span>
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
                        {(property.landmarks || landmarkHints(property)) && (
                            <div className="detail-item">
                                <FaMapMarkerAlt className="detail-icon" />
                                <div>
                                    <strong>Nearby Landmarks:</strong>
                                    <p>{property.landmarks || landmarkHints(property)}</p>
                                </div>
                            </div>
                        )}
                        {property.rules && (
                            <div className="detail-item">
                                <FaInfoCircle className="detail-icon" />
                                <div>
                                    <strong>House Rules:</strong>
                                    <p>{property.rules}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {property.description && (
                        <div className="description-section">
                            <h3>Description</h3>
                            <p>{property.description}</p>
                        </div>
                    )}

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
                                <button type="button" className="landlord-profile-btn" onClick={()=>navigate(`/landlord/${property.landlordProfile.id}`)}>View Landlord Profile</button>
                            </div>
                        </div>
                    )}

                    <div className="detail-actions">
                        {userRole === 'tenant' && isAvailable && (
                            <button
                                className="apply-btn"
                                disabled={applying}
                                onClick={async () => {
                                    setApplying(true);
                                    try {
                                        const token = localStorage.getItem('user_token');
                                        if (!token) {
                                            toast.error('Please login to apply');
                                            navigate('/login');
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
                                Apply
                            </button>
                        )}
                        {(typeof property.availableUnits !== 'undefined' || typeof property.totalUnits !== 'undefined') && (
                            <div className="availability-counter improved-units">
                                <span className="units-pill">
                                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{verticalAlign:'middle',marginRight:'6px'}}><rect x="3" y="7" width="14" height="8" rx="2.5" fill="#38bdf8"/><rect x="7" y="3" width="6" height="4" rx="2" fill="#60aaff"/></svg>
                                    {property.availableUnits !== undefined ? property.availableUnits : '0'}{property.totalUnits ? ` / ${property.totalUnits}` : ''}
                                </span>
                                <span className="units-label">Available Unit{(property.availableUnits === 1) ? '' : 's'}</span>
                            </div>
                        )}
                        
                        <button
                            className="contact-btn"
                            onClick={() => {
                                if (property.landlordProfile) {
                                    console.log('Message Landlord clicked. landlordProfile:', property.landlordProfile);
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
                            Message Landlord
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PropertyDetailPage;