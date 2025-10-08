import React, { useState, useEffect } from 'react';
import './DashboardSidebar.css';

const DashboardSidebar = ({
  variant = 'landlord',
  links = [],
  onNavigate,
  onLogout,
  verification,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setOpen(false); // Close mobile menu on desktop
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      setOpen(false);
    }
  };

  return (
    <>
      {/* DESKTOP SIDEBAR - Only shows on desktop */}
      <div className={`desktop-sidebar ${isMobile ? 'hidden' : ''}`}>
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

      {/* MOBILE HEADER - Only shows on mobile */}
      {isMobile && (
        <div className="mobile-header">
          <div className="mobile-header-content">
            <h3>{brandTitle}</h3>
            {verification && <div className="verification-pill">{statusPill}</div>}
            <button 
              className="menu-toggle"
              onClick={() => setOpen(!open)}
            >
              {open ? '✕' : '☰'}
            </button>
          </div>
        </div>
      )}

      {/* MOBILE MENU - Only shows on mobile when open */}
      {isMobile && open && (
        <div className="mobile-menu">
          <div className="mobile-menu-content">
            {links.map(link => (
              <div
                key={link.key}
                className={`mobile-nav-item ${link.active ? 'active' : ''} ${link.locked ? 'locked' : ''}`}
                onClick={() => handleLinkClick(link.to, link.locked)}
              >
                <span>{link.label}</span>
                {link.locked && <span className="lock">🔒</span>}
              </div>
            ))}
            <button className="mobile-logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      )}

      {/* SPACER - Only for mobile to push content below header */}
      {isMobile && <div className="mobile-header-spacer"></div>}
    </>
  );
};

export default DashboardSidebar;