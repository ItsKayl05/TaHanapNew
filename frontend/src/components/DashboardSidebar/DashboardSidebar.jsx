import React, { useState, useEffect, useRef } from 'react';
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
  const [open, setOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 760;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileMenuOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { 
    if (isMobile) {
      setOpen(false);
      setMobileMenuOpen(false);
    } else {
      setOpen(true);
      setMobileMenuOpen(false);
    }
  }, [isMobile]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mobileMenuOpen && sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  const brandTitle = variant === 'landlord' ? 'TaHanap Landlord' : 'TaHanap Tenant';

  const statusPill = (() => {
    if (!verification) return null;
    const { status, rejectedReasons = [] } = verification;
    if (status === 'verified') return <span className="verified">Verified</span>;
    if (status === 'rejected') return (
      <span className="rejected" title={rejectedReasons.join('\n') || 'Rejected'}>Rejected – Re-upload</span>
    );
    if (status === 'pending') return <span className="pending">Verification Pending</span>;
    return <span className="pending">Not Verified</span>;
  })();

  const handleLinkClick = (to, locked) => {
    if (!locked && onNavigate) {
      onNavigate(to);
      if (isMobile) {
        setMobileMenuOpen(false);
      }
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      if (isMobile) {
        setMobileMenuOpen(false);
      }
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && mobileMenuOpen && (
        <div className="mobile-sidebar-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}
      
      <div 
        ref={sidebarRef}
        className={`dashboard-sidebar ${variant} ${isMobile ? 'mobile' : ''} ${open ? 'open' : 'closed'} ${mobileMenuOpen ? 'mobile-open' : ''}`}
      >      
        <div className="sidebar-header">
          <h2 className="brand">{brandTitle}</h2>
          {verification && !isMobile && (
            <div className="verification-pill">
              {statusPill}
            </div>
          )}
        </div>

        {/* Mobile verification pill - appears below hamburger */}
        {isMobile && verification && (
          <div className="verification-pill mobile-verification">
            {statusPill}
          </div>
        )}

        <div className={`sidebar-content ${mobileMenuOpen ? 'mobile-visible' : ''}`}>
          <ul>
            {links.map(link => {
              const { key, label, to, locked, hint } = link;
              return (
                <li 
                  key={key} 
                  className={`${link.active ? 'active' : ''} ${locked ? 'locked' : ''}`} 
                  onClick={() => handleLinkClick(to, locked)}
                >
                  <span className="label-row">{label} {locked && <span className="lock-indicator" title={hint || 'Locked'}>🔒</span>}</span>
                  {locked && hint && <span className="hint-row">{hint}</span>}
                </li>
              );
            })}
            <li onClick={handleLogout} className="logout">Logout</li>
          </ul>
        </div>

        {/* Mobile Hamburger Toggle */}
        {isMobile && (
          <button 
            className={`mobile-toggle ${mobileMenuOpen ? 'open' : ''}`} 
            onClick={() => setMobileMenuOpen(o => !o)} 
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} 
            aria-expanded={mobileMenuOpen} 
            type="button"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
        )}
      </div>
    </>
  );
};

export default DashboardSidebar;