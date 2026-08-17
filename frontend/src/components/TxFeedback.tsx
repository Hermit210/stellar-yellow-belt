export type TxFeedbackStatus = "idle" | "pending" | "success" | "error";

interface TxFeedbackProps {
  status: TxFeedbackStatus;
  pendingText: string;
  successText: string;
  hash?: string;
  errorMessage?: string;
}

export default function TxFeedback({
  status,
  pendingText,
  successText,
  hash,
  errorMessage,
}: TxFeedbackProps) {
  if (status === "idle") return null;

  return (
    <section key={status} className={`tx-feedback tx-${status}`} role="status">
      {status === "pending" && (
        <>
          <span className="tx-dot tx-dot-pending" />
          <div>
            <p className="tx-title">Submitting transaction…</p>
            <p className="tx-sub">{pendingText}</p>
          </div>
        </>
      )}

      {status === "success" && (
        <>
          <span className="tx-dot tx-dot-success" />
          <div>
            <p className="tx-title">{successText}</p>
            {hash && (
              <p className="tx-sub">
                Hash:{" "}
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="tx-hash-link"
                >
                  {hash}
                </a>
              </p>
            )}
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <span className="tx-dot tx-dot-error" />
          <div>
            <p className="tx-title">Transaction failed</p>
            <p className="tx-sub">{errorMessage}</p>
          </div>
        </>
      )}
    </section>
  );
}
