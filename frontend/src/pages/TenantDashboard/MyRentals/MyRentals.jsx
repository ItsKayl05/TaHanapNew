import React, { useEffect, useState } from 'react';
import { fetchMyApplications } from '../../../services/application/ApplicationService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { FaHome, FaUser, FaCheckCircle, FaTimesCircle, FaClock } from 'react-icons/fa';
import './MyRentals.css';
import TenantSidebar from '../TenantSidebar/TenantSidebar';

const MyRentals = () => {
  const [apps, setApps] = useState([]);
  const [tab, setTab] = useState('Pending');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchMyApplications();
        setApps(data);
        // Debug: log lightweight application shapes to aid diagnosis
        try {
          console.debug('MyRentals fetched applications:', data.map(a => ({
            id: a._id || a.id,
            status: a.status,
            propertyPresent: !!(a.property && (a.property._id || a.property.id)),
            propertyId: a.property?._id || a.property?.id,
            propertyTitle: a.property?.title
          })));
        } catch (e) { /* ignore debug errors */ }
      } catch (e) {
        toast.error('Failed to load your applications');
      }
    })();
  }, []);

  const grouped = {
    Pending: apps.filter(a => a.status === 'Pending'),
    Approved: apps.filter(a => a.status === 'Approved'),
    History: apps.filter(a => a.status === 'Rejected' || a.status === 'Approved' && new Date(a.actedAt) < new Date())
  };

  const getPropertyTypeDisplay = (property) => {
    if (!property) return '';
    // Accept multiple possible field names from backend: property_type, propertyType, propertyType
    const raw = property.property_type || property.propertyType || property.propertyType || property.type || '';
    const key = String(raw || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const typeMap = {
      'house': 'House',
      'house_and_lot': 'House and Lot',
      'apartment': 'Apartment',
      'condominium': 'Condominium',
      'townhouse': 'Townhouse',
      'commercial': 'Commercial Space',
      'land': 'Land',
      'bungalow': 'Bungalow',
      'lot': 'Lot'
    };
    return typeMap[key] || (raw ? String(raw) : 'Property');
  };

  const goToProperty = (event, property) => {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
      event.stopPropagation();
    }
    const id = property?._id || property?.id;
    if (!id) {
      toast.info('Property no longer available');
      return;
    }
    const path = `/property/${id}`;
  // No toast: navigation should be silent
    try {
      console.debug('Navigating to property', id, 'path=', path);
      // Use react-router navigation; explicit replace flag false
      navigate(path, { replace: false });
      // If react-router doesn't update the URL quickly (e.g. nested routes or guard), force a full redirect after short delay
      setTimeout(() => {
        try {
          if (window.location.pathname !== path) {
            console.debug('Router did not change path, forcing assign to', path);
            window.location.assign(path);
          }
        } catch (err) {
          console.error('assign fallback failed, using href', err);
          window.location.href = path;
        }
      }, 200);
    } catch (e) {
      console.error('navigate threw, falling back to assign:', e);
      try {
        window.location.assign(path);
      } catch (err) {
        // last resort
        window.location.href = path;
      }
    }
  };

  return (
    <div className="dashboard-container">
      <TenantSidebar />
      <div className="main-content tenant-my-rentals">
        <h2>My Rentals</h2>
        <div className="tabs">
          <button onClick={() => setTab('Pending')} className={tab==='Pending'? 'active':''}>
            <FaClock style={{marginRight:4}}/>Pending
          </button>
          <button onClick={() => setTab('Approved')} className={tab==='Approved'? 'active':''}>
            <FaCheckCircle style={{marginRight:4}}/>Approved
          </button>
          <button onClick={() => setTab('History')} className={tab==='History'? 'active':''}>
            <FaTimesCircle style={{marginRight:4}}/>History / Rejected
          </button>
        </div>

        <div className="tab-content">
          {grouped[tab].length === 0 && <p className="no-apps">No items</p>}
          {grouped[tab].map(app => (
            <div key={app._id} className="app-row">
              <div className="app-row-header">
                <div className="status-section">
                  {app.status === 'Pending' && <FaClock className="status-icon pending" />}
                  {app.status === 'Approved' && <FaCheckCircle className="status-icon approved" />}
                  {app.status === 'Rejected' && <FaTimesCircle className="status-icon rejected" />}
                  <span className={`status-badge ${app.status.toLowerCase()}`}>{app.status}</span>
                </div>
                <h4>
                  <FaHome style={{marginRight:6}}/>
                  { (app.property && (app.property._id || app.property.id)) ? (
                    <>
                      <span>{app.property.title}</span>
                      <span style={{marginLeft:8, color:'#64748b', fontSize:'0.9rem'}}>
                        {getPropertyTypeDisplay(app.property)}
                      </span>
                    </>
                  ) : (
                    <span style={{fontStyle: 'italic', color: '#000'}}>Property removed</span>
                  )}
                </h4>
              </div>
              <p><FaUser style={{marginRight:4}}/>Property Owner: {app.landlord?.fullName || 'Unknown'}</p>
              <div className="actions">
                <button
                  type="button"
                  className="view-property-btn"
                  onClick={(e) => goToProperty(e, app.property)}
                  title={app.property && (app.property._id || app.property.id) ? 'View property' : 'Property may no longer be available'}
                >
                  <FaHome style={{marginRight:4}}/>View Property
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MyRentals;