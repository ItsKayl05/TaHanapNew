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
  const [isTablet, setIsTablet] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      const tablet = window.innerWidth >= 768 && window.innerWidth < 1024;
      setIsMobile(mobile);
      setIsTablet(tablet);
      
      // Auto-close on mobile, auto-open on desktop
      if (mobile) {
        setOpen(false);
      } else {
        setOpen(true);
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

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && open && (
        <div 
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
        />
      )}
      
      <div className={`dashboard-sidebar ${variant} ${isMobile ? 'mobile' : ''} ${isTablet ? 'tablet' : ''} ${open ? 'open' : 'closed'}`}>
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

        {/* Mobile Toggle Button */}
        {isMobile && (
          <button 
            className="mobile-toggle"
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? '✕' : '☰'}
          </button>
        )}
      </div>
    </>
  );
};

export default DashboardSidebar;