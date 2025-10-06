import { FaHeart, FaRegHeart, FaBed, FaRulerCombined, FaDog, FaParking } from "react-icons/fa";
import React, { useEffect, useState, useMemo, useRef, useContext } from "react";
import "./Favorites.css";
import FavoriteService from "../../../services/favorite/FavoriteService";
import { getToken } from "../../../services/auth/getToken";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { buildUpload } from '../../../services/apiConfig';
import TenantSidebar from "../TenantSidebar/TenantSidebar";
import { AuthContext } from '../../../context/AuthContext';
import '../../LandLordDashboard/landlord-theme.css';


const Favorites = () => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingIds, setRemovingIds] = useState(new Set());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const announceRef = useRef(null);
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  // Remove property from favorites
  const handleRemoveFavorite = async (propertyId) => {
    const token = getToken();
    // optimistic update
    setRemovingIds(prev => new Set(prev).add(propertyId));
    const prevList = favorites;
    setFavorites(prev => prev.filter(f => f._id !== propertyId));
    try {
      await FavoriteService.removeFromFavorites(propertyId, token);
      toast.info("Removed from favorites");
      if (announceRef.current) announceRef.current.textContent = 'Removed favorite';
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to remove favorite.');
      // rollback
      setFavorites(prevList);
    } finally {
      setRemovingIds(prev => { const n = new Set(prev); n.delete(propertyId); return n; });
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleBatchRemove = async () => {
    if (!selected.size) { toast.info('No selected items'); return; }
    const confirm = window.confirm(`Remove ${selected.size} selected favorite${selected.size>1?'s':''}?`);
    if (!confirm) return;
    const token = getToken();
    const ids = Array.from(selected);
    const prevList = favorites;
    // optimistic
    setFavorites(prev => prev.filter(f => !selected.has(f._id)));
    clearSelection();
    setSelectMode(false);
    try {
      for (const id of ids) { // sequential to simplify rollback granularity
        try { await FavoriteService.removeFromFavorites(id, token); } catch {/* per-item ignore */}
      }
      toast.success('Removed selected favorites');
    } catch {
      toast.error('Batch remove failed');
      setFavorites(prevList);
    }
  };

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) {
        toast.info("Please log in to view your favorites.");
        setLoading(false);
        return;
      }
      const response = await FavoriteService.getFavorites(token);
      // Only include favorites with a valid property object
      const validFavorites = response.data.favorites
        .map(fav => fav.property)
        .filter(Boolean);
      setFavorites(validFavorites);
    } catch (error) {
      toast.error("Failed to fetch favorites.");
      // Optionally log error for debugging
      console.error("Favorites fetch error:", error?.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const categories = useMemo(()=>{
    const set = new Set(favorites.map(f=> f.category).filter(Boolean));
    return Array.from(set).sort();
  },[favorites]);

  const filtered = useMemo(()=>{
    let list = [...favorites];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(f => (f.title||'').toLowerCase().includes(q) || (f.barangay||'').toLowerCase().includes(q));
    }
    if (category !== 'all') list = list.filter(f => f.category === category);
    switch (sort) {
      case 'price-asc': list.sort((a,b)=> (a.price||0)-(b.price||0)); break;
      case 'price-desc': list.sort((a,b)=> (b.price||0)-(a.price||0)); break;
      case 'title': list.sort((a,b)=> (a.title||'').localeCompare(b.title||'')); break;
      default: // recent - rely on original order if backend returns recent first
        break;
    }
    return list;
  },[favorites, search, category, sort]);

  // pagination slice
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(()=>{ if(page>totalPages) setPage(totalPages); },[totalPages, page]);
  const pageSlice = useMemo(()=> filtered.slice((page-1)*pageSize, (page-1)*pageSize + pageSize), [filtered, page, pageSize]);

  const skeletons = Array.from({length:6}).map((_,i)=> (
    <div key={i} className="favorite-card skeleton">
      <div className="favorite-images shimmer" />
      <div className="favorite-details">
        <div className="line w80" />
        <div className="line w40" />
      </div>
    </div>
  ));

  if (loading) return (
    <div className="favorites-container">
      <h2 className="favorites-title">Loading Favorites</h2>
      <div className="favorites-grid">{skeletons}</div>
    </div>
  );

  if (!favorites.length) {
    return (
      <div className="tenant-dashboard landlord-dashboard dashboard-container favorites-page">
        <TenantSidebar handleLogout={()=>{ logout(); localStorage.removeItem('user_token'); navigate('/'); }} />
        <main className="favorites-main">
          <div className="favorites-container empty-wrap">
            <h2 className="favorites-title">No favorites yet</h2>
            <p className="empty-state">Click the heart icon on a property to add it to your favorites.</p>
            <button type="button" className="fav-browse" onClick={()=>navigate('/properties')}>Browse Properties</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="tenant-dashboard landlord-dashboard dashboard-container favorites-page">
      <TenantSidebar handleLogout={()=>{ logout(); localStorage.removeItem('user_token'); navigate('/'); }} />
      <main className="favorites-main">
        <div className="favorites-container">
          <h2 className="favorites-title">Your Favorite Properties</h2>
          <div className="favorites-toolbar" role="region" aria-label="Favorites controls">
            <div className="toolbar-group">
              <input
                type="text"
                placeholder="Search title or location..."
                value={search}
                onChange={e=>{ setSearch(e.target.value); setPage(1); }}
                className="fav-input"
                aria-label="Search favorites"
              />
              <select value={category} onChange={e=>{ setCategory(e.target.value); setPage(1); }} className="fav-select" aria-label="Filter by category">
                <option value="all">All Categories</option>
                {categories.map(c=> <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={sort} onChange={e=>{ setSort(e.target.value); setPage(1); }} className="fav-select" aria-label="Sort favorites">
                <option value="recent">Recent</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="title">Title</option>
              </select>
              {(search || category!=='all' || sort!=='recent') && (
                <button type="button" className="fav-clear" onClick={()=>{ setSearch(''); setCategory('all'); setSort('recent'); setPage(1); }}>Reset</button>
              )}
            </div>
            <div className="toolbar-actions">
              <button type="button" className={`fav-select-toggle ${selectMode? 'active':''}`} onClick={()=>{ setSelectMode(m=>!m); if(selectMode) clearSelection(); }}>
                {selectMode? 'Close Selection' : 'Select Multiple'}
              </button>
              {selectMode && (
                <button type="button" className="fav-batch-remove" disabled={!selected.size} onClick={handleBatchRemove}>
                  Remove Selected ({selected.size})
                </button>
              )}
            </div>
            <div aria-live="polite" ref={announceRef} className="sr-only" />
          </div>
          <div className="favorites-grid">
            {pageSlice.map(property => {
          // Enhanced property card rendering with additional metadata
          const img0 = property.images?.[0];
          const imageSrc = img0 ? (img0.startsWith('http') ? img0 : buildUpload(`/properties/${img0}`)) : '/default-property.jpg';
          const extraImageCount = (property.images?.length || 0) - 1;
          return (
            <div
              key={property._id}
              className={`favorite-card ${removingIds.has(property._id)?'removing':''} ${selectMode && selected.has(property._id)?'selected':''}`}
            >
              <div
                className={`favorite-icon ${removingIds.has(property._id)?'is-removing':''}`}
                role="button"
                tabIndex={0}
                title="Remove from favorites"
                aria-label="Remove from favorites"
                onClick={(e)=>{ e.stopPropagation(); if(selectMode){ toggleSelect(property._id); return; } handleRemoveFavorite(property._id); }}
                onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); e.stopPropagation(); if(selectMode){ toggleSelect(property._id); return; } handleRemoveFavorite(property._id); } }}
              >
                {removingIds.has(property._id) ? <FaRegHeart aria-hidden="true"/> : <FaHeart aria-hidden="true"/>}
                <span className="visually-hidden">Remove favorite</span>
              </div>
              {selectMode && (
                <label className="fav-check" onClick={e=> e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(property._id)} onChange={()=>toggleSelect(property._id)} />
                  <span />
                </label>
              )}
              <div
                onClick={() => navigate(`/property/${property._id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="favorite-badge" title={property.category}>{property.category}</div>
                <div className="favorite-images">
                  <img
                    src={imageSrc}
                    alt={property.title}
                    className="favorite-image"
                    loading="lazy"
                    decoding="async"
                  />
                  {extraImageCount > 0 && (
                    <span className="image-count" aria-label={`+${extraImageCount} more photos`}>+{extraImageCount}</span>
                  )}
                  <div className="favorite-price">₱{property.price?.toLocaleString()}</div>
                  <div className="fav-hover-overlay">View Details</div>
                </div>
                <div className="favorite-details">
                  <h3>{property.title}</h3>
                  <p className="favorite-location">{property.barangay}</p>
                  <div className="favorite-meta" aria-label="Property features">
                    {property.numberOfRooms > 0 && (
                      <span><FaBed /> {property.numberOfRooms} {property.numberOfRooms>1?'Rooms':'Room'}</span>
                    )}
                    {property.areaSqm > 0 && (
                      <span><FaRulerCombined /> {property.areaSqm} sqm</span>
                    )}
                    {property.petFriendly && (
                      <span className="pet-ok"><FaDog /> Pets OK</span>
                    )}
                    {property.parking && (
                      <span><FaParking /> Parking</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
            })}
          </div>
          <div className="favorites-pagination" role="navigation" aria-label="Favorites pages">
            <button type="button" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Prev</button>
            <span className="page-status">Page {page} / {totalPages}</span>
            <button type="button" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Favorites;