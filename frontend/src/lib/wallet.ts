import {
  isConnected,
  isAllowed,
  setAllowed,
  requestAccess,
  getAddress,
  getNetworkDetails,
} from "@stellar/freighter-api";
import { Networks } from "@stellar/stellar-sdk";

export const TESTNET_PASSPHRASE = Networks.TESTNET;

/** Checks whether the Freighter browser extension is installed at all. */
export async function checkFreighterInstalled(): Promise<boolean> {
  const result = await isConnected();
  return !result.error;
}

/**
 * Connects to Freighter: requests the user's permission (if not already
 * granted) and returns their public key + the network Freighter is set to.
 */
export async function connectWallet(): Promise<{
  publicKey: string;
  network: string;
}> {
  const installed = await checkFreighterInstalled();
  if (!installed) {
    throw new Error(
      "Freighter wallet extension not found. Install it from freighter.app and refresh the page."
    );
  }

  const allowed = await isAllowed();
  if (!allowed.isAllowed) {
    const setAllowedResult = await setAllowed();
    if (setAllowedResult.error) {
      throw new Error(setAllowedResult.error.message);
    }
  }

  const access = await requestAccess();
  if (access.error) {
    throw new Error(access.error.message);
  }

  const addressResult = await getAddress();
  if (addressResult.error) {
    throw new Error(addressResult.error.message);
  }

  const networkDetails = await getNetworkDetails();
  if (networkDetails.error) {
    throw new Error(networkDetails.error.message);
  }

  if (networkDetails.networkPassphrase !== TESTNET_PASSPHRASE) {
    throw new Error(
      `Freighter is set to "${networkDetails.network}". Switch Freighter to Test Net in its network settings and reconnect.`
    );
  }

  return { publicKey: addressResult.address, network: networkDetails.network };
}

/**
 * "Disconnecting" a Freighter session is a client-side concept only -
 * Freighter itself doesn't expose a revoke call, so we just clear local state.
 */
export function disconnectWallet(): void {
  // No SDK-level teardown is needed; the caller clears its own React state.
}

/** Basic format check before we even try to build a transaction. */
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address.trim());
}
