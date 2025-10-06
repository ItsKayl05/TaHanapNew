import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useLocation } from 'react-router-dom';
import Sidebar from './LandLordDashboard/Sidebar/Sidebar';
import TenantSidebar from './TenantDashboard/TenantSidebar/TenantSidebar';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { buildApi } from '../services/apiConfig';

const SJDM_CENTER = [14.8136, 121.0450];
const SJDM_ZOOM = 13;

const fetchProperties = async () => {
  try {
    const apiUrl = buildApi('/properties');
    console.log('🔍 Fetching from:', apiUrl);
    
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    });
    
    console.log('📡 Response status:', res.status, res.statusText);
    
    // Check if response is HTML instead of JSON
    const contentType = res.headers.get('content-type');
    console.log('📄 Content-Type:', contentType);
    
    if (!res.ok) {
      console.error('❌ HTTP Error:', res.status);
      const errorText = await res.text();
      console.error('📝 Error response preview:', errorText.substring(0, 200));
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    // If response is not JSON, handle accordingly
    if (!contentType || !contentType.includes('application/json')) {
      const textResponse = await res.text();
      console.warn('⚠️ Expected JSON but got:', textResponse.substring(0, 200));
      
      // Try to parse as JSON anyway (some APIs don't set proper content-type)
      try {
        const parsedData = JSON.parse(textResponse);
        console.log('✅ Successfully parsed as JSON');
        return Array.isArray(parsedData) ? parsedData : (parsedData.data || parsedData.properties || []);
      } catch (parseError) {
        console.error('❌ Failed to parse as JSON:', parseError);
        return [];
      }
    }
    
    const data = await res.json();
    console.log('✅ API Data structure:', data);
    
    // Handle different response structures
    if (Array.isArray(data)) {
      return data;
    } else if (data && Array.isArray(data.data)) {
      return data.data;
    } else if (data && Array.isArray(data.properties)) {
      return data.properties;
    } else {
      console.warn('⚠️ Unexpected data structure:', data);
      return [];
    }
  } catch (error) {
    console.error('💥 Fetch error:', error);
    return [];
  }
};

const PropertyMap = () => {
  useEffect(() => {
    // Fix for default markers
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
        console.log('🔄 Loading properties...');
        
        const data = await fetchProperties();
        console.log('📊 Properties loaded:', data);
        
        setProperties(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('❌ Load error:', err);
        setError(err.message || 'Failed to load properties');
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

  return (
    <div className={isTenant ? "dashboard-container tenant-dashboard" : "dashboard-container landlord-dashboard"} style={{ minHeight: '100vh', display: 'flex' }}>
      {isTenant ? (
        <div style={{ width: '260px', minWidth: '220px', height: '100vh', background: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', zIndex: 2, position: 'sticky', top: 0 }}>
          <TenantSidebar activeItem="map" handleLogout={handleLogout} />
        </div>
      ) : (
        <div style={{ width: '260px', minWidth: '220px', height: '100vh', background: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', zIndex: 2, position: 'sticky', top: 0 }}>
          <Sidebar activeItem="property-map" handleLogout={handleLogout} />
        </div>
      )}
      
      <div className={isTenant ? "tenant-main property-map-main" : "landlord-main property-map-main"} style={{ flexGrow: 1, padding: '32px 0', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>All Properties in SJDM</h2>
        
        <div style={{ width: '100%', maxWidth: '900px', background: '#fff', borderRadius: '16px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', padding: '32px', margin: '0 auto' }}>
          {error && (
            <div style={{ textAlign: 'center', color: 'red', marginBottom: '16px' }}>
              {error}
            </div>
          )}
          
          <div style={{ minHeight: '400px', maxHeight: '600px', width: '100%', border: '1px solid #ccc', borderRadius: '12px', overflow: 'hidden', background: '#fafafa' }}>
            <MapContainer 
              center={SJDM_CENTER} 
              zoom={SJDM_ZOOM} 
              style={{ maxHeight: '100%', minHeight: '400px', width: '100%' }}
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
                    <strong>{p.title || 'Untitled Property'}</strong><br />
                    {p.address || 'No address provided'}<br />
                    {p.price ? `₱${p.price}` : 'Price not available'}<br />
                    <a href={`/property/${p._id}`} style={{ color: '#1976d2' }}>
                      View Details
                    </a>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          
          {loading && (
            <div style={{ textAlign: 'center', marginTop: '18px' }}>
              Loading properties...
            </div>
          )}
          
          {!loading && !error && validProperties.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '18px' }}>
              No properties found in San Jose del Monte area.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyMap;