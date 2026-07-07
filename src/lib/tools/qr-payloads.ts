import generatePromptPayPayload from "promptpay-qr";

/** Escape special characters in Wi-Fi QR fields per the de-facto spec. */
function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

export type WifiSecurity = "WPA" | "WEP" | "nopass";

export function wifiPayload(input: {
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
}): string {
  const parts = [
    `T:${input.security}`,
    `S:${escapeWifi(input.ssid)}`,
    input.security !== "nopass" ? `P:${escapeWifi(input.password)}` : "",
    input.hidden ? "H:true" : "",
  ].filter(Boolean);
  return `WIFI:${parts.join(";")};;`;
}

export function vcardPayload(input: {
  fullName: string;
  org: string;
  title: string;
  phone: string;
  email: string;
  website: string;
}): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${input.fullName}`,
    input.org && `ORG:${input.org}`,
    input.title && `TITLE:${input.title}`,
    input.phone && `TEL;TYPE=CELL:${input.phone}`,
    input.email && `EMAIL:${input.email}`,
    input.website && `URL:${input.website}`,
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * EMVCo PromptPay payload. Target: Thai phone (08x…), national ID (13
 * digits) or e-wallet ID. Amount in THB makes the QR dynamic (fixed amount).
 */
export function promptPayPayload(target: string, amount?: number): string {
  return generatePromptPayPayload(target.trim(), {
    amount: amount && amount > 0 ? amount : undefined,
  });
}

/** Quick validity check for a PromptPay target. */
export function isValidPromptPayTarget(target: string): boolean {
  const digits = target.replace(/[^0-9]/g, "");
  return [10, 13, 15].includes(digits.length);
}
