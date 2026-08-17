import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { signTransaction, getNetworkDetails } from "@stellar/freighter-api";

// ---- Deployed contract + network config (Stellar Testnet only) ----
export const CONTRACT_ID = "CAF7HV6V6J7FUYHTGX5RIZIYGE4SXMZEDQOF4432AIN7256O45573IJ3";
export const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
export const TESTNET_PASSPHRASE = Networks.TESTNET;

export const rpcServer = new rpc.Server(SOROBAN_RPC_URL);

export interface Split {
  id: bigint;
  description: string;
  creator: string;
  totalAmount: bigint;
  participants: string[];
  shares: bigint[];
  paid: bigint[];
  createdAt: bigint;
}

// Mirrors contract::SplitError in split_tracker/src/lib.rs.
const SPLIT_ERROR_MESSAGES: Record<number, string> = {
  1: "Number of participants doesn't match number of shares.",
  2: "Split not found.",
  3: "That address isn't a participant in this split.",
  4: "That payment would overpay the participant's share.",
  5: "A split needs at least one participant.",
};

/** Turns a raw simulate/send failure into a message a user can act on. */
function describeContractError(raw: string): string {
  const match = raw.match(/Error\(Contract, #(\d+)\)/);
  if (match) {
    const code = Number(match[1]);
    return SPLIT_ERROR_MESSAGES[code] ?? `Contract error #${code}.`;
  }
  return raw;
}

async function ensureTestnet(): Promise<void> {
  const networkDetails = await getNetworkDetails();
  if (networkDetails.error) {
    throw new Error(networkDetails.error.message);
  }
  if (networkDetails.networkPassphrase !== TESTNET_PASSPHRASE) {
    throw new Error(
      `Freighter is set to "${networkDetails.network}", not Testnet. Switch back to Test Net before continuing.`
    );
  }
}

async function pollTransaction(hash: string): Promise<rpc.Api.GetTransactionResponse> {
  let response = await rpcServer.getTransaction(hash);
  const start = Date.now();
  while (response.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    if (Date.now() - start > 30000) {
      throw new Error("Timed out waiting for the transaction to confirm.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    response = await rpcServer.getTransaction(hash);
  }
  return response;
}

/**
 * Simulates a contract call. For read-only calls, returns the simulated
 * result directly. For write calls, signs the assembled transaction with
 * Freighter, submits it, and polls until it confirms.
 */
async function callContract(
  source: string,
  method: string,
  args: xdr.ScVal[],
  write: boolean
): Promise<{ value: unknown; hash?: string }> {
  await ensureTestnet();

  const account = await rpcServer.getAccount(source);
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: TESTNET_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  const simulation = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(describeContractError(simulation.error));
  }

  if (!write) {
    const value = simulation.result ? scValToNative(simulation.result.retval) : undefined;
    return { value };
  }

  const preparedTx = rpc.assembleTransaction(tx, simulation).build();

  const signResult = await signTransaction(preparedTx.toXDR(), {
    address: source,
    networkPassphrase: TESTNET_PASSPHRASE,
  });
  if (signResult.error) {
    throw new Error(signResult.error.message);
  }

  const signedTx = TransactionBuilder.fromXDR(signResult.signedTxXdr, TESTNET_PASSPHRASE);
  const sendResult = await rpcServer.sendTransaction(signedTx);
  if (sendResult.status === "ERROR") {
    throw new Error(describeContractError(JSON.stringify(sendResult.errorResult)));
  }

  const finalResponse = await pollTransaction(sendResult.hash);
  if (finalResponse.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(
      describeContractError(
        "resultXdr" in finalResponse ? finalResponse.resultXdr.toXDR("base64") : finalResponse.status
      )
    );
  }

  const returnValue =
    "returnValue" in finalResponse && finalResponse.returnValue
      ? scValToNative(finalResponse.returnValue)
      : undefined;

  return { value: returnValue, hash: sendResult.hash };
}

function toSplit(raw: any): Split {
  return {
    id: BigInt(raw.id),
    description: raw.description,
    creator: raw.creator,
    totalAmount: BigInt(raw.total_amount),
    participants: raw.participants,
    shares: raw.shares.map((s: unknown) => BigInt(s as bigint)),
    paid: raw.paid.map((p: unknown) => BigInt(p as bigint)),
    createdAt: BigInt(raw.created_at),
  };
}

export async function createSplit(
  source: string,
  description: string,
  totalAmount: bigint,
  participants: string[],
  shares: bigint[]
): Promise<{ id: bigint; hash: string }> {
  const args = [
    new Address(source).toScVal(),
    nativeToScVal(description, { type: "string" }),
    nativeToScVal(totalAmount, { type: "i128" }),
    xdr.ScVal.scvVec(participants.map((p) => new Address(p).toScVal())),
    xdr.ScVal.scvVec(shares.map((s) => nativeToScVal(s, { type: "i128" }))),
  ];
  const { value, hash } = await callContract(source, "create_split", args, true);
  return { id: value as bigint, hash: hash! };
}

export async function payShare(
  source: string,
  splitId: bigint,
  amount: bigint
): Promise<{ hash: string }> {
  const args = [
    nativeToScVal(splitId, { type: "u64" }),
    new Address(source).toScVal(),
    nativeToScVal(amount, { type: "i128" }),
  ];
  const { hash } = await callContract(source, "pay_share", args, true);
  return { hash: hash! };
}

export async function getSplit(source: string, splitId: bigint): Promise<Split> {
  const args = [nativeToScVal(splitId, { type: "u64" })];
  const { value } = await callContract(source, "get_split", args, false);
  return toSplit(value);
}

export async function getRecentSplits(source: string): Promise<bigint[]> {
  const { value } = await callContract(source, "get_recent_splits", [], false);
  return (value as unknown[]).map((v) => BigInt(v as bigint));
}
