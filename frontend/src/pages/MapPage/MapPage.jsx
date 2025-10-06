import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TenantSidebar from '../TenantDashboard/TenantSidebar/TenantSidebar';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const SJDM_CENTER = [14.8136, 121.0450]; // Approximate center of San Jose del Monte, Bulacan
const SJDM_ZOOM = 13;

const fetchProperties = async () => {
  const res = await fetch('/api/properties'); // Adjust endpoint as needed
  if (!res.ok) return [];
  return await res.json();
};

const MapPage = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProperties().then(data => { setProperties(data); setLoading(false); });
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
    lat = parseFloat(lat); lng = parseFloat(lng);
    return lat >= SJDM_BOUNDS.south && lat <= SJDM_BOUNDS.north && lng >= SJDM_BOUNDS.west && lng <= SJDM_BOUNDS.east;
  };

  const handleLogout = () => {
    // Example logout logic: clear localStorage and redirect
    localStorage.clear();
    window.location.href = '/login';
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
            <MapContainer center={SJDM_CENTER} zoom={SJDM_ZOOM} style={{maxHeight:'100%', minHeight:'400px', width:'100%'}}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              {properties.filter(prop => isInSJDM(prop.latitude, prop.longitude)).map((prop) => (
                prop.latitude && prop.longitude && (
                  <Marker key={prop._id} position={[parseFloat(prop.latitude), parseFloat(prop.longitude)]}>
                    <Popup>
                      <strong>{prop.title}</strong><br />
                      {prop.address}<br />
                      {prop.price ? `₱${prop.price}` : ''}<br />
                      <a href={`/property/${prop._id}`} style={{color:'#1976d2'}}>View Details</a>
                    </Popup>
                  </Marker>
                )
              ))}
            </MapContainer>
          </div>
          {loading && <div style={{textAlign:'center', marginTop:'18px'}}>Loading properties...</div>}
          {!loading && properties.length === 0 && <div style={{textAlign:'center', marginTop:'18px'}}>No properties found.</div>}
        </div>
      </div>
    </div>
  );
};

export default MapPage;