// Wallet utilities — Apple Wallet (.pkpass) and Google Wallet (JWT)
// Credentials are read from environment variables at runtime.
// If credentials are missing the feature is disabled gracefully.

export function appleWalletEnabled(): boolean {
  return !!(
    process.env.APPLE_PASS_TYPE_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_CERT_PEM &&
    process.env.APPLE_KEY_PEM &&
    process.env.APPLE_WWDR_PEM
  );
}

export function googleWalletEnabled(): boolean {
  return !!(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  );
}

export type WalletPassData = {
  memberId: string;
  fullName: string;
  maskedCpf: string;
  membershipNo: string;
  planName: string;
  validity: string;   // DD/MM/AAAA
  photoUrl: string | null;
  qrValue: string;    // validation URL
};
