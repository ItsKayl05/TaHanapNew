import React, { useState, useEffect } from 'react';
import './DashboardSidebar.css';

const DashboardSidebar = ({
  variant = 'landlord',
  links = [],
  onNavigate,
  onLogout,
  verification,
  sidebarOpen = false,
  setSidebarOpen
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(sidebarOpen);

  // Use the external setter if provided, otherwise use internal state
  const setSidebarState = setSidebarOpen || setInternalSidebarOpen;
  const isSidebarOpen = setSidebarOpen ? sidebarOpen : internalSidebarOpen;

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      
      // Only auto-set sidebar state if we have the external setter
      if (setSidebarOpen) {
        if (mobile) {
          setSidebarOpen(false);
        } else {
          setSidebarOpen(true);
        }
      } else {
        // Use internal state management
        if (mobile) {
          setInternalSidebarOpen(false);
        } else {
          setInternalSidebarOpen(true);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarOpen]);

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
        setSidebarState(false);
      }
    }
  };

  const toggleSidebar = () => {
    setSidebarState(!isSidebarOpen);
  };

  return (
    <>
      {/* BURGER TOGGLE - Shows on both mobile and desktop */}
      <button 
        className={`burger-toggle ${isSidebarOpen ? 'open' : ''} ${isMobile ? 'mobile' : 'desktop'}`}
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        aria-expanded={isSidebarOpen}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* OVERLAY - Shows when sidebar is open on mobile */}
      {isMobile && isSidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarState(false)}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR - Works for both mobile and desktop */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''} ${isMobile ? 'mobile' : 'desktop'}`}>
        <div className="sidebar-header">
          <h2>{brandTitle}</h2>
          {verification && <div className="verification-pill">{statusPill}</div>}
        </div>
        
        <nav className="sidebar-nav" aria-label="Main navigation">
          {links.map(link => (
            <div
              key={link.key}
              className={`nav-item ${link.active ? 'active' : ''} ${link.locked ? 'locked' : ''}`}
              onClick={() => handleLinkClick(link.to, link.locked)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleLinkClick(link.to, link.locked);
                }
              }}
              aria-current={link.active ? 'page' : undefined}
              aria-disabled={link.locked ? 'true' : undefined}
            >
              <span>{link.label}</span>
              {link.locked && <span className="lock" aria-label="Locked">🔒</span>}
            </div>
          ))}
        </nav>
        
        <button 
          className="logout-btn" 
          onClick={onLogout}
          aria-label="Logout"
        >
          Logout
        </button>
      </div>
    </>
  );
};

export default DashboardSidebar;