import React, { useState, useEffect } from 'react';
import './DashboardSidebar.css';

const DashboardSidebar = ({
  variant = 'landlord',
  links = [],
  onNavigate,
  onLogout,
  verification,
  sidebarOpen,
  setSidebarOpen
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // Auto-close sidebar on mobile when resizing to desktop
      if (!mobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen, setSidebarOpen]);

  const brandTitle = variant === 'landlord' ? 'TaHanap Landlord' : 'TaHanap Tenant';

  const statusPill = (() => {
    if (!verification) return null;
    const { status } = verification;
    if (status === 'verified') return <span className="verified">Verified</span>;
    if (status === 'rejected') return <span className="rejected">Rejected</span>;
    if (status === 'pending') return <span className="pending">Pending</span>;
    return <span className="pending">Not Verified</span>;
  })();

  const handleLinkClick = (to, locked) => {
    if (!locked && onNavigate) {
      onNavigate(to);
      // Close sidebar on mobile after navigation
      if (isMobile) {
        setSidebarOpen(false);
      }
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <>
      {/* BURGER TOGGLE - Shows on both mobile and desktop */}
      <button 
        className={`burger-toggle ${sidebarOpen ? 'open' : ''} ${isMobile ? 'mobile' : 'desktop'}`}
        onClick={toggleSidebar}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* OVERLAY - Shows when sidebar is open on mobile */}
      {isMobile && sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* SIDEBAR - Works for both mobile and desktop */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''} ${isMobile ? 'mobile' : 'desktop'}`}>
        <div className="sidebar-header">
          <h2>{brandTitle}</h2>
          {verification && <div className="verification-pill">{statusPill}</div>}
        </div>
        
        <nav className="sidebar-nav">
          {links.map(link => (
            <div
              key={link.key}
              className={`nav-item ${link.active ? 'active' : ''} ${link.locked ? 'locked' : ''}`}
              onClick={() => handleLinkClick(link.to, link.locked)}
            >
              <span>{link.label}</span>
              {link.locked && <span className="lock">🔒</span>}
            </div>
          ))}
        </nav>
        
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </>
  );
};

export default DashboardSidebar;