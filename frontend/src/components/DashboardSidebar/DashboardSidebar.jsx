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
      
      // Auto-close sidebar on mobile when resizing
      if (mobile && isSidebarOpen) {
        setSidebarState(false);
      }
      
      // Auto-open sidebar on desktop when resizing from mobile
      if (!mobile && !isSidebarOpen) {
        setSidebarState(true);
      }
    };

    // Initial setup based on screen size
    const mobile = window.innerWidth < 1024;
    setIsMobile(mobile);
    if (!setSidebarOpen) {
      setInternalSidebarOpen(!mobile); // Open on desktop, closed on mobile by default
    }

    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen, setSidebarOpen, setSidebarState]);

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
      // Auto-close sidebar on mobile after navigation
      if (isMobile) {
        setSidebarState(false);
      }
    }
  };

  const toggleSidebar = () => {
    setSidebarState(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarState(false);
  };

  return (
    <>
      {/* MOBILE HEADER - Only shows on mobile */}
      {isMobile && (
        <div className="mobile-header">
          <div className="mobile-header-content">
            <h3>{brandTitle}</h3>
            <button 
              className="burger-toggle mobile"
              onClick={toggleSidebar}
              aria-label="Toggle menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP BURGER TOGGLE - Only shows on desktop when sidebar is closed */}
      {!isMobile && !isSidebarOpen && (
        <button 
          className="burger-toggle desktop"
          onClick={toggleSidebar}
          aria-label="Open sidebar"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      )}

      {/* OVERLAY - Shows when sidebar is open on mobile */}
      {isMobile && isSidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR - Responsive behavior for both mobile and desktop */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'} ${isMobile ? 'mobile' : 'desktop'}`}>
        {/* CLOSE BUTTON - Only on mobile */}
        {isMobile && (
          <button 
            className="sidebar-close-btn"
            onClick={closeSidebar}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        )}
        
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

      {/* MOBILE SPACER - Pushes content below mobile header */}
      {isMobile && <div className="mobile-spacer"></div>}
    </>
  );
};

export default DashboardSidebar;