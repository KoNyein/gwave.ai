/**
 * ============================================================
 * DEVICE REGISTRY — Platform Core
 * ------------------------------------------------------------
 * Connector တွေနဲ့ database ကြားက အလယ်အလတ် layer။
 * - discover: connector ကနေ device ရှာ
 * - register: gh_devices ထဲသွင်း (unified format)
 * - permission စစ် (owner / shared)
 * - health poll: online/offline sync + offline event ထုတ်
 * ============================================================
 */

const { validateTraits, commandAllowed } = require("./traits");

class Registry {
  constructor(pool, connectors) {
    this.pool = pool;             // pg Pool
    this.connectors = connectors; // { onvif: instance, tuya: instance }
  }

  _connector(name) {
    const c = this.connectors[name];
    if (!c) throw new Error(`Connector '${name}' မရှိပါ`);
    return c;
  }

  // ---------- SYNC: connector ကနေ devices ရှာ ----------
  async discover(userId, connectorName) {
    const connector = this._connector(connectorName);
    let linked = null;
    if (connectorName !== "onvif") {
      const { rows } = await this.pool.query(
        `SELECT * FROM gh_linked_accounts WHERE user_id=$1 AND connector=$2`,
        [userId, connectorName]
      );
      if (!rows.length) {
        throw new Error(`${connectorName} account မချိတ်ရသေးပါ — အရင် link လုပ်ပါ`);
      }
      linked = rows[0];
    }
    return connector.listDevices(linked);
  }

  // ---------- Register: တွေ့တဲ့ device ကို registry ထဲသွင်း ----------
  async register(userId, siteId, connectorName, found, customName) {
    validateTraits(found.traits);
    const deviceId = `dev_${siteId}_${(customName || found.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .slice(0, 30)}`;
    await this.pool.query(
      `INSERT INTO gh_devices
         (id, site_id, owner_id, name, type, connector, connector_ref, traits)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE
         SET name=$4, connector_ref=$7, traits=$8`,
      [
        deviceId, siteId, userId,
        customName || found.name, found.type,
        connectorName, found.ref, found.traits,
      ]
    );
    return deviceId;
  }

  // ---------- Permission: ဒီ user က ဒီ device ကြည့်ခွင့်ရှိလား ----------
  async getDeviceAuthorized(userId, deviceId) {
    const { rows } = await this.pool.query(
      `SELECT d.* FROM gh_devices d
       LEFT JOIN gh_device_shares s
         ON s.device_id = d.id AND s.user_id = $1
       WHERE d.id = $2 AND (d.owner_id = $1 OR s.user_id IS NOT NULL)`,
      [userId, deviceId]
    );
    if (!rows.length) throw new Error("Device မတွေ့ပါ (သို့) ခွင့်မရှိပါ");
    return rows[0];
  }

  async listForUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT d.* FROM gh_devices d
       LEFT JOIN gh_device_shares s ON s.device_id = d.id
       WHERE d.owner_id = $1 OR s.user_id = $1
       ORDER BY d.created_at`,
      [userId]
    );
    return rows;
  }

  // ---------- QUERY / EXECUTE / STREAM ----------
  async getState(userId, deviceId) {
    const device = await this.getDeviceAuthorized(userId, deviceId);
    return this._connector(device.connector).getState(device);
  }

  async execute(userId, deviceId, command, params) {
    const device = await this.getDeviceAuthorized(userId, deviceId);
    if (!commandAllowed(device.traits, command)) {
      throw new Error(`ဒီ device မှာ '${command}' trait မပါပါ`);
    }
    return this._connector(device.connector).execute(device, command, params);
  }

  /** Rules Engine အတွက် — user permission မစစ်ဘဲ system အနေနဲ့ run */
  async executeSystem(deviceId, command, params) {
    const { rows } = await this.pool.query(
      `SELECT * FROM gh_devices WHERE id=$1`,
      [deviceId]
    );
    if (!rows.length) throw new Error(`Device '${deviceId}' မတွေ့ပါ`);
    const device = rows[0];
    if (!commandAllowed(device.traits, command)) {
      throw new Error(`ဒီ device မှာ '${command}' trait မပါပါ`);
    }
    return this._connector(device.connector).execute(device, command, params);
  }

  async getStreamUrl(userId, deviceId, protocol) {
    const device = await this.getDeviceAuthorized(userId, deviceId);
    if (!device.traits["camera.live"]) {
      throw new Error("ဒီ device မှာ camera.live trait မပါပါ");
    }
    return this._connector(device.connector).getStreamUrl(device, protocol);
  }

  // ---------- Rules Engine အတွက် system-level execute (user permission မလို) ----------
  async executeInternal(deviceId, command, params) {
    const { rows } = await this.pool.query(
      `SELECT * FROM gh_devices WHERE id=$1`,
      [deviceId]
    );
    if (!rows.length) throw new Error(`Device '${deviceId}' မတွေ့ပါ`);
    const device = rows[0];
    if (!commandAllowed(device.traits, command)) {
      throw new Error(`'${deviceId}' မှာ '${command}' trait မပါပါ`);
    }
    return this._connector(device.connector).execute(device, command, params);
  }

  // ---------- Health poll: 30s တစ်ခါ run — online/offline sync ----------
  async pollHealth() {
    const { rows } = await this.pool.query(`SELECT * FROM gh_devices`);
    for (const device of rows) {
      try {
        const state = await this._connector(device.connector).getState(device);
        if (state.online !== device.is_online) {
          await this.pool.query(
            `UPDATE gh_devices SET is_online=$1, last_seen=now() WHERE id=$2`,
            [state.online, device.id]
          );
          await this.pool.query(
            `INSERT INTO gh_events (device_id, type) VALUES ($1,$2)`,
            [device.id, state.online ? "online" : "offline"]
          );
          console.log(`[health] ${device.id} → ${state.online ? "ONLINE" : "OFFLINE"}`);
        } else if (state.online) {
          await this.pool.query(
            `UPDATE gh_devices SET last_seen=now() WHERE id=$1`,
            [device.id]
          );
        }
      } catch (e) {
        console.error(`[health] ${device.id}: ${e.message}`);
      }
    }
  }
}

module.exports = { Registry };
