import { type FormEvent } from "react";
import { TX_STAGE_TEXT, type Split, type TxStage } from "../lib/contract";
import PayShareForm from "./PayShareForm";
import TxFeedback, { type TxFeedbackStatus } from "./TxFeedback";

interface SplitLookupProps {
  lookupId: string;
  onLookupIdChange: (value: string) => void;
  onLookup: () => void;
  disabled: boolean;
  loading: boolean;
  error: string | null;
  split: Split | null;
  recentSplits: bigint[];
  onSelectRecent: (id: bigint) => void;
  publicKey: string | null;
  payStatus: TxFeedbackStatus;
  payHash?: string;
  payError?: string;
  payStage?: TxStage;
  paySubmitting: boolean;
  onPayShare: (amount: bigint) => void;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export default function SplitLookup({
  lookupId,
  onLookupIdChange,
  onLookup,
  disabled,
  loading,
  error,
  split,
  recentSplits,
  onSelectRecent,
  publicKey,
  payStatus,
  payHash,
  payError,
  payStage,
  paySubmitting,
  onPayShare,
}: SplitLookupProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onLookup();
  };

  const totalPaid = split ? split.paid.reduce((sum, p) => sum + p, 0n) : 0n;
  const progressPct =
    split && split.totalAmount > 0n ? Number((totalPaid * 100n) / split.totalAmount) : 0;

  const myIndex = split && publicKey ? split.participants.indexOf(publicKey) : -1;
  const myRemaining =
    myIndex >= 0 && split ? split.shares[myIndex] - split.paid[myIndex] : 0n;

  return (
    <section className="panel split-lookup-panel">
      <h2 className="panel-title">
        <span className="panel-index">03</span> Look up a split
      </h2>

      <form className="lookup-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Split ID</span>
          <input
            type="number"
            step="1"
            min="0"
            placeholder="0"
            value={lookupId}
            onChange={(e) => onLookupIdChange(e.target.value)}
            disabled={disabled}
            required
          />
        </label>
        <button className="btn btn-outline" type="submit" disabled={disabled || loading}>
          {loading ? "Looking up…" : "Look up"}
        </button>
      </form>

      {recentSplits.length > 0 && (
        <div className="chip-list">
          {recentSplits.map((id) => (
            <button
              key={id.toString()}
              type="button"
              className="chip"
              onClick={() => onSelectRecent(id)}
              disabled={disabled}
            >
              #{id.toString()}
            </button>
          ))}
        </div>
      )}

      {error && <p className="field-error">{error}</p>}

      {split && (
        <div className="split-card">
          <div className="split-card-header">
            <h3>{split.description}</h3>
            <span className="panel-index">#{split.id.toString()}</span>
          </div>
          <p className="wallet-label">
            Created by <span className="wallet-address">{truncateAddress(split.creator)}</span>
          </p>

          <div className="progress-bar" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${Math.min(progressPct, 100)}%` }} />
          </div>
          <p className="field-hint">
            {totalPaid.toString()} / {split.totalAmount.toString()} paid
          </p>

          <ul className="participant-status-list">
            {split.participants.map((address, i) => (
              <li key={address} className="participant-status-row">
                <span className="wallet-address" title={address}>
                  {truncateAddress(address)}
                  {address === publicKey && " (you)"}
                </span>
                <span className="wallet-label">
                  {split.paid[i].toString()} / {split.shares[i].toString()}
                </span>
              </li>
            ))}
          </ul>

          {myIndex >= 0 && (
            <>
              <PayShareForm remaining={myRemaining} submitting={paySubmitting} onPay={onPayShare} />
              <TxFeedback
                status={payStatus}
                pendingText={payStage ? TX_STAGE_TEXT[payStage] : "Preparing transaction…"}
                successText="Payment recorded"
                hash={payHash}
                errorMessage={payError}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}
