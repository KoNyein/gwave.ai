/**
 * ============================================================
 * ONVIF/RTSP CONNECTOR (Connector #1)
 * ------------------------------------------------------------
 * ရှိပြီးသား pipeline (Edge Agent → MediaMTX) ကို adapter
 * ပုံစံသွင်းထားတာ။ Camera တွေက edge agent ကနေ MediaMTX ဆီ
 * push တင်ပြီးသားဖြစ်လို့ ဒီ connector က:
 *  - MediaMTX API ကနေ online/offline စစ်
 *  - WebRTC/HLS playback URL ထုတ်ပေး
 * connector_ref format: { "streamPath": "cam_farm01_gate" }
 * ============================================================
 */

const { BaseConnector } = require("./base");

class OnvifRtspConnector extends BaseConnector {
  static get name() {
    return "onvif";
  }

  constructor(cfg) {
    super();
    this.mtxApi = cfg.mediamtx.apiUrl;        // http://127.0.0.1:9997
    this.publicHost = cfg.mediamtx.publicHost; // EC2 public IP / domain
    this.hlsPort = cfg.mediamtx.hlsPort;       // 8888
    this.webrtcPort = cfg.mediamtx.webrtcPort; // 8889
  }

  /**
   * ONVIF မှာ account linking မလို — edge agent က push တင်ထားပြီးသား။
   * MediaMTX ပေါ်ရောက်နေတဲ့ cam_ path အားလုံးကို "တွေ့တဲ့ device" အဖြစ်ပြန်ပေး။
   * (Add Device wizard မှာ user က ကိုယ့် site ရဲ့ path တွေကိုရွေးပြီး register လုပ်မယ်)
   */
  async listDevices() {
    const res = await fetch(`${this.mtxApi}/v3/paths/list?itemsPerPage=200`);
    if (!res.ok) throw new Error(`MediaMTX API error ${res.status}`);
    const data = await res.json();
    return (data.items || [])
      .filter((p) => p.name.startsWith("cam_") && p.ready)
      .map((p) => ({
        ref: { streamPath: p.name },
        name: p.name,
        type: "camera",
        traits: {
          "camera.live": { protocols: ["webrtc", "hls"] },
          "camera.record": { retention_days: 30 },
        },
      }));
  }

  /** MediaMTX ကနေ path ready (publisher ရှိ) လား စစ် */
  async getState(device) {
    const path = device.connector_ref.streamPath;
    const res = await fetch(
      `${this.mtxApi}/v3/paths/get/${encodeURIComponent(path)}`
    );
    if (res.status === 404) return { online: false };
    if (!res.ok) throw new Error(`MediaMTX API error ${res.status}`);
    const p = await res.json();
    return {
      online: !!p.ready,
      viewers: (p.readers || []).length,
      bytesReceived: p.bytesReceived,
    };
  }

  async execute(device, command, params) {
    // ONVIF PTZ ကို edge agent ကတဆင့်လုပ်ရမယ် (နောက် version) —
    // အခုအဆင့်မှာ streaming commands ပဲ support
    throw new Error(`onvif connector: '${command}' မရသေးပါ`);
  }

  async getStreamUrl(device, protocol = "hls") {
    const path = device.connector_ref.streamPath;
    if (protocol === "webrtc") {
      return {
        protocol: "webrtc",
        url: `http://${this.publicHost}:${this.webrtcPort}/${path}/whep`,
        pageUrl: `http://${this.publicHost}:${this.webrtcPort}/${path}`,
      };
    }
    return {
      protocol: "hls",
      url: `http://${this.publicHost}:${this.hlsPort}/${path}/index.m3u8`,
    };
  }
}

module.exports = { OnvifRtspConnector };
