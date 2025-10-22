import Property from '../models/Property.js';
import PaymentSession from '../models/PaymentSession.js';

// node-fetch polyfill for Node versions without global fetch
import fetch from 'node-fetch';
if (!globalThis.fetch) globalThis.fetch = fetch;

const PAYMONGO_API = 'https://api.paymongo.com/v1';
const PAYMONGO_KEY = process.env.PAYMONGO_SECRET_KEY;

// NOTE: PaymentSession model is used to persist sessions in the database (production-ready)

export const createPanoCheckout = async (req, res) => {
  try {
    const { propertyId, paymentSessionId } = req.body;

    console.log('Creating checkout for property:', propertyId);

    // Validate PayMongo key
    if (!PAYMONGO_KEY || PAYMONGO_KEY === 'sk_test_PLACEHOLDER') {
      console.error('PayMongo secret key not configured');
      return res.status(500).json({ 
        error: 'Payment service not configured',
        details: 'PAYMONGO_SECRET_KEY is missing or invalid'
      });
    }

    // PayMongo Payment Link creation - include redirect URLs which PayMongo often requires
    const successRedirect = process.env.PAYMONGO_SUCCESS_URL || process.env.VITE_API_BASE_URL || 'https://tahanap.xyz/payment-success';
    const failedRedirect = process.env.PAYMONGO_FAILED_URL || process.env.VITE_API_BASE_URL || 'https://tahanap.xyz/payment-failed';

    // If client provided a paymentSessionId, store it in DB so we can verify later
    let sessionDoc = null;
    if (paymentSessionId) {
      try {
        sessionDoc = await PaymentSession.findOneAndUpdate(
          { sessionId: paymentSessionId },
          { sessionId: paymentSessionId, property: propertyId || null, paid: false, metadata: req.body.metadata || {} },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (e) {
        console.warn('Failed to create/update payment session in DB', e);
      }
    }

    // PayMongo link payload
    const linkData = {
      data: {
        attributes: {
          amount: 10900, // ₱109.00 in centavos
          currency: 'PHP',
          description: 'Unlock panoramic uploads',
          metadata: { propertyId: propertyId || 'new-property', type: 'pano_upload_unlock' },
          redirect: {
            success: successRedirect,
            failed: failedRedirect
          }
        }
      }
    };

    // Attach paymentSessionId to metadata if present so webhook can mark session paid
    if (paymentSessionId) {
      linkData.data.attributes.metadata.paymentSessionId = paymentSessionId;
    }

    console.log('Sending to PayMongo:', linkData);

    const response = await fetch(`${PAYMONGO_API}/links`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(PAYMONGO_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(linkData)
    });

    // Parse response safely (some PayMongo responses might be non-JSON in error cases)
    let data;
    try {
      data = await response.json();
    } catch (err) {
      const text = await response.text().catch(() => '');
      data = text ? { message: text } : {};
    }

    console.log('PayMongo Response:', { status: response.status, data });

    if (!response.ok) {
      console.error('PayMongo API error:', data);
      return res.status(response.status).json({
        error: 'Payment gateway error',
        details: data.errors?.[0]?.detail || data.message || 'Unknown PayMongo error'
      });
    }

    // Extract checkout URL from PayMongo response (support several shapes)
    const checkoutUrl = data?.data?.attributes?.checkout_url || data?.attributes?.checkout_url || data?.checkout_url || data?.data?.attributes?.url || null;

    if (!checkoutUrl) {
      console.error('No checkout URL in PayMongo response:', data);
      return res.status(500).json({ error: 'No checkout URL received from payment gateway', details: data });
    }

    // Return response using a stable envelope the frontend expects
    res.json({
      success: true,
      data: {
        attributes: {
          checkout_url: checkoutUrl
        }
      }
    });

  } catch (error) {
    console.error('Create checkout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};

export const paymongoWebhook = async (req, res) => {
  try {
    const event = req.body;
    console.log('PayMongo webhook received:', event.type);

    // Verify webhook signature (recommended for production)
    // const signature = req.headers['paymongo-signature'];
    // Implement signature verification here

    const eventType = event.type;
    const metadata = event.data?.attributes?.metadata || {};
    const propertyId = metadata.propertyId;
    const sessionId = metadata.paymentSessionId;

    console.log('Webhook details:', { eventType, propertyId, sessionId });

    // If webhook indicates link paid, mark property or session as paid
    if (eventType === 'link.paid') {
      // If propertyId is known and not a placeholder, update property
      if (propertyId && propertyId !== 'new-property') {
        try {
          const property = await Property.findById(propertyId);
          if (property) {
            property.paidForPano = true;
            await property.save();
            console.log(`Property ${propertyId} marked as paidForPano`);
          } else {
            console.warn(`Property ${propertyId} not found for webhook`);
          }
        } catch (dbError) {
          console.error('Database error in webhook:', dbError);
        }
      }

      // If a paymentSessionId was supplied in metadata, mark that session as paid in DB
      if (sessionId) {
        try {
          const sess = await PaymentSession.findOne({ sessionId });
          if (sess) {
            sess.paid = true;
            sess.paidAt = new Date();
            await sess.save();
            console.log(`Payment session ${sessionId} marked as paid (DB)`);
          } else {
            console.warn(`Payment session ${sessionId} not found in DB`);
          }
        } catch (dbErr) {
          console.error('DB error marking session paid', dbErr);
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Verify payment session status
export const verifyPaymentSession = async (req, res) => {
  try {
    const { paymentSessionId } = req.body;
    if (!paymentSessionId) return res.status(400).json({ error: 'paymentSessionId required' });
    const session = await PaymentSession.findOne({ sessionId: paymentSessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.json({ paymentSessionId, paid: !!session.paid, propertyId: session.property || null });
  } catch (err) {
    console.error('verifyPaymentSession error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Dev helper: simulate a PayMongo webhook payload for local testing
export const simulateWebhook = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Not available in production' });
    const { type, metadata } = req.body;
    if (!type) return res.status(400).json({ error: 'type required' });
    // Construct basic webhook event shape expected by paymongoWebhook
    const event = {
      type,
      data: {
        attributes: {
          metadata: metadata || {}
        }
      }
    };
    // Call existing handler logic to process this event
    // We can call paymongoWebhook directly since it accepts (req,res) shape, but it expects req.body
    const fakeReq = { body: event };
    const fakeRes = {
      status: (code) => ({ json: (payload) => ({ code, payload }) }),
      json: (payload) => payload
    };
    await paymongoWebhook(fakeReq, fakeRes);
    return res.json({ success: true, processed: true, event });
  } catch (err) {
    console.error('simulateWebhook error', err);
    return res.status(500).json({ error: 'Simulation failed' });
  }
};