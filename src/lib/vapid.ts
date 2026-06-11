import webpush from "web-push";

let configured = false;

export function getWebPush() {
  if (!configured) {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const email = process.env.VAPID_EMAIL ?? "admin@example.com";
    if (!publicKey || !privateKey) {
      throw new Error("VAPID keys not set. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to environment variables.");
    }
    webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey);
    configured = true;
  }
  return webpush;
}
