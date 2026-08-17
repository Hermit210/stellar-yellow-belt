interface WalletPanelProps {
  publicKey: string | null;
  network: string | null;
  connecting: boolean;
  connectError: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export default function WalletPanel({
  publicKey,
  network,
  connecting,
  connectError,
  onConnect,
  onDisconnect,
}: WalletPanelProps) {
  return (
    <section className="panel wallet-panel">
      <h2 className="panel-title">
        <span className="panel-index">01</span> Wallet
      </h2>

      {!publicKey ? (
        <div className="wallet-empty">
          <p>Connect Freighter to create splits, look them up, and pay your share.</p>
          <button className="btn btn-primary" onClick={onConnect} disabled={connecting}>
            {connecting ? "Connecting…" : "Connect Freighter"}
          </button>
          {connectError && <p className="field-error">{connectError}</p>}
        </div>
      ) : (
        <div className="wallet-connected">
          <div className="wallet-row">
            <span className="wallet-label">Address</span>
            <span className="wallet-address" title={publicKey}>
              {truncateAddress(publicKey)}
            </span>
          </div>

          <div className="wallet-row">
            <span className="wallet-label">Network</span>
            <span className="status-chip">{network ?? "TESTNET"}</span>
          </div>

          <div className="wallet-actions">
            <button className="btn btn-outline" onClick={onDisconnect}>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
