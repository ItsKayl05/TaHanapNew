import React, { useEffect, useState } from 'react';
import './RentalRequests.css';
import { useParams } from 'react-router-dom';
import { fetchApplicationsByProperty, approveApplication, rejectApplication } from '../../../services/application/ApplicationService';
import { normalizePayload, buildApi } from '../../../services/apiConfig';
import { toast } from 'react-toastify';
import { FaUserCircle, FaCheckCircle, FaTimesCircle, FaClock, FaArrowLeft, FaPhone, FaEnvelope } from 'react-icons/fa';

const RentalRequests = () => {
  const { propertyId } = useParams();
  const [apps, setApps] = useState([]);
  const [property, setProperty] = useState(null);

  const load = async () => {
    try {
      const res = await fetchApplicationsByProperty(propertyId);
      const appsPayload = normalizePayload(res, ['applications', 'data', 'result', 'messages']);
      setApps(appsPayload || []);
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
      if (res && res.property) setProperty(res.property);
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

  const safePending = Array.isArray(apps) ? apps.filter(a => (a.status || '').toLowerCase() === 'pending') : [];
  const safeApproved = Array.isArray(apps) ? apps.filter(a => (a.status || '').toLowerCase() === 'approved') : [];
  const safeRejected = Array.isArray(apps) ? apps.filter(a => (a.status || '').toLowerCase() === 'rejected') : [];

  return (
    <div className="rental-requests-container">
      <div className="rental-requests-content">
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
                <strong>Status:</strong> {property.availabilityStatus || 'Unknown'}
              </div>
            </div>
          </div>
        )}

        <div className="requests-sections">
          {/* Pending Applications Section */}
          <section className="request-section">
            <h3>Pending Applications ({safePending.length})</h3>
            {safePending.map(a => (
              <div key={a._id} className="app-row">
                <div className="app-row-header">
                  <FaClock className="status-icon pending" />
                  <span className="status pending">Pending</span>
                </div>

                <div className="tenant-info-row">
                  {a.tenant?.profilePic ? (
                    <img src={a.tenant.profilePic} alt={a.tenant.fullName} className="tenant-avatar" />
                  ) : (
                    <FaUserCircle className="tenant-avatar-placeholder" />
                  )}
                  <div className="tenant-meta">
                    <strong className="tenant-name">{a.tenant?.fullName || 'Property Seeker'}</strong>
                    <div className="tenant-contacts">
                      {a.tenant?.contactNumber && (
                        <a href={`tel:${a.tenant.contactNumber}`} className="tenant-contact">
                          <FaPhone className="contact-icon" /> {a.tenant.contactNumber}
                        </a>
                      )}
                      {a.tenant?.email && (
                        <a href={`mailto:${a.tenant.email}`} className="tenant-contact">
                          <FaEnvelope className="contact-icon" /> {a.tenant.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {a.message && (
                  <p className="app-message">{a.message}</p>
                )}

                <div className="date-container">
                  <span className="date-line">
                    <span className="date-label">Applied on:</span> {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>

                <div className="actions">
                  <button 
                    onClick={() => handleApprove(a._id)} 
                    disabled={property && property.availabilityStatus === 'Not Available'}
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

          {/* Approved Applications Section */}
          <section className="request-section">
            <h3>Approved Applications ({safeApproved.length})</h3>
            {safeApproved.map(a => (
              <div key={a._id} className="app-row">
                <div className="app-row-header">
                  <FaCheckCircle className="status-icon approved" />
                  <span className="status approved">Approved</span>
                </div>

                <div className="tenant-info-row">
                  {a.tenant?.profilePic ? (
                    <img src={a.tenant.profilePic} alt={a.tenant.fullName} className="tenant-avatar" />
                  ) : (
                    <FaUserCircle className="tenant-avatar-placeholder" />
                  )}
                  <div className="tenant-meta">
                    <strong className="tenant-name">{a.tenant?.fullName || 'Property Seeker'}</strong>
                    <div className="tenant-contacts">
                      {a.tenant?.contactNumber && (
                        <a href={`tel:${a.tenant.contactNumber}`} className="tenant-contact">
                          <FaPhone className="contact-icon" /> {a.tenant.contactNumber}
                        </a>
                      )}
                      {a.tenant?.email && (
                        <a href={`mailto:${a.tenant.email}`} className="tenant-contact">
                          <FaEnvelope className="contact-icon" /> {a.tenant.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {a.message && (
                  <p className="app-message">{a.message}</p>
                )}

                <div className="date-container">
                  <span className="date-line">
                    <span className="date-label">Applied on:</span> {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}
                  </span>
                  <span className="date-line">
                    <span className="date-label">Approved on:</span> {a.actedAt ? new Date(a.actedAt).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>
            ))}
            {safeApproved.length === 0 && (
              <p className="no-apps">No approved applications</p>
            )}
          </section>

          {/* Rejected Applications Section */}
          <section className="request-section">
            <h3>Rejected Applications ({safeRejected.length})</h3>
            {safeRejected.map(a => (
              <div key={a._id} className="app-row">
                <div className="app-row-header">
                  <FaTimesCircle className="status-icon rejected" />
                  <span className="status rejected">Rejected</span>
                </div>

                <div className="tenant-info-row">
                  {a.tenant?.profilePic ? (
                    <img src={a.tenant.profilePic} alt={a.tenant.fullName} className="tenant-avatar" />
                  ) : (
                    <FaUserCircle className="tenant-avatar-placeholder" />
                  )}
                  <div className="tenant-meta">
                    <strong className="tenant-name">{a.tenant?.fullName || 'Property Seeker'}</strong>
                    <div className="tenant-contacts">
                      {a.tenant?.contactNumber && (
                        <a href={`tel:${a.tenant.contactNumber}`} className="tenant-contact">
                          <FaPhone className="contact-icon" /> {a.tenant.contactNumber}
                        </a>
                      )}
                      {a.tenant?.email && (
                        <a href={`mailto:${a.tenant.email}`} className="tenant-contact">
                          <FaEnvelope className="contact-icon" /> {a.tenant.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {a.message && (
                  <p className="app-message">{a.message}</p>
                )}

                <div className="date-container">
                  <span className="date-line">
                    <span className="date-label">Applied on:</span> {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}
                  </span>
                  <span className="date-line">
                    <span className="date-label">Rejected on:</span> {a.actedAt ? new Date(a.actedAt).toLocaleDateString() : ''}
                  </span>
                </div>
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