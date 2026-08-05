/**
 * ============================================================
 * CONNECTOR BASE — Adapter Pattern
 * ------------------------------------------------------------
 * Brand/protocol တစ်ခုစီက ဒီ interface ကို implement လုပ်ရတယ်။
 * Platform core က ဒီ methods ၄ ခုကိုပဲသိတယ် —
 * brand ရဲ့အသေးစိတ်ကို ဘယ်တော့မှမသိဘူး။
 * (Google Home ရဲ့ SYNC/QUERY/EXECUTE နဲ့ တစ်ထပ်တည်း)
 * ============================================================
 */

class BaseConnector {
  /** connector နာမည် — gh_devices.connector column နဲ့ ကိုက်ရမယ် */
  static get name() {
    throw new Error("name required");
  }

  /**
   * SYNC — linked account/config ထဲက devices စာရင်းယူ
   * @returns [{ ref, name, type, traits }]
   */
  async listDevices(_linkedAccount) {
    throw new Error("not implemented");
  }

  /** QUERY — device state (online?, recording? ...) */
  async getState(_device) {
    throw new Error("not implemented");
  }

  /** EXECUTE — command ပို့ (setOn, move, ...) */
  async execute(_device, _command, _params) {
    throw new Error("not implemented");
  }

  /** camera.live — playback URL ထုတ်ပေး */
  async getStreamUrl(_device, _protocol) {
    throw new Error("not implemented");
  }
}

module.exports = { BaseConnector };
