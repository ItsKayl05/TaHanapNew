import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import TenantSidebar from '../TenantDashboard/TenantSidebar/TenantSidebar';
import { buildApi } from '../services/apiConfig';

const SJDM_CENTER = [14.8136, 121.0450]; // Approximate center of San Jose del Monte, Bulacan
const SJDM_ZOOM = 13;

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const fetchProperties = async () => {
  const res = await fetch(buildApi('/properties')); // Use buildApi for consistent API calls
  if (!res.ok) return [];
  return await res.json();
};

const MapPage = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProperties().then(data => { 
      setProperties(data); 
      setLoading(false); 
    });
  }, []);

  // SJDM bounding box (approximate):
  // North: 14.8700, South: 14.7600, West: 121.0100, East: 121.0900
  const SJDM_BOUNDS = {
    north: 14.8700,
    south: 14.7600,
    west: 121.0100,
    east: 121.0900
  };

  const isInSJDM = (lat, lng) => {
    lat = parseFloat(lat); 
    lng = parseFloat(lng);
    return lat >= SJDM_BOUNDS.south && lat <= SJDM_BOUNDS.north && lng >= SJDM_BOUNDS.west && lng <= SJDM_BOUNDS.east;
  };

  const handleLogout = () => {
    // Example logout logic: clear localStorage and redirect
    localStorage.clear();
    window.location.href = '/login';
  };

  // Create a custom icon (optional - if you want different styling)
  const createCustomIcon = (color = 'red') => {
    return new L.Icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
  };

  return (
    <div className="dashboard-container tenant-dashboard" style={{minHeight:'100vh', display:'flex'}}>
      <div style={{width:'260px', minWidth:'220px', height:'100vh', background:'#fff', boxShadow:'0 2px 16px rgba(0,0,0,0.07)', zIndex:2, position:'sticky', top:0}}>
        <TenantSidebar activeItem="map" handleLogout={handleLogout} />
      </div>
      <div className="tenant-main property-map-main" style={{flexGrow:1, padding:'32px 0', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', overflow:'auto'}}>
        <h2 style={{textAlign:'center', marginBottom:'24px'}}>All Properties in SJDM</h2>
        <div style={{width:'100%', maxWidth:'900px', background:'#fff', borderRadius:'16px', boxShadow:'0 2px 16px rgba(0,0,0,0.07)', padding:'32px', margin:'0 auto'}}>
          <div style={{minHeight:'400px', maxHeight:'600px', width:'100%', border:'1px solid #ccc', borderRadius:'12px', overflow:'hidden', background:'#fafafa'}}>
            <MapContainer 
              center={SJDM_CENTER} 
              zoom={SJDM_ZOOM} 
              style={{maxHeight:'100%', minHeight:'400px', width:'100%'}}
              scrollWheelZoom={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              {properties
                .filter(prop => prop.latitude && prop.longitude && isInSJDM(prop.latitude, prop.longitude))
                .map((prop) => (
                  <Marker 
                    key={prop._id} 
                    position={[parseFloat(prop.latitude), parseFloat(prop.longitude)]}
                    // Optional: Use custom icon
                    // icon={createCustomIcon('blue')}
                  >
                    <Popup>
                      <div style={{minWidth: '200px'}}>
                        <strong style={{fontSize: '16px', marginBottom: '8px', display: 'block'}}>
                          {prop.title}
                        </strong>
                        <p style={{margin: '4px 0', fontSize: '14px'}}>
                          📍 {prop.address}
                        </p>
                        {prop.price && (
                          <p style={{margin: '4px 0', fontSize: '14px', fontWeight: 'bold', color: '#2e7d32'}}>
                            💰 ₱{prop.price.toLocaleString()}
                          </p>
                        )}
                        {prop.type && (
                          <p style={{margin: '4px 0', fontSize: '12px', color: '#666'}}>
                            🏠 {prop.type}
                          </p>
                        )}
                        <a 
                          href={`/property/${prop._id}`} 
                          style={{
                            display: 'inline-block',
                            marginTop: '8px',
                            padding: '6px 12px',
                            backgroundColor: '#1976d2',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '4px',
                            fontSize: '14px',
                            textAlign: 'center'
                          }}
                        >
                          View Details
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                )
              )}
            </MapContainer>
          </div>
          {loading && (
            <div style={{textAlign:'center', marginTop:'18px', fontSize: '16px'}}>
              Loading properties...
            </div>
          )}
          {!loading && properties.length === 0 && (
            <div style={{textAlign:'center', marginTop:'18px', fontSize: '16px'}}>
              No properties found.
            </div>
          )}
          {!loading && properties.length > 0 && (
            <div style={{
              textAlign: 'center', 
              marginTop: '18px', 
              fontSize: '14px', 
              color: '#666'
            }}>
              Showing {properties.filter(prop => prop.latitude && prop.longitude && isInSJDM(prop.latitude, prop.longitude)).length} properties in San Jose del Monte
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapPage;