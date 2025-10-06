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
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 760);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { if (isMobile) setOpen(false); else setOpen(true); }, [isMobile]);

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

  return (
    <div className={`dashboard-sidebar ${variant} ${isMobile ? 'mobile' : ''} ${open ? 'open' : 'closed'}`}>      
      <h2 className="brand">{brandTitle}</h2>
      {verification && (
        <div className="verification-pill">
          {statusPill}
        </div>
      )}
      <ul>
        {links.map(link => {
          const { key, label, to, locked, hint } = link;
          return (
            <li key={key} className={`${link.active ? 'active' : ''} ${locked ? 'locked' : ''}`} onClick={() => { if (!locked && onNavigate) onNavigate(to); }}>
              <span className="label-row">{label} {locked && <span className="lock-indicator" title={hint || 'Locked'}>🔒</span>}</span>
              {locked && hint && <span className="hint-row">{hint}</span>}
            </li>
          );
        })}
        <li onClick={onLogout} className="logout">Logout</li>
      </ul>
  {/* Collapse toggle removed for landlord per request; retain none on desktop */}
      {isMobile && (
        <button className="mobile-toggle" onClick={() => setOpen(o => !o)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} type="button">☰</button>
      )}
    </div>
  );
};

export default DashboardSidebar;
