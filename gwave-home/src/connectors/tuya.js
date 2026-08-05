/**
 * ============================================================
 * TUYA CONNECTOR (Connector #2)
 * ------------------------------------------------------------
 * Tuya IoT Platform (iot.tuya.com) — ဈေးပေါ no-name ကင်မရာ
 * အများစုက Tuya-based ဖြစ်လို့ ဒီ connector တစ်ခုတည်းနဲ့
 * brand အများကြီး ဖုံးမိတယ်။
 *
 * ပြင်ဆင်ရန်:
 *  1. iot.tuya.com မှာ Cloud Project ဖွင့် → AccessID + AccessSecret ရ
 *  2. "Smart Home Basic Service" + "IP Camera Open Service" API subscribe
 *  3. Data center ရွေး (Thailand/Myanmar → Central Europe / India ကိုက်တာရွေး)
 *  4. User linking: Tuya "Authorization Management" မှာ app account link
 *
 * Signing: Tuya OpenAPI v2 — HMAC-SHA256
 *   sign = HMAC-SHA256(clientId + [token] + t + nonce + stringToSign, secret)
 * ============================================================
 */

const crypto = require("crypto");
const { BaseConnector } = require("./base");

class TuyaConnector extends BaseConnector {
  static get name() {
    return "tuya";
  }

  constructor(cfg) {
    super();
    this.base = cfg.tuya.apiBase;        // https://openapi.tuyaeu.com
    this.clientId = cfg.tuya.accessId;
    this.secret = cfg.tuya.accessSecret;
    this._token = null;                  // { value, expiresAt }
  }

  // ---------- Tuya request signing ----------
  _sign(method, pathWithQuery, body = "", token = "") {
    const t = Date.now().toString();
    const nonce = crypto.randomUUID();
    const contentHash = crypto.createHash("sha256").update(body).digest("hex");
    const stringToSign = [method.toUpperCase(), contentHash, "", pathWithQuery].join("\n");
    const signStr = this.clientId + token + t + nonce + stringToSign;
    const sign = crypto
      .createHmac("sha256", this.secret)
      .update(signStr)
      .digest("hex")
      .toUpperCase();
    return {
      client_id: this.clientId,
      sign,
      t,
      nonce,
      sign_method: "HMAC-SHA256",
      ...(token ? { access_token: token } : {}),
    };
  }

  async _getToken() {
    if (this._token && Date.now() < this._token.expiresAt - 60000) {
      return this._token.value;
    }
    const path = "/v1.0/token?grant_type=1";
    const headers = this._sign("GET", path);
    const res = await fetch(this.base + path, { headers });
    const data = await res.json();
    if (!data.success) throw new Error(`Tuya token error: ${data.msg}`);
    this._token = {
      value: data.result.access_token,
      expiresAt: Date.now() + data.result.expire_time * 1000,
    };
    return this._token.value;
  }

  async _request(method, path, body) {
    const token = await this._getToken();
    const bodyStr = body ? JSON.stringify(body) : "";
    const headers = {
      ...this._sign(method, path, bodyStr, token),
      "Content-Type": "application/json",
    };
    const res = await fetch(this.base + path, {
      method,
      headers,
      body: body ? bodyStr : undefined,
    });
    const data = await res.json();
    if (!data.success) throw new Error(`Tuya API error: ${data.code} ${data.msg}`);
    return data.result;
  }

  // ---------- Connector interface ----------

  /**
   * SYNC — linked Tuya user (uid) ရဲ့ devices စာရင်း
   * linkedAccount.meta = { uid: "tuya-user-uid" }
   */
  async listDevices(linkedAccount) {
    const uid = linkedAccount.meta.uid;
    const devices = await this._request("GET", `/v1.0/users/${uid}/devices`);
    return devices
      .filter((d) => d.category === "sp") // sp = smart camera
      .map((d) => ({
        ref: { deviceId: d.id },
        name: d.name,
        type: "camera",
        traits: {
          "camera.live": { protocols: ["hls", "rtsp"] },
          "camera.motion": { events: true },
          "power.onoff": {},
        },
      }));
  }

  async getState(device) {
    const id = device.connector_ref.deviceId;
    const info = await this._request("GET", `/v1.0/devices/${id}`);
    return { online: !!info.online };
  }

  async execute(device, command, params) {
    const id = device.connector_ref.deviceId;
    if (command === "setOn") {
      return this._request("POST", `/v1.0/devices/${id}/commands`, {
        commands: [{ code: "basic_private", value: !params.on }],
      });
    }
    if (command === "move") {
      // PTZ: 0=up,2=right,4=down,6=left (Tuya direction codes)
      const dir =
        params.pan > 0 ? "2" : params.pan < 0 ? "6" :
        params.tilt > 0 ? "0" : "4";
      return this._request("POST", `/v1.0/devices/${id}/commands`, {
        commands: [{ code: "ptz_control", value: dir }],
      });
    }
    throw new Error(`tuya connector: '${command}' မရသေးပါ`);
  }

  /** Tuya cloud ကနေ stream URL တောင်း (HLS/RTSP) — သက်တမ်းတိုလို့ တောင်းတိုင်းအသစ်ရ */
  async getStreamUrl(device, protocol = "hls") {
    const id = device.connector_ref.deviceId;
    const type = protocol === "rtsp" ? "rtsp" : "hls";
    const result = await this._request(
      "POST",
      `/v1.0/devices/${id}/stream/actions/allocate`,
      { type }
    );
    return { protocol: type, url: result.url, expiresIn: 30 };
  }
}

module.exports = { TuyaConnector };
