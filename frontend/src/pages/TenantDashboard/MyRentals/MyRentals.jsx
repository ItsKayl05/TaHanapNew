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

  return (
    <div className="dashboard-container">
      <TenantSidebar />
      <div className="main-content tenant-my-rentals page">
        <h2>My Rentals</h2>
        <div className="tabs">
          <button onClick={() => setTab('Pending')} className={tab==='Pending'? 'active':''}><FaClock style={{marginRight:4}}/>Pending</button>
          <button onClick={() => setTab('Approved')} className={tab==='Approved'? 'active':''}><FaCheckCircle style={{marginRight:4}}/>Approved</button>
          <button onClick={() => setTab('History')} className={tab==='History'? 'active':''}><FaTimesCircle style={{marginRight:4}}/>History / Rejected</button>
        </div>

        <div className="tab-content">
          {grouped[tab].length === 0 && <p className="no-apps">No items</p>}
          {grouped[tab].map(app => (
            <div key={app._id} className="app-row">
              <div className="app-row-header">
                {app.status === 'Pending' && <FaClock className="status-icon pending" />}
                {app.status === 'Approved' && <FaCheckCircle className="status-icon approved" />}
                {app.status === 'Rejected' && <FaTimesCircle className="status-icon rejected" />}
                <span className={`status-badge ${app.status.toLowerCase()}`}>{app.status}</span>
                <h4><FaHome style={{marginRight:6}}/>{app.property?.title || 'Property'}</h4>
              </div>
              <p><FaUser style={{marginRight:4}}/>Landlord: {app.landlord?.fullName || ''}</p>
              <div className="actions">
                <button onClick={() => navigate(`/property/${app.property?._id}`)}><FaHome style={{marginRight:4}}/>View Property</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MyRentals;
