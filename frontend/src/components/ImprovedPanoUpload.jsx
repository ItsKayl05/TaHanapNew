import React, { useState, useEffect } from 'react';
import PanoPaymentModal from './PanoPaymentModal/PanoPaymentModal';
import { buildApi } from '../services/apiConfig';
import './PanoPaymentModal/PanoPaymentModal.css';

export default function ImprovedPanoUpload({ propertyId }) {
  const [uploadFlow, setUploadFlow] = useState({
    step: 'select',
    selectedFiles: [],
    previewUrls: []
  });
  // Keep files that require payment pending until payment completes
  const [pendingFiles, setPendingFiles] = useState([]);
  const [paidForPano, setPaidForPano] = useState(() => {
    try { return localStorage.getItem('pano_payment_status') === 'true'; } catch(e) { return false; }
  });
  const [paymentSessionId, setPaymentSessionId] = useState(() => { try { return localStorage.getItem('pano_payment_session') || null; } catch(e){ return null; } });

  // CLEANUP MEMORY LEAKS when component unmounts
  useEffect(() => {
    return () => {
      uploadFlow.previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const checkPanoEligibility = async () => {
    const token = localStorage.getItem('user_token');
    try {
      const res = await fetch(buildApi(`/properties/${propertyId}/pano-eligibility`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.ok ? await res.json() : { allowed: false, message: 'Check failed' };
    } catch (e) {
      console.warn('Eligibility check failed', e);
      return { allowed: false, message: 'Check failed' };
    }
  };

  const performUpload = async (files) => {
    const token = localStorage.getItem('user_token');
    const formData = new FormData();
    // Append to canonical field
    files.forEach(file => formData.append('panorama360Images', file));
    // Also append to legacy field name for compatibility
    files.forEach(file => formData.append('panoPhotos', file));

    const res = await fetch(buildApi(`/properties/${propertyId}`), {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    return res;
  };

  const handleFileSelect = async (files) => {
    // Revoke any old previews
    uploadFlow.previewUrls.forEach(url => URL.revokeObjectURL(url));
    const fileArray = Array.from(files);

    // Compute total pano count if these files are added (use server check when propertyId present)
    if (propertyId) {
      // If property exists, backend will check exact count; but attempt quick client-side check by asking eligibility
      // Check eligibility BEFORE creating previews
      const eligibility = await checkPanoEligibility();

      if (!eligibility.allowed) {
        if (eligibility.message === 'Show payment modal') {
          // Put files into pending state and show payment UI
          setPendingFiles(fileArray);
          // ensure we have a payment session id
          if (!paymentSessionId) {
            const sid = `pano_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
            setPaymentSessionId(sid);
            try { localStorage.setItem('pano_payment_session', sid); } catch(e){}
          }
          setUploadFlow({ step: 'payment', selectedFiles: fileArray, previewUrls: [] });
          return;
        }
        // Not allowed for other reasons
        alert(eligibility.message || 'Panorama upload not allowed');
        // keep user on select step
        setUploadFlow({ step: 'select', selectedFiles: [], previewUrls: [] });
        return;
      }
    } else {
      // For new property flows (no propertyId), compute local total using paid flag
      const filteredForCount = fileArray.filter(file => file.type && file.type.startsWith('image/') && file.size <= 10*1024*1024);
      const totalCountIfAdded = (uploadFlow.selectedFiles?.length || 0) + filteredForCount.length;
      // If helper says payment required, show modal
      // NOTE: import of handlePanoUploadLogic avoided here to keep component decoupled; rely on eligibility endpoint or payment modal when necessary
    }
    

    // Allowed: create previews and move to preview step
    const previewUrls = fileArray.map(file => URL.createObjectURL(file));
    setUploadFlow({ step: 'preview', selectedFiles: fileArray, previewUrls });
  };

  const handlePreviewConfirm = async () => {
    const eligibility = await checkPanoEligibility();

    if (!eligibility.allowed && eligibility.message === 'Show payment modal') {
      setUploadFlow(prev => ({ ...prev, step: 'payment' }));
    } else if (!eligibility.allowed) {
      alert(eligibility.message);
      resetFlow();
    } else {
      await performUpload(uploadFlow.selectedFiles);
      resetFlow();
    }
  };

  const resetFlow = () => {
    uploadFlow.previewUrls.forEach(url => URL.revokeObjectURL(url));
    setUploadFlow({ step: 'select', selectedFiles: [], previewUrls: [] });
  };

  const handlePaymentClose = () => {
    console.log('Payment cancelled - clearing preview');
    // Clear pending files when user cancels
    setPendingFiles([]);
    resetFlow();
  };

  const handlePaymentSuccess = async () => {
    setUploadFlow(prev => ({ ...prev, step: 'uploading' }));
    // persist paid status
    try { localStorage.setItem('pano_payment_status','true'); } catch(e){}
    setPaidForPano(true);
    const filesToUpload = pendingFiles.length ? pendingFiles : uploadFlow.selectedFiles;
    try {
      await performUpload(filesToUpload);
    } finally {
      setPendingFiles([]);
      resetFlow();
    }
  };

  const handlePaymentError = () => {
    console.log('Payment rejected - clearing preview');
    resetFlow();
  };

  return (
    <div className="pano-upload-container">
      {uploadFlow.step === 'select' && (
        <div className="upload-section">
          <h4>Upload Panoramic Photos</h4>
          <input 
            type="file" 
            multiple 
            accept="image/*"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>
      )}

      {uploadFlow.step === 'preview' && (
        <div className="preview-container">
          <h4>Preview {uploadFlow.selectedFiles.length} Photo(s)</h4>
          <div className="preview-grid">
            {uploadFlow.previewUrls.map((url, index) => (
              <div key={index} className="preview-item">
                <img src={url} alt={`Preview ${index + 1}`} />
              </div>
            ))}
          </div>
          <div className="preview-actions">
            <button onClick={handlePreviewConfirm} className="btn primary">
              Confirm Upload
            </button>
            <button onClick={resetFlow} className="btn outline">
              Cancel
            </button>
          </div>
        </div>
      )}

      {uploadFlow.step === 'payment' && (
        <PanoPaymentModal
          open={true}
          onClose={handlePaymentClose}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentError={handlePaymentError}
          propertyId={propertyId}
        />
      )}

      {uploadFlow.step === 'uploading' && (
        <div className="uploading-state">
          <div className="loading-spinner"></div>
          <p>Uploading...</p>
        </div>
      )}
    </div>
  );
}
