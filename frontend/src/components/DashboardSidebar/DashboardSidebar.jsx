import React, { useState, useEffect, useRef } from 'react';
import './DashboardSidebar.css';

const DashboardSidebar = ({
  variant = 'landlord',
  links = [],
  onNavigate,
  onLogout,
  verification,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
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
      
      {/* Mobile Hamburger Button - SEPARATE from sidebar */}
      {isMobile && (
        <button 
          className={`mobile-hamburger ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          type="button"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      )}
      
      <div 
        ref={sidebarRef}
        className={`dashboard-sidebar ${isMobile ? 'mobile' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}
      >      
        <div className="sidebar-header">
          <h2 className="brand">{brandTitle}</h2>
          
          {verification && !isMobile && (
            <div className="verification-pill">
              {statusPill}
            </div>
          )}
        </div>

        {isMobile && verification && (
          <div className="verification-pill mobile-verification">
            {statusPill}
          </div>
        )}

        <div className="sidebar-content">
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
      </div>
    </>
  );
};

export default DashboardSidebar;