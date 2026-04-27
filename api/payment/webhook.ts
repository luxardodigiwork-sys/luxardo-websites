import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { db } from '../_lib/firebase';
import { initiateFulfillment } from '../_lib/fulfill';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  const signature = req.headers['x-razorpay-signature'] as string;

  const bodyQuery = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(bodyQuery)
    .digest('hex');

  if (expectedSignature !== signature) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  try {
    if (event.event === 'order.paid') {
      const orderId = event.payload.order.entity.id;
      const paymentId = event.payload.payment.entity.id;

      // 1. Update Firestore
      await db.collection('orders').doc(orderId).update({
        status: 'paid',
        paymentId,
        payment_status: 'completed',
        updatedAt: new Date()
      });

      // 2. Trigger Shiprocket Fulfillment
      const orderDoc = await db.collection('orders').doc(orderId).get();
      if (orderDoc.exists) {
        await initiateFulfillment(orderDoc.id, orderDoc.data());
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
