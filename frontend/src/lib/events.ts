import { scValToNative, xdr, type rpc } from "@stellar/stellar-sdk";
import { CONTRACT_ID, rpcServer } from "./contract";

export type SplitEventKind = "created" | "paid";

export interface SplitEvent {
  id: string;
  kind: SplitEventKind;
  ledger: number;
  closedAt: string;
  txHash: string;
  splitId: bigint;
  payer?: string;
}

// Matches env.events().publish((symbol_short!("split"), symbol_short!(...)), ...)
// in split_tracker/src/lib.rs — filter on the first topic ("split"), wildcard the second.
const SPLIT_TOPIC_FILTER = xdr.ScVal.scvSymbol("split").toXDR("base64");

function parseEvent(raw: rpc.Api.EventResponse): SplitEvent | null {
  const kind = raw.topic[1] ? (scValToNative(raw.topic[1]) as string) : undefined;
  if (kind !== "created" && kind !== "paid") return null;

  const value = scValToNative(raw.value);

  let splitId: bigint;
  let payer: string | undefined;
  if (kind === "created") {
    splitId = BigInt(value as bigint);
  } else {
    const [id, addr] = value as [bigint, string];
    splitId = BigInt(id);
    payer = addr;
  }

  return {
    id: raw.id,
    kind,
    ledger: raw.ledger,
    closedAt: raw.ledgerClosedAt,
    txHash: raw.txHash,
    splitId,
    payer,
  };
}

export interface EventPage {
  events: SplitEvent[];
  cursor: string;
  latestLedger: number;
}

/** First call in a polling loop: starts a bit behind the chain tip so the panel isn't empty on load. */
export async function fetchInitialEvents(lookbackLedgers = 200): Promise<EventPage> {
  const latest = await rpcServer.getLatestLedger();
  const startLedger = Math.max(latest.sequence - lookbackLedgers, 1);

  const response = await rpcServer.getEvents({
    startLedger,
    filters: [{ type: "contract", contractIds: [CONTRACT_ID], topics: [[SPLIT_TOPIC_FILTER, "*"]] }],
    limit: 50,
  });

  return {
    events: response.events.map(parseEvent).filter((e): e is SplitEvent => e !== null),
    cursor: response.cursor,
    latestLedger: response.latestLedger,
  };
}

/** Subsequent polls: cursor-paginated from wherever the last page left off, so we only see new events. */
export async function fetchNewEvents(cursor: string): Promise<EventPage> {
  const response = await rpcServer.getEvents({
    cursor,
    filters: [{ type: "contract", contractIds: [CONTRACT_ID], topics: [[SPLIT_TOPIC_FILTER, "*"]] }],
    limit: 50,
  });

  return {
    events: response.events.map(parseEvent).filter((e): e is SplitEvent => e !== null),
    cursor: response.cursor,
    latestLedger: response.latestLedger,
  };
}
