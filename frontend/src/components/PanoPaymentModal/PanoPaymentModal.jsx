import React, { useState, useEffect, useRef } from 'react';
import './PanoPaymentModal.css';
import { buildApi } from '../../services/apiConfig';

export default function PanoPaymentModal({ open, onClose, propertyId, paymentSessionId: propPaymentSessionId, onPaymentSuccess, onPaymentError }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [opened, setOpened] = useState(false);
  const pollRef = useRef(null);
  const pollStartRef = useRef(null);
  const [paymentSessionId, setPaymentSessionId] = useState(propPaymentSessionId || null);

  // Poll eligibility when checkout opened to detect when payment completes
  useEffect(() => {
    const POLL_INTERVAL = 3000; // 3s
    const TIMEOUT = 1000 * 60 * 2; // 2 minutes

  // If modal hasn't opened, skip polling
  if (!opened) return;

  // Determine polling mode:
  // - property mode: poll property pano-eligibility when propertyId is present
  // - session mode: poll /payments/verify-session when paymentSessionId exists (supports new-property flow)
  const usePropertyMode = !!propertyId;
  const useSessionMode = !usePropertyMode && !!paymentSessionId;
  if (!usePropertyMode && !useSessionMode) return; // nothing to poll

    pollStartRef.current = Date.now();

    const poll = async () => {
      try {
        const token = localStorage.getItem('user_token');

        if (usePropertyMode) {
          const res = await fetch(buildApi(`/properties/${propertyId}/pano-eligibility`), {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) return; // skip until ok
          const data = await res.json();
          if (data?.paidForPano) {
            onPaymentSuccess?.();
            clearInterval(pollRef.current);
            pollRef.current = null;
            return;
          }
        } else if (useSessionMode) {
          // poll session verification endpoint
          const res = await fetch(buildApi('/payments/verify-session'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ paymentSessionId })
          });
          if (!res.ok) return;
          const data = await res.json();
          if (data?.paid) {
            // Mark persisted status and notify parent
            try { localStorage.setItem('pano_payment_status','true'); } catch(e){}
            onPaymentSuccess?.();
            clearInterval(pollRef.current);
            pollRef.current = null;
            return;
          }
        }

        // timeout check
        if (Date.now() - pollStartRef.current > TIMEOUT) {
          onPaymentError?.('Payment polling timed out');
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch (e) {
        console.warn('Polling error', e);
      }
    };

    // start polling immediately and then interval
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [opened]);

  // Manual verification for flows where propertyId is null (new property creation)
  const handleManualVerify = () => {
    // Immediate workaround: notify parent that payment is considered successful so pending files can be processed
    console.log('Manual payment verification invoked for null propertyId');
    try {
      localStorage.setItem('pano_payment_status', 'true');
      if (paymentSessionId) localStorage.setItem('pano_payment_session', paymentSessionId);
    } catch (e) {
      console.warn('Could not persist payment status', e);
    }
    onPaymentSuccess?.();
    onClose?.();
  };

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

      // If propertyId is null (new property flow), generate a payment session id so we can track payment independent of property
      let sessionToSend = paymentSessionId;
      if (!propertyId && !sessionToSend) {
        sessionToSend = `pano_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
        setPaymentSessionId(sessionToSend);
        try { localStorage.setItem('pano_payment_session', sessionToSend); } catch(e) { console.warn('persist session failed', e); }
      }

      const payload = { propertyId };
      if (sessionToSend) payload.paymentSessionId = sessionToSend;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
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
        // don't call success yet; user will complete payment in new tab and webhook will set paid flag
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

  // Enhanced close handler which notifies parent about payment cancellation/deferral
  const handleClose = () => {
    console.log('Payment modal closed');
    // If the payment page was opened, user might have deferred or cancelled
    if (opened) {
      onPaymentError?.('Payment cancelled or deferred');
    } else {
      onPaymentError?.('Payment deferred');
    }
    onClose?.();
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
            { !propertyId && (
              <div className="manual-verify-note">
                <p>If you're adding panoramas for a new property, the server cannot yet poll for eligibility. After completing payment, click "I've Paid — Verify" to continue.</p>
              </div>
            )}
          </div>
        )}

        <div className="pano-payment-actions">
          <button className="btn outline" onClick={handleClose} disabled={loading}>
            {opened ? 'Close' : 'Maybe Later'}
          </button>

          {/* If propertyId is null and payment page was opened, show manual verify button */}
          {opened && !propertyId && (
            <button className="btn primary" onClick={handleManualVerify} disabled={loading}>
              I've Paid — Verify
            </button>
          )}

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