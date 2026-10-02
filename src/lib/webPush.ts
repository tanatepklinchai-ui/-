import webpush from 'web-push';

export type WebPushPayload = {
  title: string;
  body: string;
  url: string;
};

export type StoredWebPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function getWebPushPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export function isWebPushConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}

export function isExpiredWebPushError(error: unknown) {
  return typeof error === 'object' && error !== null && 'statusCode' in error &&
    (error.statusCode === 404 || error.statusCode === 410);
}

export async function sendWebPushNotification(
  subscription: StoredWebPushSubscription,
  payload: WebPushPayload
) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT must be configured');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload)
  );
}
