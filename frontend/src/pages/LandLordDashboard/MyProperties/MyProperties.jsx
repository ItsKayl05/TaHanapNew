import React, { useState, useEffect, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import { AuthContext } from "../../../context/AuthContext"; 
import Sidebar from "../Sidebar/Sidebar";
import '../landlord-theme.css';
import './MyProperties.css';
import { fetchMyProperties, deleteProperty } from '../../../services/landlord/LandlordPropertyService';
import { setAvailability } from '../../../services/landlord/LandlordPropertyService';
import ConfirmDialog from '../../../components/ConfirmDialog/ConfirmDialog';
import { buildUpload } from '../../../services/apiConfig';

const MyProperties = () => {
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [deletingId, setDeletingId] = useState(null);
    const [sortOption, setSortOption] = useState('newest');
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        let didCancel = false;

        (async () => {
            const token = localStorage.getItem('user_token');
            if (!token) {
                // No need to show abort-like toasts here; redirecting instead
                toast.error('No token found. Redirecting to login...');
                setTimeout(() => navigate('/login'), 1200);
                return;
            }
            try {
                const data = await fetchMyProperties(controller.signal);
                if (!didCancel) setProperties(data);
            } catch (err) {
                // Ignore AbortError / CanceledError which are expected on unmount
                if (err?.name === 'AbortError' || err?.name === 'CanceledError') {
                    console.info('Fetch aborted (expected during cleanup):', err.message);
                } else {
                    // Show friendly network/session errors, but avoid noisy abort toasts
                    toast.error(err.message || 'Failed to load properties');
                }
            } finally {
                if (!didCancel) setLoading(false);
            }
        })();

        return () => {
            didCancel = true;
            try { controller.abort(); } catch (e) { /* ignore */ }
        };
    }, [navigate]);

    const handleEdit = (propertyId) => navigate(`/edit-property/${propertyId}`);
    const handleView = (propertyId) => navigate(`/property/${propertyId}`);

    const requestDelete = (propertyId) => setConfirmDeleteId(propertyId);
    const performDelete = async () => {
        if(!confirmDeleteId) return;
        const token = localStorage.getItem('user_token');
        if (!token) {
            toast.error('No token found. Redirecting to login...');
            navigate('/login');
            return;
        }
        try {
            setDeletingId(confirmDeleteId);
            await deleteProperty(confirmDeleteId);
            setProperties(prev => prev.filter(p => p._id !== confirmDeleteId));
            toast.success('Property deleted');
        } catch (err) {
            toast.error(err.message || 'Delete failed');
        } finally {
            setDeletingId(null);
            setConfirmDeleteId(null);
        }
    };

    const handleLogout = () => {
        logout();
        localStorage.removeItem("user_token");
        toast.success("Logged out successfully");
        navigate("/");
        window.dispatchEvent(new Event("storage"));
    };

    const filteredProperties = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return properties.filter(p =>
            (p.title?.toLowerCase() || '').includes(term) ||
            (p.address?.toLowerCase() || '').includes(term) ||
            (p.barangay?.toLowerCase() || '').includes(term)
        );
    }, [properties, searchTerm]);

    const formatArea = (v) => {
        if (v === undefined || v === null) return '';
        const n = Number(v);
        if (isNaN(n)) return '';
        return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
    };

    const sortedFiltered = useMemo(() => {
        const list = [...filteredProperties];
        switch (sortOption) {
            case 'priceAsc': list.sort((a,b)=> (a.price||0) - (b.price||0)); break;
            case 'priceDesc': list.sort((a,b)=> (b.price||0) - (a.price||0)); break;
            case 'title': list.sort((a,b)=> (a.title||'').localeCompare(b.title||'')); break;
            case 'oldest': list.sort((a,b)=> new Date(a.createdAt||0) - new Date(b.createdAt||0)); break;
            case 'newest': default: list.sort((a,b)=> new Date(b.createdAt||0) - new Date(a.createdAt||0));
        }
        return list;
    }, [filteredProperties, sortOption]);

    const totalMonthly = useMemo(() => filteredProperties.reduce((sum,p)=> sum + (Number(p.price)||0),0), [filteredProperties]);

    return (
        <div className="dashboard-container landlord-dashboard">
            <Sidebar activeItem="my-properties" handleLogout={handleLogout} />
            <div className="main-content landlord-main properties-main">
                <div className="header-row">
                    <div className="title-block">
                        <h1 className="page-title">My Properties</h1>
                        <div className="stats-line">
                            <span>{filteredProperties.length} shown</span>
                            <span>• Total ₱{totalMonthly.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="toolbar-actions">
                        <div className="search-filter-container">
                            <input
                                className="ll-field search-input"
                                type="text"
                                placeholder="Search by title or address..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select className="ll-field sort-select" value={sortOption} onChange={e=>setSortOption(e.target.value)} aria-label="Sort">
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="priceDesc">Price ↑</option>
                            <option value="priceAsc">Price ↓</option>
                            <option value="title">Title A-Z</option>
                        </select>
                        <button className="ll-btn primary" type="button" onClick={()=>navigate('/add-properties')}>Add Property</button>
                    </div>
                </div>

                <div className="properties-grid modern">
                    {loading && Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="property-card skeleton">
                            <div className="property-images shimmer" />
                            <div className="property-details">
                                <div className="line w-60" />
                                <div className="line w-40" />
                                <div className="line w-50" />
                                <div className="line w-30" />
                            </div>
                        </div>
                    ))}
                    {!loading && sortedFiltered.map(property => {
                        const firstImg = property.images?.[0];
                        const secondImg = property.images?.[1];
                        // Backend now returns absolute URLs; fallback to default if missing
                        const img1 = firstImg || buildUpload('/properties/default-property.jpg');
                        const img2 = secondImg || null;
                        return (
                        <div key={property._id} className="property-card rich">
                            <div className="property-images swap">
                                <img src={img1} alt={property.title || 'Property'} className="property-image layer base" loading="lazy" />
                                {img2 && <img src={img2} alt="Alt view" className="property-image layer hover" loading="lazy" />}
                                <div className="image-badges">
                                    {/* category removed */}
                                    <span className="tag loc">{property.barangay}</span>
                                    {property.petFriendly && <span className="tag pet" title="Pet Friendly">🐾 Pets</span>}
                                    {property.parking && <span className="tag park" title="Parking Available">🅿 Parking</span>}
                                </div>
                            </div>
                            <div className="property-details">
                                <h3 title={property.title}>{property.title}</h3>
                                <div className="meta-line">
                                    <span className="price">₱{Number(property.price).toLocaleString()}</span>
                                    <span className="dot" />
                                    <span className="occ">Max {property.occupancy || 1} pax</span>
                                    {Number(property.numberOfRooms) > 0 && <>
                                        <span className="dot" />
                                        <span className="rooms">{property.numberOfRooms} {property.numberOfRooms === 1 ? 'room' : 'rooms'}</span>
                                    </>}
                                    {Number(property.areaSqm) > 0 && <>
                                        <span className="dot" />
                                        <span className="area">{formatArea(property.areaSqm)} sqm</span>
                                    </>}
                                    {/* NEW: Display floorArea, lotArea, and numberOfFloors */}
                                    {Number(property.floorArea) > 0 && <>
                                        <span className="dot" />
                                        <span className="area">Floor: {formatArea(property.floorArea)} sqm</span>
                                    </>}
                                    {Number(property.lotArea) > 0 && <>
                                        <span className="dot" />
                                        <span className="area">Lot: {formatArea(property.lotArea)} sqm</span>
                                    </>}
                                    {Number(property.numberOfFloors) > 0 && <>
                                        <span className="dot" />
                                        <span className="area">{property.numberOfFloors} {property.numberOfFloors === 1 ? 'floor' : 'floors'}</span>
                                    </>}
                                </div>
                                {property.landmarks && <p className="landmark" title={property.landmarks}>{property.landmarks}</p>}
                                <div className="my-properties-actions unified">
                                    <button onClick={() => handleView(property._id)} className="ll-btn outline small">View</button>
                                    <button onClick={() => handleEdit(property._id)} className="ll-btn warn small">Edit</button>
                                    <button onClick={() => navigate(`/rental-requests/${property._id}`)} className="ll-btn primary small">Rental Requests</button>
                                    <button onClick={() => requestDelete(property._id)} disabled={deletingId === property._id} className="ll-btn danger small">
                                        {deletingId === property._id ? 'Deleting...' : 'Delete'}
                                    </button>
                                        {/* Unit adjustments are system-managed; manual adjustments removed */}
                                </div>
                            </div>
                        </div>
                    );})}
                </div>

                {!loading && sortedFiltered.length === 0 && (
                    <div className="no-properties-message">
                        <p>You don't have any properties listed yet.</p>
                        <button onClick={() => navigate("/add-properties")}>Add Property</button>
                    </div>
                )}
            </div>
            <ConfirmDialog
                open={!!confirmDeleteId}
                title="Delete Property"
                message="Are you sure you want to delete this property? This action cannot be undone."
                confirmLabel={deletingId ? 'Deleting...' : 'Delete'}
                cancelLabel="Cancel"
                danger
                busy={!!deletingId}
                onConfirm={performDelete}
                onCancel={()=>{ if(!deletingId) setConfirmDeleteId(null); }}
                icon={<span style={{fontSize:'1.8rem'}}>🗑️</span>}
            />
        </div>
    );
};

export default MyProperties;