import React, { useEffect, useState } from 'react';
import './RentalRequests.css';
import { useParams } from 'react-router-dom';
import { fetchApplicationsByProperty, approveApplication, rejectApplication } from '../../../services/application/ApplicationService';
import { normalizePayload, buildApi } from '../../../services/apiConfig';
import { toast } from 'react-toastify';
import { FaUserCircle, FaCheckCircle, FaTimesCircle, FaClock, FaArrowLeft } from 'react-icons/fa';
import LandlordSidebar from '../LandlordSidebar/LandlordSidebar';

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
        const pRes = await fetch(buildApi(`/properties/${propertyId}`));
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

  // Make filters null-safe in case status is missing
  const safePending = Array.isArray(apps) ? apps.filter(a => (a.status || '').toLowerCase() === 'pending') : [];
  const safeApproved = Array.isArray(apps) ? apps.filter(a => (a.status || '').toLowerCase() === 'approved') : [];
  const safeRejected = Array.isArray(apps) ? apps.filter(a => (a.status || '').toLowerCase() === 'rejected') : [];

  return (
    <div className="dashboard-container">
      <LandlordSidebar />
      <div className="main-content rental-requests">
        <button 
          className="back-btn" 
          onClick={() => window.history.back()}
        >
          <FaArrowLeft /> Back to My Properties
        </button>
        
        <h2>Rental Requests</h2>
        
        {property && (
          <div className="property-id-card">
            <FaUserCircle className="property-id-icon" />
            <div className="property-info">
              <div className="property-title-row">
                <span className="property-id-label">Property:</span>
                <strong className="property-name">{property.title || property._id || property}</strong>
              </div>
              <div className="property-units">
                <strong>Available units:</strong> {property.availableUnits !== undefined ? property.availableUnits : 'N/A'}{property.totalUnits ? ` / ${property.totalUnits}` : ''}
              </div>
            </div>
          </div>
        )}

        <div className="requests-sections">
          <section className="request-section">
            <h3>Pending Applications ({safePending.length})</h3>
            {safePending.map(a => (
              <div key={a._id} className="app-row">
                <div className="app-row-header">
                  <FaClock className="status-icon pending" />
                  <span className="status pending">Pending</span>
                  <strong className="tenant-name">{a.tenant?.fullName || 'Tenant'}</strong>
                </div>
                <p className="app-message">
                  {a.message ? a.message : <span className="no-message">No message</span>}
                </p>
                <span className="date">Applied on: {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}</span>
                <div className="actions">
                  <button 
                    onClick={() => handleApprove(a._id)} 
                    disabled={property && typeof property.availableUnits !== 'undefined' && property.availableUnits <= 0}
                    className="approve-btn"
                  >
                    <FaCheckCircle /> Approve
                  </button>
                  <button onClick={() => handleReject(a._id)} className="reject-btn">
                    <FaTimesCircle /> Reject
                  </button>
                </div>
              </div>
            ))}
            {safePending.length === 0 && (
              <p className="no-apps">No pending applications</p>
            )}
          </section>

          <section className="request-section">
            <h3>Approved Applications ({safeApproved.length})</h3>
            {safeApproved.map(a => (
              <div key={a._id} className="app-row">
                <div className="app-row-header">
                  <FaCheckCircle className="status-icon approved" />
                  <span className="status approved">Approved</span>
                  <strong className="tenant-name">{a.tenant?.fullName || 'Tenant'}</strong>
                </div>
                <p className="app-message">
                  {a.message ? a.message : <span className="no-message">No message</span>}
                </p>
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

          <section className="request-section">
            <h3>Rejected Applications ({safeRejected.length})</h3>
            {safeRejected.map(a => (
              <div key={a._id} className="app-row">
                <div className="app-row-header">
                  <FaTimesCircle className="status-icon rejected" />
                  <span className="status rejected">Rejected</span>
                  <strong className="tenant-name">{a.tenant?.fullName || 'Tenant'}</strong>
                </div>
                <p className="app-message">
                  {a.message ? a.message : <span className="no-message">No message</span>}
                </p>
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
    </div>
  );
};

export default RentalRequests;