import React, { useState } from 'react';
import './PanoPaymentModal.css';
import { buildApi } from '../../services/apiConfig';

export default function PanoPaymentModal({ open, onClose, propertyId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [opened, setOpened] = useState(false);

  if (!open) return null;

  const isMobile = typeof window !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent);

  const handleProceed = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('user_token');
      const url = buildApi('/payments/create-checkout');
      
      console.log('Sending request to:', url);
      console.log('Property ID:', propertyId);
      console.log('Token exists:', !!token);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ propertyId })
      });

      console.log('Response status:', res.status);
      

      // Enhanced response parsing
      const text = await res.text();
      let data;
      try { 
        data = text ? JSON.parse(text) : {}; 
      } catch (e) { 
        data = { message: text }; 
      }

      // Better checkout URL extraction supporting several shapes
      const checkoutUrl = data?.data?.attributes?.checkout_url || 
                         data?.attributes?.checkout_url ||
                         data?.checkout_url ||
                         data?.data?.attributes?.url ||
                         data?.link ||
                         data?.url ||
                         null;

      console.log('Extracted checkout URL:', checkoutUrl);

      if (res.ok && checkoutUrl) {
        try {
          window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
          setOpened(true);
        } catch (e) {
          window.location.assign(checkoutUrl);
        }
        return;
      }

      // Better error handling
      let errorMessage = 'Could not create checkout.';
      if (data?.error?.message) {
        errorMessage = data.error.message;
      } else if (data?.errors) {
        errorMessage = data.errors.map(err => err.detail).join(', ');
      } else if (data?.message) {
        errorMessage = data.message;
      } else if (!res.ok) {
        errorMessage = `Server error: ${res.status} ${res.statusText}`;
      }

      setError(errorMessage);
    } catch (err) {
      setError(err?.message || 'Network error');
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className={`pano-payment-overlay ${isMobile ? 'mobile' : 'desktop'}`}>
      <div className="pano-payment-modal">
        <div className="pano-payment-header">
          <div className="pano-payment-icon">🌅</div>
          <h3>Elevate Your Property with Immersive Panoramas</h3>
        </div>
        
        <div className="pano-payment-content">
          <p className="pano-payment-description">
            <strong>Stand out from the competition</strong> with stunning 360° panoramic views that give potential buyers a virtual tour experience.
          </p>

          <div className="pano-payment-benefits">
            <div className="benefit-item">
              <span className="benefit-icon">✅</span>
              <div className="benefit-text">
                <strong>Up to 5 Panoramic Uploads</strong>
                <span>Showcase every angle of your property</span>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🚀</span>
              <div className="benefit-text">
                <strong>Boost Engagement</strong>
                <span>Properties with panoramas get 3x more views</span>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">💫</span>
              <div className="benefit-text">
                <strong>Professional Presentation</strong>
                <span>Create a memorable virtual tour experience</span>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">💰</span>
              <div className="benefit-text">
                <strong>One-Time Payment</strong>
                <span>Pay once, use forever for this property</span>
              </div>
            </div>
          </div>

          <div className="pano-payment-pricing">
            <div className="pricing-amount">₱109</div>
            <div className="pricing-note">One-time payment • No recurring fees</div>
          </div>
        </div>

        {error && (
          <div className="pano-payment-error" role="alert">
            <strong>Payment Error:</strong> {error}
          </div>
        )}
        
        {opened && (
          <div className="pano-payment-success">
            <strong>Payment page opened!</strong> Complete your payment in the new tab, then return here to upload your panoramic photos.
          </div>
        )}

        <div className="pano-payment-actions">
          <button className="btn outline" onClick={onClose} disabled={loading}>
            {opened ? 'Close' : 'Maybe Later'}
          </button>
          {!opened && (
            <button className="btn primary" onClick={handleProceed} disabled={loading}>
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  Preparing Payment...
                </>
              ) : (
                <>
                  <span className="lock-icon">🔓</span>
                  Unlock Panoramic Uploads - ₱109
                </>
              )}
            </button>
          )}
        </div>

        <div className="pano-payment-footer">
          <div className="security-note">
            <span className="shield-icon">🛡️</span>
            Secure payment processed through PayMongo
          </div>
        </div>
      </div>
    </div>
  );
}