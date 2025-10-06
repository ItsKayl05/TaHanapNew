import React, { useEffect, useState } from 'react';
import './RentalRequests.css';
import { useParams } from 'react-router-dom';
import { fetchApplicationsByProperty, approveApplication, rejectApplication } from '../../../services/application/ApplicationService';
import { normalizePayload } from '../../../services/apiConfig';
import { toast } from 'react-toastify';
import { FaUserCircle, FaCheckCircle, FaTimesCircle, FaClock } from 'react-icons/fa';


const RentalRequests = () => {
  const { propertyId } = useParams();
  const [apps, setApps] = useState([]);
  const [property, setProperty] = useState(null);

  const load = async () => {
    try {
      const res = await fetchApplicationsByProperty(propertyId);
  // Normalize response using helper (accepts common keys like data/result/applications/messages)
  const appsPayload = normalizePayload(res, ['applications', 'data', 'result', 'messages']);
  setApps(appsPayload || []);
      // Fetch property details to get availableUnits/totalUnits
      try {
        const pRes = await fetch(`/api/properties/${propertyId}`);
        if (pRes.ok) {
          const pdata = await pRes.json();
          setProperty(pdata);
        } else {
          setProperty({ id: propertyId });
        }
      } catch (err) {
        setProperty({ id: propertyId });
      }
    } catch (e) {
      toast.error('Failed to load applications');
    }
  };

  useEffect(() => { load(); }, [propertyId]);

  const handleApprove = async (id) => {
    try {
      const res = await approveApplication(id);
      toast.success('Approved');
      // If backend returned updated property, update local property state
      if (res && res.property) setProperty(res.property);
      // reload applications list
      load();
    } catch (e) { toast.error('Approve failed'); }
  };

  const handleReject = async (id) => {
    try {
      await rejectApplication(id);
      toast.success('Rejected');
      load();
    } catch (e) { toast.error('Reject failed'); }
  };

  const pending = apps.filter(a => a.status.toLowerCase() === 'pending');
  const approved = apps.filter(a => a.status.toLowerCase() === 'approved');
  const rejected = apps.filter(a => a.status.toLowerCase() === 'rejected');
  // Make filters null-safe in case status is missing
  const safePending = Array.isArray(apps) ? apps.filter(a => (a.status || '').toLowerCase() === 'pending') : [];
  const safeApproved = Array.isArray(apps) ? apps.filter(a => (a.status || '').toLowerCase() === 'approved') : [];
  const safeRejected = Array.isArray(apps) ? apps.filter(a => (a.status || '').toLowerCase() === 'rejected') : [];

  return (
    <div className="dashboard-container rental-requests">
      <div className="main-content">
        <button className="back-btn" onClick={() => window.location.href = '/my-properties'} style={{marginBottom: '1.5rem', background: '#f3f4f6', border: 'none', borderRadius: '8px', padding: '0.5rem 1.2rem', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px'}}>
          <span style={{fontSize: '1.2em', marginRight: '4px'}}>&larr;</span> Back to My Properties
        </button>
        <h2>Rental Requests</h2>
        {property && (
          <div className="property-id-card">
            <FaUserCircle className="property-id-icon" />
            <div style={{display:'flex', flexDirection:'column'}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <span className="property-id-label">Property:</span>
                <strong style={{fontSize:'1rem'}}>{property.title || property._id || property}</strong>
              </div>
              <div style={{marginTop:6}}>
                <strong>Available units:</strong> {property.availableUnits !== undefined ? property.availableUnits : 'N/A'}{property.totalUnits ? ` / ${property.totalUnits}` : ''}
              </div>
            </div>
          </div>
        )}
        <section>
          <h3>Pending Applications ({safePending.length})</h3>
          {safePending.map(a => (
            <div key={a._id} className="app-row">
              <div className="app-row-header">
                <FaClock className="status-icon pending" />
                <span className="status pending">Pending</span>
                <strong>{a.tenant?.fullName || 'Tenant'}</strong>
              </div>
              <p className="app-message">{a.message ? a.message : <span className="no-message">No message</span>}</p>
              <span className="date">Applied on: {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}</span>
              <div className="actions">
                <button onClick={() => handleApprove(a._id)} disabled={property && typeof property.availableUnits !== 'undefined' && property.availableUnits <= 0}><FaCheckCircle /> Approve</button>
                <button onClick={() => handleReject(a._id)}><FaTimesCircle /> Reject</button>
              </div>
            </div>
          ))}
          {safePending.length === 0 && (
            <p className="no-apps">No pending applications</p>
          )}
        </section>
        <section>
          <h3>Approved Applications ({safeApproved.length})</h3>
          {safeApproved.map(a => (
            <div key={a._id} className="app-row">
              <div className="app-row-header">
                <FaCheckCircle className="status-icon approved" />
                <span className="status approved">Approved</span>
                <strong>{a.tenant?.fullName || 'Tenant'}</strong>
              </div>
              <p className="app-message">{a.message ? a.message : <span className="no-message">No message</span>}</p>
              <span className="date">
                Applied on: {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}
                <br />
                Approved on: {a.actedAt ? new Date(a.actedAt).toLocaleDateString() : ''}
              </span>
            </div>
          ))}
          {safeApproved.length === 0 && (
            <p className="no-apps">No approved applications</p>
          )}
        </section>
        <section>
          <h3>Rejected Applications ({safeRejected.length})</h3>
          {safeRejected.map(a => (
            <div key={a._id} className="app-row">
              <div className="app-row-header">
                <FaTimesCircle className="status-icon rejected" />
                <span className="status rejected">Rejected</span>
                <strong>{a.tenant?.fullName || 'Tenant'}</strong>
              </div>
              <p className="app-message">{a.message ? a.message : <span className="no-message">No message</span>}</p>
              <span className="date">
                Applied on: {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}
                <br />
                Rejected on: {a.actedAt ? new Date(a.actedAt).toLocaleDateString() : ''}
              </span>
            </div>
          ))}
          {safeRejected.length === 0 && (
            <p className="no-apps">No rejected applications</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default RentalRequests;
