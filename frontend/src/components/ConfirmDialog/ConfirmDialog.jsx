import React, { useEffect, useRef, useState } from 'react';
import './ConfirmDialog.css';

const ConfirmDialog = ({
  open,
  title='Confirm',
  message='Are you sure?',
  confirmLabel='Confirm',
  cancelLabel='Cancel',
  onConfirm,
  onCancel,
  danger=false,
  icon=null,
  busy=false,
  autoFocus='confirm'
}) => {
  const boxRef = useRef(null);
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const [internalBusy, setInternalBusy] = useState(false);
  const isBusy = busy || internalBusy;

  useEffect(()=>{
    if(!open) return; 
    const handler = (e)=>{
      if(e.key==='Escape') { e.preventDefault(); onCancel?.(); }
      if(e.key==='Tab') {
        const nodes = boxRef.current?.querySelectorAll('button');
        if(!nodes?.length) return;
        const list = Array.from(nodes);
        const first = list[0];
        const last = list[list.length-1];
        if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handler);
    return ()=> window.removeEventListener('keydown', handler);
  },[open,onCancel]);

  useEffect(()=>{
    if(!open) return;
    requestAnimationFrame(()=>{
      if(autoFocus==='confirm') confirmRef.current?.focus();
      else if(autoFocus==='cancel') cancelRef.current?.focus();
      else boxRef.current?.focus();
    });
  },[open, autoFocus]);

  if(!open) return null;

  const backdrop = (e)=>{ if(e.target===e.currentTarget && !isBusy) onCancel?.(); };
  const handleConfirm = async ()=>{
    if(isBusy) return;
    const r = onConfirm?.();
    if(r instanceof Promise){ setInternalBusy(true); try { await r; } finally { setInternalBusy(false); } }
  };

  return (
    <div className="confirm-overlay" role="dialog" aria-modal="true" onMouseDown={backdrop}>
      <div className={`confirm-box ${danger? 'danger':''}`} ref={boxRef} tabIndex={-1} aria-busy={isBusy}>
        <div className="cd-header">
          {icon && <div className="cd-icon" aria-hidden="true">{icon}</div>}
          <h4>{title}</h4>
        </div>
        {message && <p>{message}</p>}
        <div className="confirm-actions">
          <button ref={confirmRef} disabled={isBusy} className={danger? 'danger-btn':'primary-btn'} onClick={handleConfirm}>{isBusy? 'Please wait...' : confirmLabel}</button>
          <button ref={cancelRef} disabled={isBusy} className="secondary-btn" onClick={onCancel}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
