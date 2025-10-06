import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useLocation } from 'react-router-dom';
import Sidebar from './LandLordDashboard/Sidebar/Sidebar';
import TenantSidebar from './TenantDashboard/TenantSidebar/TenantSidebar';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import { buildApi } from '../services/apiConfig';

const SJDM_CENTER = [14.8136, 121.0450];
const SJDM_ZOOM = 13;

const fetchProperties = async () => {
  const res = await fetch(buildApi('/properties'));
  if (!res.ok) return [];
  return await res.json();
};

const PropertyMap = () => {
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: markerIcon2x,
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
    });
  }, []);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const isTenant = location.pathname === '/map';
  useEffect(() => {
    fetchProperties().then(data => { setProperties(data); setLoading(false); });
  }, []);
  // SJDM bounding box (approximate):
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
    localStorage.clear();
    window.location.href = '/login';
  };
  return (
    <div className={isTenant ? "dashboard-container tenant-dashboard" : "dashboard-container landlord-dashboard"} style={{minHeight:'100vh', display:'flex'}}>
      {isTenant ? (
        <div style={{width:'260px', minWidth:'220px', height:'100vh', background:'#fff', boxShadow:'0 2px 16px rgba(0,0,0,0.07)', zIndex:2, position:'sticky', top:0}}>
          <TenantSidebar activeItem="map" handleLogout={handleLogout} />
        </div>
      ) : (
        <div style={{width:'260px', minWidth:'220px', height:'100vh', background:'#fff', boxShadow:'0 2px 16px rgba(0,0,0,0.07)', zIndex:2, position:'sticky', top:0}}>
          <Sidebar activeItem="property-map" handleLogout={handleLogout} />
        </div>
      )}
      <div className={isTenant ? "tenant-main property-map-main" : "landlord-main property-map-main"} style={{flexGrow:1, padding:'32px 0', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', overflow:'auto'}}>
        <h2 style={{textAlign:'center', marginBottom:'24px'}}>All Properties in SJDM</h2>
        <div style={{width:'100%', maxWidth:'900px', background:'#fff', borderRadius:'16px', boxShadow:'0 2px 16px rgba(0,0,0,0.07)', padding:'32px', margin:'0 auto'}}>
          <div style={{minHeight:'400px', maxHeight:'600px', width:'100%', border:'1px solid #ccc', borderRadius:'12px', overflow:'hidden', background:'#fafafa'}}>
            <MapContainer center={SJDM_CENTER} zoom={SJDM_ZOOM} style={{maxHeight:'100%', minHeight:'400px', width:'100%'}}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
              {properties.filter(p => p.latitude && p.longitude && isInSJDM(p.latitude, p.longitude)).map((p, i) => (
                <Marker key={p._id || i} position={[parseFloat(p.latitude), parseFloat(p.longitude)]}>
                  <Popup>
                    <strong>{p.title}</strong><br />
                    {p.address}<br />
                    {p.price ? `₱${p.price}` : ''}<br />
                    <a href={`/property/${p._id}`} style={{color:'#1976d2'}}>View Details</a>
                  </Popup>
                </Marker>
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

export default PropertyMap;
