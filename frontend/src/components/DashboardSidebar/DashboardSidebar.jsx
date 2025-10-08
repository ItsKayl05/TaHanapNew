import React, { useState, useEffect } from 'react';
import './DashboardSidebar.css';

/**
 * Reusable dashboard sidebar for Landlord and Tenant
 * Props:
 *  - variant: 'landlord' | 'tenant'
 *  - links: [{ key, label, to, locked?, hint?, requiresVerification? }]
 *  - onNavigate: (to)=>void
 *  - onLogout: ()=>void
 *  - verification: { status: 'verified' | 'pending' | 'rejected' | 'none', rejectedReasons?: string[] }
 */
const DashboardSidebar = ({
  variant = 'landlord',
  links = [],
  onNavigate,
  onLogout,
  verification,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false); // Start closed on mobile

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // Auto-open on desktop, stay closed on mobile
      if (!mobile) {
        setOpen(true);
      } else {
        setOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const brandTitle = variant === 'landlord' ? 'TaHanap Landlord' : 'TaHanap Tenant';

  const statusPill = (() => {
    if (!verification) return null;
    const { status, rejectedReasons = [] } = verification;
    if (status === 'verified') return <span className="verified">Verified</span>;
    if (status === 'rejected') return (
      <span className="rejected" title={rejectedReasons.join('\n') || 'Rejected'}>Rejected</span>
    );
    if (status === 'pending') return <span className="pending">Pending</span>;
    return <span className="pending">Not Verified</span>;
  })();

  const handleLinkClick = (to, locked) => {
    if (!locked && onNavigate) {
      onNavigate(to);
      if (isMobile) {
        setOpen(false); // Close menu on mobile after navigation
      }
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      if (isMobile) {
        setOpen(false);
      }
    }
  };

  const handleOverlayClick = () => {
    setOpen(false);
  };

  return (
    <>
      {/* Mobile Overlay - Only show when sidebar is open on mobile */}
      {isMobile && open && (
        <div 
          className="sidebar-overlay"
          onClick={handleOverlayClick}
        />
      )}
      
      {/* Main Sidebar */}
      <div className={`dashboard-sidebar ${variant} ${isMobile ? 'mobile' : 'desktop'} ${open ? 'open' : 'closed'}`}>
        {/* Header Section */}
        <div className="sidebar-header">
          <h2 className="brand">{brandTitle}</h2>
          {verification && (
            <div className="verification-pill">
              {statusPill}
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="sidebar-nav">
          <ul>
            {links.map(link => {
              const { key, label, to, locked, hint, active } = link;
              return (
                <li 
                  key={key} 
                  className={`nav-item ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}
                  onClick={() => handleLinkClick(to, locked)}
                >
                  <div className="nav-content">
                    <span className="nav-label">{label}</span>
                    {locked && <span className="lock-icon" title={hint || 'Locked'}>🔒</span>}
                  </div>
                  {locked && hint && <span className="nav-hint">{hint}</span>}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout Button */}
        <div className="sidebar-footer">
          <button 
            className="logout-btn"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Mobile Toggle Button - Always visible on mobile */}
      {isMobile && (
        <button 
          className="mobile-toggle"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? '✕' : '☰'}
        </button>
      )}
    </>
  );
};

export default DashboardSidebar;