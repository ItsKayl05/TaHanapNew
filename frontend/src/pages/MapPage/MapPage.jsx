import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TenantSidebar from '../TenantDashboard/TenantSidebar/TenantSidebar';
import { buildApi } from '../../services/apiConfig';

// Fix for Leaflet marker icons - use absolute CDN URLs
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Create custom icon instance
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const SJDM_CENTER = [14.8136, 121.0450];
const SJDM_ZOOM = 13;

const fetchProperties = async () => {
  try {
    const res = await fetch(buildApi('/properties'));
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error('Error fetching properties:', error);
    return [];
  }
};

const MapPage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadProperties = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchProperties();
        setProperties(data);
      } catch (err) {
        setError('Failed to load properties. Please try again later.');
        console.error('Error loading properties:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProperties();
  }, []);

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

  const validProperties = properties.filter(prop => 
    prop && prop.latitude && prop.longitude && isInSJDM(prop.latitude, prop.longitude)
  );

  return (
    <div className="dashboard-container tenant-dashboard" style={{
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: isMobile ? 'column' : 'row'
    }}>
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
          <TenantSidebar activeItem="map" handleLogout={handleLogout} />
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
          <TenantSidebar activeItem="map" handleLogout={handleLogout} />
        </div>
      )}
      
      {/* Main Content */}
      <div className="tenant-main property-map-main" style={{
        flexGrow: 1, 
        padding: isMobile ? '16px 12px 80px 12px' : '32px 0', 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        overflow: 'auto',
        width: isMobile ? '100%' : 'auto'
      }}>
        <h2 style={{
          textAlign: 'center', 
          marginBottom: isMobile ? '16px' : '24px',
          fontSize: isMobile ? '1.3rem' : '1.8rem',
          padding: isMobile ? '0 8px' : '0',
          color: '#1a202c'
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
          {/* Error Display */}
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
          
          {/* Map Container */}
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
              zoomControl={!isMobile}
              tap={!L.Browser.mobile}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              
              {validProperties.map((prop) => (
                <Marker 
                  key={prop._id} 
                  position={[parseFloat(prop.latitude), parseFloat(prop.longitude)]}
                  icon={customIcon}
                >
                  <Popup>
                    <div style={{
                      maxWidth: isMobile ? '250px' : '300px',
                      padding: isMobile ? '8px' : '12px'
                    }}>
                      <strong style={{ 
                        fontSize: isMobile ? '0.9rem' : '1rem',
                        color: '#1a202c',
                        display: 'block',
                        marginBottom: '4px'
                      }}>
                        {prop.title || 'Untitled Property'}
                      </strong>
                      
                      <span style={{ 
                        fontSize: isMobile ? '0.8rem' : '0.9rem',
                        color: '#4a5568',
                        display: 'block',
                        marginBottom: '4px'
                      }}>
                        {prop.address || 'No address provided'}
                      </span>
                      
                      {prop.price && (
                        <span style={{ 
                          fontSize: isMobile ? '0.9rem' : '1rem',
                          fontWeight: 'bold',
                          color: '#2d3748',
                          display: 'block',
                          marginBottom: '8px'
                        }}>
                          ₱{prop.price.toLocaleString()}
                        </span>
                      )}
                      
                      <a 
                        href={`/property/${prop._id}`} 
                        style={{ 
                          color: '#1976d2', 
                          fontSize: isMobile ? '0.8rem' : '0.9rem',
                          textDecoration: 'none',
                          fontWeight: '600',
                          padding: '6px 12px',
                          background: '#f7fafc',
                          borderRadius: '4px',
                          border: '1px solid #e2e8f0',
                          display: 'inline-block'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = '#edf2f7';
                          e.target.style.textDecoration = 'none';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = '#f7fafc';
                          e.target.style.textDecoration = 'none';
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
          
          {/* Loading State */}
          {loading && (
            <div style={{ 
              textAlign: 'center', 
              marginTop: isMobile ? '12px' : '18px', 
              color: '#666',
              fontSize: isMobile ? '0.9rem' : '1rem'
            }}>
              <div>Loading properties...</div>
            </div>
          )}
          
          {/* Empty State */}
          {!loading && !error && validProperties.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              marginTop: isMobile ? '12px' : '18px', 
              color: '#666',
              fontSize: isMobile ? '0.9rem' : '1rem',
              padding: isMobile ? '16px' : '20px'
            }}>
              <div style={{ marginBottom: '8px' }}>
                No properties found in San Jose del Monte area.
              </div>
              {properties.length > 0 && (
                <div style={{ 
                  fontSize: isMobile ? '0.8rem' : '0.9rem', 
                  color: '#718096'
                }}>
                  ({properties.length} properties found but none have valid coordinates in SJDM)
                </div>
              )}
            </div>
          )}
          
          {/* Success State */}
          {!loading && validProperties.length > 0 && (
            <div style={{ 
              textAlign: 'center', 
              marginTop: isMobile ? '12px' : '18px', 
              color: '#666', 
              fontSize: isMobile ? '0.9rem' : '1rem' 
            }}>
              Showing {validProperties.length} properties in San Jose del Monte
            </div>
          )}
        </div>

        {/* Mobile Help Tip */}
        {isMobile && (
          <div style={{
            marginTop: '12px',
            padding: '10px 12px',
            background: '#f8f9fa',
            borderRadius: '8px',
            fontSize: '0.8rem',
            color: '#4a5568',
            textAlign: 'center',
            border: '1px solid #e2e8f0',
            maxWidth: '900px',
            width: '100%'
          }}>
            <span style={{ fontWeight: '600' }}>💡 Tip:</span> Pinch to zoom, drag to move the map
          </div>
        )}
      </div>
    </div>
  );
};

export default MapPage;