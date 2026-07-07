declare module "promptpay-qr" {
  /**
   * Builds an EMVCo PromptPay payload for the given target (phone number,
   * national ID or e-wallet ID) and optional amount in THB.
   */
  export default function generatePayload(
    target: string,
    options?: { amount?: number },
  ): string;
}
