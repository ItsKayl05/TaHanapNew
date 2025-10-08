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

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isMobile && open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, open]);

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
        setOpen(false);
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
      
      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className="dashboard-sidebar desktop">
          <div className="sidebar-header">
            <h2 className="brand">{brandTitle}</h2>
            {verification && (
              <div className="verification-pill">
                {statusPill}
              </div>
            )}
          </div>

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

          <div className="sidebar-footer">
            <button 
              className="logout-btn"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Mobile Sidebar - BOTTOM SHEET */}
      {isMobile && (
        <>
          <div className={`mobile-sidebar ${open ? 'open' : ''}`}>
            <div className="mobile-sidebar-header">
              <div className="mobile-brand">
                <h3>{brandTitle}</h3>
                {verification && (
                  <div className="verification-pill">
                    {statusPill}
                  </div>
                )}
              </div>
              <button 
                className="close-btn"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <nav className="mobile-sidebar-nav">
              <ul>
                {links.map(link => {
                  const { key, label, to, locked, hint, active } = link;
                  return (
                    <li 
                      key={key} 
                      className={`mobile-nav-item ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}
                      onClick={() => handleLinkClick(to, locked)}
                    >
                      <div className="mobile-nav-content">
                        <span className="mobile-nav-label">{label}</span>
                        {locked && <span className="lock-icon" title={hint || 'Locked'}>🔒</span>}
                      </div>
                      {locked && hint && <span className="mobile-nav-hint">{hint}</span>}
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="mobile-sidebar-footer">
              <button 
                className="mobile-logout-btn"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>

          {/* Mobile Toggle Button - BOTTOM CENTER */}
          <button 
            className="mobile-toggle-btn"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? '✕' : '☰'}
          </button>
        </>
      )}
    </>
  );
};

export default DashboardSidebar;