import * as admin from 'firebase-admin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Razorpay from 'razorpay';
import { db } from '../_lib/firebase';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { items, shippingInfo, userId } = req.body;

    // Secure Checkout: Calculate price on the backend!
    let totalAmount = 0;
    
    // Fetch product prices securely from Firestore
    for (const item of items) {
      // Depending on your actual DB schema, fetch the price
      const productDoc = await db.collection('products').doc(item.product.id).get();
      if (!productDoc.exists) {
        return res.status(400).json({ error: `Product ${item.product.id} not found` });
      }
      
      const productData = productDoc.data();
      const price = productData?.price || 0;
      totalAmount += price * item.quantity;
    }

    // Razorpay amount is in lowest denomination (paise)
    const options = {
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}_${userId || 'guest'}`
    };

    const order = await razorpay.orders.create(options);

    // Save initial order state to Firestore
    await db.collection('orders').doc(order.id).set({
      userId: userId || null,
      shippingInfo,
      items,
      totalAmount,
      status: 'pending_payment',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      keyId: process.env.RAZORPAY_KEY_ID,
      order
    });
  } catch (error: any) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
}
