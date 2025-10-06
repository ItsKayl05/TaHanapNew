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
  busy=false, // external busy flag
  autoFocus='confirm' // 'confirm' | 'cancel' | null
}) => {
  const boxRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const [internalBusy, setInternalBusy] = useState(false);
  const isBusy = busy || internalBusy;

  // Escape + focus trap
  useEffect(()=>{
    if(!open) return; 
    const keyHandler = (e)=>{
      if(e.key==='Escape') { e.stopPropagation(); onCancel?.(); }
      if(e.key==='Tab') {
        const focusables = boxRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if(!focusables?.length) return;
        const list = Array.from(focusables);
        const first = list[0];
        const last = list[list.length-1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', keyHandler);
    return ()=> window.removeEventListener('keydown', keyHandler);
  },[open,onCancel]);

  // Initial focus
  useEffect(()=>{
    if(!open) return; 
    requestAnimationFrame(()=>{
      if(autoFocus==='confirm' && confirmBtnRef.current) confirmBtnRef.current.focus();
      else if(autoFocus==='cancel' && cancelBtnRef.current) cancelBtnRef.current.focus();
      else boxRef.current?.focus();
    });
  },[open, autoFocus]);

  if(!open) return null;

  const handleBackdrop = (e)=>{ if(e.target === e.currentTarget && !isBusy) onCancel?.(); };

  const handleConfirm = async ()=>{
    if(isBusy) return; // guard
    const result = onConfirm?.();
    if(result instanceof Promise){
      try { setInternalBusy(true); await result; }
      finally { setInternalBusy(false); }
    }
  };

  return (
    <div className="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="cd-title" onMouseDown={handleBackdrop}>
      <div className={`confirm-box ${danger? 'danger':''}`} ref={boxRef} tabIndex={-1} aria-busy={isBusy}>
        <div className="cd-header">
          {icon && <div className="cd-icon" aria-hidden="true">{icon}</div>}
          <h4 id="cd-title">{title}</h4>
        </div>
        <p>{message}</p>
        <div className="confirm-actions">
          <button ref={confirmBtnRef} disabled={isBusy} className={danger? 'danger-btn':'primary-btn'} onClick={handleConfirm}>{isBusy? 'Please wait...' : confirmLabel}</button>
          <button ref={cancelBtnRef} disabled={isBusy} className="secondary-btn" onClick={onCancel}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
};
export default ConfirmDialog;
