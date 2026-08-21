import {
  Networks,
  StellarWalletsKit,
  SwkAppLightTheme,
  type SwkAppTheme,
} from "@creit.tech/stellar-wallets-kit";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";

export const TESTNET_PASSPHRASE = Networks.TESTNET;

// A light touch on the kit's built-in modal so it doesn't feel like a
// foreign widget dropped onto the warm/orange app theme, without having to
// build a custom wallet-select UI of our own.
const theme: SwkAppTheme = {
  ...SwkAppLightTheme,
  primary: "#c2410c",
  "primary-foreground": "#fff8f2",
  "border-radius": "10px",
  "font-family": "Inter, system-ui, sans-serif",
};

let initialized = false;

function ensureInit(): void {
  if (initialized) return;
  StellarWalletsKit.init({
    modules: [new FreighterModule(), new xBullModule(), new AlbedoModule()],
    network: Networks.TESTNET,
    theme,
  });
  initialized = true;
}

/**
 * Every wallets-kit module (Freighter, xBull, Albedo) implements the same
 * `getNetwork(): Promise<{ network, networkPassphrase }>` contract per
 * ModuleInterface, so this guard works uniformly across whichever wallet the
 * user picked in the auth modal — not just Freighter.
 */
export async function ensureTestnet(): Promise<void> {
  ensureInit();
  const networkDetails = await StellarWalletsKit.getNetwork();
  if (networkDetails.networkPassphrase !== TESTNET_PASSPHRASE) {
    throw new Error(
      `Wallet is set to "${networkDetails.network}", not Testnet. Switch it to Testnet and reconnect.`
    );
  }
}

/**
 * Opens the wallets-kit auth modal (wallet picker), sets the chosen wallet
 * as active, and requests its address. Then verifies that wallet reports
 * Testnet before returning.
 */
export async function connectWallet(): Promise<{
  publicKey: string;
  network: string;
}> {
  ensureInit();

  let address: string;
  try {
    ({ address } = await StellarWalletsKit.authModal());
  } catch (err) {
    throw new Error(describeWalletError(err));
  }

  const networkDetails = await StellarWalletsKit.getNetwork();
  if (networkDetails.networkPassphrase !== TESTNET_PASSPHRASE) {
    throw new Error(
      `That wallet is set to "${networkDetails.network}". Switch it to Testnet in the wallet's own settings and reconnect.`
    );
  }

  return { publicKey: address, network: networkDetails.network };
}

export async function disconnectWallet(): Promise<void> {
  ensureInit();
  await StellarWalletsKit.disconnect();
}

/** Signs a built transaction XDR with whichever wallet is currently active in the kit. */
export async function signWithWallet(xdr: string, address: string): Promise<string> {
  ensureInit();
  try {
    const result = await StellarWalletsKit.signTransaction(xdr, {
      address,
      networkPassphrase: TESTNET_PASSPHRASE,
    });
    return result.signedTxXdr;
  } catch (err) {
    throw new Error(describeWalletError(err));
  }
}

/** Basic format check before we even try to build a transaction. */
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address.trim());
}

/**
 * Wallet extensions and the wallets-kit surface failures as plain JS Errors
 * with inconsistent, module-specific wording (e.g. Freighter says "User
 * declined access", xBull/Albedo phrase rejection differently). Recognizes
 * the two failure shapes actually distinct from contract logic errors —
 * no compatible wallet installed, and the user declining a request in
 * their wallet — and gives each a consistent, actionable message.
 */
export function describeWalletError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/not installed|no.*wallet.*(found|available)|not available/i.test(raw)) {
    return "No compatible wallet extension was found. Install Freighter, xBull, or Albedo, then try again.";
  }

  if (/reject|declin|denied|cancel/i.test(raw)) {
    return "Request declined in your wallet. Try again and approve the prompt to continue.";
  }

  return raw;
}
