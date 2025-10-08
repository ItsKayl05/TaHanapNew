import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useLocation } from 'react-router-dom';
import Sidebar from './LandLordDashboard/Sidebar/Sidebar';
import TenantSidebar from './TenantDashboard/TenantSidebar/TenantSidebar';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { buildApi, apiRequest } from '../services/apiConfig';

const SJDM_CENTER = [14.8136, 121.0450];
const SJDM_ZOOM = 13;

const fetchProperties = async () => {
  try {
    console.log('🔄 Starting properties fetch...');
    
    // Use the enhanced apiRequest instead of direct fetch
    const data = await apiRequest('/properties');
    console.log('✅ Properties data received:', data);
    
    // Handle different response structures
    if (Array.isArray(data)) {
      return data;
    } else if (data && Array.isArray(data.data)) {
      return data.data;
    } else if (data && Array.isArray(data.properties)) {
      return data.properties;
    } else if (data && data.success !== false) {
      // If it's an object but not an error, try to extract array
      const possibleArrays = Object.values(data).filter(Array.isArray);
      return possibleArrays[0] || [];
    } else {
      console.warn('⚠️ Unexpected data structure, returning empty array');
      return [];
    }
  } catch (error) {
    console.error('❌ fetchProperties failed:', error);
    
    // Fallback: try direct fetch as last resort
    try {
      console.log('🔄 Trying direct fetch fallback...');
      const apiUrl = buildApi('/properties');
      const res = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (res.ok) {
        const fallbackData = await res.json();
        console.log('✅ Fallback fetch successful');
        return Array.isArray(fallbackData) ? fallbackData : [];
      }
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError);
    }
    
    return [];
  }
};

const PropertyMap = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Fix for default markers in react-leaflet
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });
  }, []);

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();
  const isTenant = location.pathname === '/map';

  useEffect(() => {
    const loadProperties = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('🔧 Loading property map...');
        
        const data = await fetchProperties();
        console.log(`📊 Loaded ${data.length} properties`);
        
        setProperties(Array.isArray(data) ? data : []);
        
        if (data.length === 0) {
          setError('No properties found. The database might be empty or there might be a server issue.');
        }
      } catch (err) {
        console.error('💥 Error loading properties:', err);
        setError(err.message || 'Failed to load properties. Please try again later.');
        setProperties([]);
      } finally {
        setLoading(false);
      }
    };

    loadProperties();
  }, []);

  // SJDM bounding box (approximate):
  const SJDM_BOUNDS = {
    north: 14.8700,
    south: 14.7600,
    west: 121.0100,
    east: 121.0900
  };

  const isInSJDM = (lat, lng) => {
    if (!lat || !lng) return false;
    
    try {
      lat = parseFloat(lat);
      lng = parseFloat(lng);
      return lat >= SJDM_BOUNDS.south && lat <= SJDM_BOUNDS.north && 
             lng >= SJDM_BOUNDS.west && lng <= SJDM_BOUNDS.east;
    } catch {
      return false;
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  // Filter valid properties with coordinates
  const validProperties = Array.isArray(properties) 
    ? properties.filter(p => p && p.latitude && p.longitude && isInSJDM(p.latitude, p.longitude))
    : [];

  // Debug current API config
  useEffect(() => {
    console.log('🔧 Current API Configuration:', {
      API_BASE: window.__APP_API_CONFIG__?.API_BASE,
      currentPage: window.location.href,
      isTenant: location.pathname === '/map'
    });
  }, []);

  return (
    <div className={isTenant ? "dashboard-container tenant-dashboard" : "dashboard-container landlord-dashboard"} style={{ minHeight: '100vh', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
      {/* Sidebar */}
      {isMobile ? (
        // Mobile: Bottom navigation
        <div style={{ 
          width: '100%', 
          height: 'auto', 
          background: '#fff', 
          boxShadow: '0 -2px 16px rgba(0,0,0,0.07)', 
          zIndex: 2, 
          position: 'fixed', 
          bottom: 0,
          left: 0,
          borderTop: '1px solid #e0e0e0'
        }}>
          {isTenant ? (
            <TenantSidebar activeItem="map" handleLogout={handleLogout} />
          ) : (
            <Sidebar activeItem="property-map" handleLogout={handleLogout} />
          )}
        </div>
      ) : (
        // Desktop: Side navigation
        <div style={{ 
          width: '260px', 
          minWidth: '220px', 
          height: '100vh', 
          background: '#fff', 
          boxShadow: '0 2px 16px rgba(0,0,0,0.07)', 
          zIndex: 2, 
          position: 'sticky', 
          top: 0 
        }}>
          {isTenant ? (
            <TenantSidebar activeItem="map" handleLogout={handleLogout} />
          ) : (
            <Sidebar activeItem="property-map" handleLogout={handleLogout} />
          )}
        </div>
      )}
      
      {/* Main Content */}
      <div 
        className={isTenant ? "tenant-main property-map-main" : "landlord-main property-map-main"} 
        style={{ 
          flexGrow: 1, 
          padding: isMobile ? '16px 12px 80px 12px' : '32px 0', 
          minHeight: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          overflow: 'auto',
          width: isMobile ? '100%' : 'auto'
        }}
      >
        <h2 style={{ 
          textAlign: 'center', 
          marginBottom: isMobile ? '16px' : '24px',
          fontSize: isMobile ? '1.3rem' : '1.8rem',
          padding: isMobile ? '0 8px' : '0'
        }}>
          All Properties in SJDM
        </h2>
        
        <div style={{ 
          width: '100%', 
          maxWidth: '900px', 
          background: '#fff', 
          borderRadius: isMobile ? '12px' : '16px', 
          boxShadow: '0 2px 16px rgba(0,0,0,0.07)', 
          padding: isMobile ? '20px 16px' : '32px', 
          margin: '0 auto' 
        }}>
          {error && (
            <div style={{ 
              textAlign: 'center', 
              color: '#d32f2f', 
              marginBottom: '16px', 
              padding: '12px',
              background: '#ffebee',
              borderRadius: '8px',
              border: '1px solid #ffcdd2',
              fontSize: isMobile ? '0.9rem' : '1rem'
            }}>
              <strong>Error:</strong> {error}
              <br />
              <button 
                onClick={() => window.location.reload()}
                style={{ 
                  marginTop: '8px',
                  padding: isMobile ? '6px 12px' : '8px 16px', 
                  background: '#1976d2', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: isMobile ? '0.8rem' : '0.9rem'
                }}
              >
                Try Again
              </button>
            </div>
          )}
          
          <div style={{ 
            minHeight: isMobile ? '300px' : '400px', 
            maxHeight: isMobile ? '450px' : '600px', 
            width: '100%', 
            border: '1px solid #ccc', 
            borderRadius: isMobile ? '8px' : '12px', 
            overflow: 'hidden', 
            background: '#fafafa' 
          }}>
            <MapContainer 
              center={SJDM_CENTER} 
              zoom={isMobile ? 12 : SJDM_ZOOM} 
              style={{ 
                maxHeight: '100%', 
                minHeight: isMobile ? '300px' : '400px', 
                width: '100%' 
              }}
              zoomControl={!isMobile} // Hide zoom control on mobile for better touch experience
              tap={!L.Browser.mobile} // Improve touch interaction on mobile
            >
              <TileLayer 
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                attribution="&copy; OpenStreetMap contributors" 
              />
              
              {validProperties.map((p, i) => (
                <Marker 
                  key={p._id || i} 
                  position={[parseFloat(p.latitude), parseFloat(p.longitude)]}
                >
                  <Popup>
                    <div style={{
                      maxWidth: isMobile ? '250px' : '300px',
                      padding: isMobile ? '8px' : '12px'
                    }}>
                      <strong style={{ fontSize: isMobile ? '0.9rem' : '1rem' }}>
                        {p.title || 'Untitled Property'}
                      </strong>
                      <br />
                      <span style={{ fontSize: isMobile ? '0.8rem' : '0.9rem' }}>
                        {p.address || 'No address provided'}
                      </span>
                      <br />
                      <span style={{ 
                        fontSize: isMobile ? '0.8rem' : '0.9rem',
                        fontWeight: 'bold',
                        color: '#1976d2'
                      }}>
                        {p.price ? `₱${p.price.toLocaleString()}` : 'Price not available'}
                      </span>
                      <br />
                      <a 
                        href={`/property/${p._id}`} 
                        style={{ 
                          color: '#1976d2', 
                          fontSize: isMobile ? '0.8rem' : '0.9rem',
                          textDecoration: 'underline'
                        }}
                      >
                        View Details
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          
          {loading && (
            <div style={{ 
              textAlign: 'center', 
              marginTop: isMobile ? '12px' : '18px', 
              color: '#666',
              fontSize: isMobile ? '0.8rem' : '0.9rem'
            }}>
              <div>Loading properties...</div>
              {!isMobile && (
                <small>Checking: {window.__APP_API_CONFIG__?.API_BASE}/api/properties</small>
              )}
            </div>
          )}
          
          {!loading && !error && validProperties.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              marginTop: isMobile ? '12px' : '18px', 
              color: '#666',
              fontSize: isMobile ? '0.8rem' : '0.9rem'
            }}>
              No properties found in San Jose del Monte area.
              {properties.length > 0 && (
                <div style={{ 
                  fontSize: isMobile ? '0.75em' : '0.9em', 
                  marginTop: '8px' 
                }}>
                  ({properties.length} properties found but none have valid coordinates in SJDM)
                </div>
              )}
            </div>
          )}
          
          {!loading && validProperties.length > 0 && (
            <div style={{ 
              textAlign: 'center', 
              marginTop: isMobile ? '12px' : '18px', 
              color: '#666', 
              fontSize: isMobile ? '0.8rem' : '0.9rem' 
            }}>
              Showing {validProperties.length} properties in San Jose del Monte
            </div>
          )}
        </div>

        {/* Mobile Map Controls Info */}
        {isMobile && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: '#f8f9fa',
            borderRadius: '8px',
            fontSize: '0.75rem',
            color: '#666',
            textAlign: 'center',
            border: '1px solid #e9ecef'
          }}>
            💡 <strong>Tip:</strong> Pinch to zoom, drag to move the map
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyMap;