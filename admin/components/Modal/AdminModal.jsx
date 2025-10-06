import React, { useEffect } from 'react';
import './AdminModal.css';

const AdminModal = ({ open, onClose, title, children, actions, size='md', preventClose }) => {
  useEffect(()=>{
    if(!open) return; const handler = (e)=> { if(e.key==='Escape' && !preventClose) onClose?.(); };
    window.addEventListener('keydown', handler); return ()=> window.removeEventListener('keydown', handler);
  },[open, onClose, preventClose]);
  if(!open) return null;
  return (
    <div className="admin-modal-backdrop" onClick={()=> { if(!preventClose) onClose?.(); }}>
      <div className={`admin-modal size-${size}`} onClick={(e)=> e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h3>{title}</h3>
          {!preventClose && <button className="close" onClick={onClose} aria-label="Close">×</button>}
        </div>
        <div className="admin-modal-body">{children}</div>
        {actions && <div className="admin-modal-footer">{actions}</div>}
      </div>
    </div>
  );
};

export default AdminModal;
