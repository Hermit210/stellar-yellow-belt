import { useEffect, useRef, useState } from "react";
import { fetchInitialEvents, fetchNewEvents, type SplitEvent } from "../lib/events";

const POLL_INTERVAL_MS = 6000;
const MAX_EVENTS = 25;

interface LiveActivityProps {
  currentAddress?: string | null;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

function describeEvent(event: SplitEvent, currentAddress?: string | null): string {
  if (event.kind === "created") {
    return `Split #${event.splitId.toString()} created`;
  }
  const who =
    event.payer === currentAddress ? "You" : event.payer ? truncateAddress(event.payer) : "Someone";
  return `${who} paid toward split #${event.splitId.toString()}`;
}

/**
 * Polls Soroban RPC's getEvents for this contract's ("split", "created"/"paid")
 * events, starting with a small lookback window and then cursor-paginating
 * forward so each subsequent poll only returns genuinely new activity.
 */
export default function LiveActivity({ currentAddress }: LiveActivityProps) {
  const [events, setEvents] = useState<SplitEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const cursorRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const page =
          cursorRef.current === null
            ? await fetchInitialEvents()
            : await fetchNewEvents(cursorRef.current);

        if (cancelled) return;
        cursorRef.current = page.cursor;
        setError(null);
        if (page.events.length > 0) {
          setEvents((prev) => [...page.events].reverse().concat(prev).slice(0, MAX_EVENTS));
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? "Failed to fetch live activity.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    }

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <section className="panel live-activity-panel">
      <h2 className="panel-title">
        <span className="panel-index">04</span> Live activity
        <span className="live-dot" aria-hidden="true" title="Polling Soroban RPC" />
      </h2>

      {loading && events.length === 0 && (
        <p className="field-hint">Watching Soroban RPC for split activity…</p>
      )}
      {error && <p className="field-error">{error}</p>}
      {!loading && !error && events.length === 0 && (
        <p className="field-hint">No split activity yet — create or pay into a split to see it here.</p>
      )}

      <ul className="activity-list">
        {events.map((event) => (
          <li key={event.id} className="activity-row">
            <span className={`activity-dot activity-dot-${event.kind}`} />
            <div>
              <p className="activity-text">{describeEvent(event, currentAddress)}</p>
              <a
                className="activity-tx-link"
                href={`https://stellar.expert/explorer/testnet/tx/${event.txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                ledger {event.ledger}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
