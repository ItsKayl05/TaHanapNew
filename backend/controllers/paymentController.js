import Property from '../models/Property.js';

// node-fetch polyfill for Node versions without global fetch
import fetch from 'node-fetch';
if (!globalThis.fetch) globalThis.fetch = fetch;

const PAYMONGO_API = 'https://api.paymongo.com/v1';
const PAYMONGO_KEY = process.env.PAYMONGO_SECRET_KEY;

export const createPanoCheckout = async (req, res) => {
  try {
    const { propertyId } = req.body;

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
    const propertyId = event.data.attributes.metadata?.propertyId;

    console.log('Webhook details:', { eventType, propertyId });

    if (eventType === 'link.paid' && propertyId && propertyId !== 'new-property') {
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

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};