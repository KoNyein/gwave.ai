/**
 * ============================================================
 * NOTIFICATION SERVICE
 * ------------------------------------------------------------
 * - gh_events ထဲ notify record မှတ် (app ထဲ notification list အတွက်)
 * - FCM server key ရှိရင် site owner ရဲ့ devices အားလုံးဆီ push ပို့
 *   (Android app ရဲ့ FCM token တွေကို gh_notify_targets မှာသိမ်းထား)
 * ============================================================
 */

class Notifier {
  constructor(pool, cfg) {
    this.pool = pool;
    this.fcmKey = cfg.fcm && cfg.fcm.serverKey;
  }

  async send(siteId, message, context = {}) {
    console.log(`🔔 [notify] (${siteId}) ${message}`);

    // ၁။ App notification list အတွက် event မှတ်
    await this.pool.query(
      `INSERT INTO gh_events (device_id, type, payload)
       VALUES (NULL, 'notify', $1)`,
      [{ siteId, message, context }]
    );

    // ၂။ FCM push (server key ရှိမှ)
    if (!this.fcmKey) return;
    const { rows } = await this.pool.query(
      `SELECT nt.fcm_token FROM gh_notify_targets nt
       JOIN gh_sites s ON s.owner_id = nt.user_id
       WHERE s.id = $1`,
      [siteId]
    );
    for (const { fcm_token } of rows) {
      try {
        await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            Authorization: `key=${this.fcmKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: fcm_token,
            notification: { title: "GWAVE", body: message },
            data: context,
          }),
        });
      } catch (e) {
        console.error(`[notify] FCM error: ${e.message}`);
      }
    }
  }
}

module.exports = { Notifier };
