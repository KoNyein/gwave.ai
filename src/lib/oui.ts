/**
 * Coarse MAC-vendor lookup from the OUI (first three octets).
 *
 * The full IEEE registry is ~35 000 entries and changes weekly; shipping it
 * would bloat the bundle for a dashboard nicety. This is the short list of
 * vendors that actually turn up in a home/office Wi-Fi scan in this region —
 * routers, ISP CPE, phone hotspots — and everything else is honestly reported
 * as unknown rather than guessed.
 */
const OUI: Record<string, string> = {
  // Networking / AP vendors
  "00:1a:11": "Google",
  "3c:5a:b4": "Google",
  "f4:f5:e8": "Google",
  "d8:6c:63": "Google",
  "00:0c:43": "Ralink/MediaTek",
  "00:1d:7e": "Cisco-Linksys",
  "00:25:9c": "Cisco-Linksys",
  "c0:c1:c0": "Cisco-Linksys",
  "00:14:bf": "Cisco-Linksys",
  "00:18:e7": "Cameo/TP-Link",
  "14:cc:20": "TP-Link",
  "50:c7:bf": "TP-Link",
  "a4:2b:b0": "TP-Link",
  "b0:48:7a": "TP-Link",
  "c4:6e:1f": "TP-Link",
  "ac:84:c6": "TP-Link",
  "98:da:c4": "TP-Link",
  "00:26:5a": "D-Link",
  "1c:bd:b9": "D-Link",
  "78:54:2e": "D-Link",
  "00:1f:33": "Netgear",
  "20:4e:7f": "Netgear",
  "a0:40:a0": "Netgear",
  "9c:3d:cf": "Netgear",
  "00:24:01": "D-Link",
  "04:bf:6d": "Zyxel",
  "5c:f4:ab": "Zyxel",
  "00:23:f8": "Zyxel",
  "38:35:fb": "Hisense",
  "e8:94:f6": "TP-Link",
  "44:d9:e7": "Ubiquiti",
  "68:d7:9a": "Ubiquiti",
  "74:83:c2": "Ubiquiti",
  "fc:ec:da": "Ubiquiti",
  "00:15:6d": "Ubiquiti",
  "24:a4:3c": "Ubiquiti",
  "18:e8:29": "Ubiquiti",
  "80:2a:a8": "Ubiquiti",
  "dc:9f:db": "Ubiquiti",
  "04:18:d6": "Ubiquiti",
  "00:0e:8f": "Sercomm (ISP CPE)",
  "b8:be:f4": "Sercomm (ISP CPE)",
  "cc:ce:1e": "Sagemcom (ISP CPE)",
  "00:1f:9f": "Thomson/Technicolor",
  "84:26:15": "Technicolor",
  "9c:97:26": "Technicolor",
  // Huawei / ZTE — very common CPE across SE Asia
  "00:e0:fc": "Huawei",
  "48:46:fb": "Huawei",
  "70:72:3c": "Huawei",
  "d4:6a:a8": "Huawei",
  "e0:24:7f": "Huawei",
  "f8:e8:11": "Huawei",
  "24:69:a5": "Huawei",
  "00:1e:73": "ZTE",
  "34:4b:50": "ZTE",
  "4c:09:b4": "ZTE",
  "98:6b:3d": "ZTE",
  // Phones (hotspots)
  "00:1c:b3": "Apple",
  "3c:15:c2": "Apple",
  "a4:83:e7": "Apple",
  "f0:18:98": "Apple",
  "dc:a9:04": "Apple",
  "90:81:2a": "Apple",
  "00:12:fb": "Samsung",
  "34:23:ba": "Samsung",
  "5c:0a:5b": "Samsung",
  "a0:21:b7": "Samsung",
  "c8:19:f7": "Samsung",
  "e8:50:8b": "Samsung",
  "64:cc:2e": "Xiaomi",
  "8c:be:be": "Xiaomi",
  "f0:b4:29": "Xiaomi",
  "50:8f:4c": "Xiaomi",
  "78:11:dc": "Xiaomi",
  "b0:e2:35": "Oppo/Realme",
  "d0:49:7c": "Oppo/Realme",
  "3c:e0:64": "Vivo",
  "60:ab:67": "Vivo",
};

/** Vendor for a MAC/BSSID, or null when the OUI isn't in the short list. */
export function vendorForMac(mac: string | null | undefined): string | null {
  if (!mac) return null;
  const clean = mac.trim().toLowerCase().replace(/-/g, ":");
  const oui = clean.split(":").slice(0, 3).join(":");
  if (oui.length !== 8) return null;
  return OUI[oui] ?? null;
}

/**
 * The security family a raw Android capability string describes. Android
 * reports things like "[WPA2-PSK-CCMP][WPS][ESS]"; what an admin wants is one
 * word plus whether it's enterprise, so the dashboard can group them.
 */
export function encryptionOf(
  capabilities: string | null | undefined,
  fallback: string | null | undefined,
): string {
  const caps = (capabilities ?? "").toUpperCase();
  if (caps) {
    if (caps.includes("SAE") || caps.includes("WPA3")) {
      return caps.includes("EAP") ? "WPA3-Enterprise" : "WPA3";
    }
    if (caps.includes("WPA2")) {
      return caps.includes("EAP") ? "WPA2-Enterprise" : "WPA2";
    }
    if (caps.includes("WPA")) return "WPA";
    if (caps.includes("WEP")) return "WEP";
    if (caps.includes("OWE")) return "OWE (open, encrypted)";
    if (caps.includes("ESS")) return "OPEN";
  }
  return (fallback ?? "UNKNOWN").toUpperCase();
}

/** Whether the client string reports WPS, which is a known weakness. */
export function hasWps(capabilities: string | null | undefined): boolean {
  return (capabilities ?? "").toUpperCase().includes("WPS");
}

/**
 * Browser and OS from a user-agent string. Deliberately coarse: the point is
 * "which clients contribute scans", not fingerprinting. The native app sends
 * its own platform fields, so this is mostly for the web client.
 */
export function clientOf(ua: string | null | undefined): {
  browser: string;
  os: string;
} {
  const s = ua ?? "";
  if (!s) return { browser: "unknown", os: "unknown" };

  let browser = "other";
  if (/Gwave-App/i.test(s)) browser = "Gwave app";
  else if (/Edg\//.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/SamsungBrowser/.test(s)) browser = "Samsung Internet";
  else if (/Firefox\//.test(s)) browser = "Firefox";
  // Chrome's UA contains Safari, so Chrome must be tested first.
  else if (/Chrome\//.test(s)) browser = "Chrome";
  else if (/Safari\//.test(s)) browser = "Safari";
  else if (/dart|Dart|okhttp/.test(s)) browser = "Gwave app";

  let os = "other";
  if (/Android/.test(s)) os = "Android";
  else if (/iPhone|iPad|iOS/.test(s)) os = "iOS";
  else if (/Windows NT/.test(s)) os = "Windows";
  else if (/Mac OS X/.test(s)) os = "macOS";
  else if (/Linux/.test(s)) os = "Linux";

  return { browser, os };
}
