// Shared G-Pay constants (client-safe).

/** Registration fee a member transfers over KPay to open a G-Pay account (MMK). */
export const GPAY_REGISTER_FEE_MMK = 10_000;

/** One-time welcome bonus credited when an account is first approved (USD). */
export const GPAY_WELCOME_BONUS_USD = 1;

/** Platform KPay number members send the registration fee to. Configurable. */
export const GPAY_PLATFORM_KPAY =
  process.env.NEXT_PUBLIC_GPAY_KPAY_NUMBER ?? "";
