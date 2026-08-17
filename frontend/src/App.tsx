import { useCallback, useState } from "react";
import "./App.css";
import { connectWallet, disconnectWallet } from "./lib/wallet";
import { createSplit, getRecentSplits, getSplit, payShare, type Split } from "./lib/contract";
import WalletPanel from "./components/WalletPanel";
import CreateSplitForm from "./components/CreateSplitForm";
import SplitLookup from "./components/SplitLookup";
import TxFeedback, { type TxFeedbackStatus } from "./components/TxFeedback";

interface ActionState {
  status: TxFeedbackStatus;
  hash?: string;
  message?: string;
}

const idleState: ActionState = { status: "idle" };

function App() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [createState, setCreateState] = useState<ActionState>(idleState);

  const [lookupId, setLookupId] = useState("");
  const [split, setSplit] = useState<Split | null>(null);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [recentSplits, setRecentSplits] = useState<bigint[]>([]);

  const [payState, setPayState] = useState<ActionState>(idleState);

  const refreshRecent = useCallback(async (source: string) => {
    try {
      const ids = await getRecentSplits(source);
      setRecentSplits(ids);
    } catch {
      // Non-critical — recent-splits list is a convenience, not required for lookup.
    }
  }, []);

  const lookupSplit = useCallback(
    async (source: string, id: string) => {
      setSplitLoading(true);
      setSplitError(null);
      try {
        const result = await getSplit(source, BigInt(id));
        setSplit(result);
      } catch (err: any) {
        setSplit(null);
        setSplitError(err.message ?? "Failed to look up that split.");
      } finally {
        setSplitLoading(false);
      }
    },
    []
  );

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const { publicKey: pk, network: net } = await connectWallet();
      setPublicKey(pk);
      setNetwork(net);
      refreshRecent(pk);
    } catch (err: any) {
      setConnectError(err.message ?? "Failed to connect wallet.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setPublicKey(null);
    setNetwork(null);
    setCreateState(idleState);
    setPayState(idleState);
    setSplit(null);
    setSplitError(null);
    setRecentSplits([]);
  };

  const handleCreateSplit = async (
    description: string,
    totalAmount: bigint,
    participants: string[],
    shares: bigint[]
  ) => {
    if (!publicKey) return;

    setCreateState({ status: "pending" });
    try {
      const { id, hash } = await createSplit(publicKey, description, totalAmount, participants, shares);
      setCreateState({ status: "success", hash });
      refreshRecent(publicKey);
      setLookupId(id.toString());
      lookupSplit(publicKey, id.toString());
    } catch (err: any) {
      setCreateState({ status: "error", message: err.message ?? "Failed to create split." });
    }
  };

  const handleLookup = () => {
    if (!publicKey || !lookupId) return;
    lookupSplit(publicKey, lookupId);
  };

  const handleSelectRecent = (id: bigint) => {
    setLookupId(id.toString());
    if (publicKey) lookupSplit(publicKey, id.toString());
  };

  const handlePayShare = async (amount: bigint) => {
    if (!publicKey || !split) return;

    setPayState({ status: "pending" });
    try {
      const { hash } = await payShare(publicKey, split.id, amount);
      setPayState({ status: "success", hash });
      lookupSplit(publicKey, split.id.toString());
    } catch (err: any) {
      setPayState({ status: "error", message: err.message ?? "Failed to pay share." });
    }
  };

  const walletConnected = Boolean(publicKey);

  return (
    <div className="app-shell">
      <div className="orbit-field" aria-hidden="true">
        <span className="orbit-dot dot-a" />
        <span className="orbit-dot dot-b" />
        <span className="orbit-dot dot-c" />
      </div>

      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">✦</span>
          <span className="brand-name">SplitStellar</span>
        </div>
        <span className="network-pill">Stellar Testnet</span>
      </header>

      <main className="app-main">
        <section className="hero">
          <p className="eyebrow">Yellow Belt · Level 2</p>
          <h1>Track who owes what in a group, on-chain.</h1>
          <p className="hero-sub">
            Connect Freighter, create a split with a description and a list of participant
            shares, and let each participant pay their portion straight into a Soroban
            contract. Second building block of SplitStellar's group-payments journey —
            White Belt was "send one payment," this is "track a group of them."
          </p>
        </section>

        <div className="panel-grid">
          <WalletPanel
            publicKey={publicKey}
            network={network}
            connecting={connecting}
            connectError={connectError}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />

          <CreateSplitForm
            disabled={!walletConnected || createState.status === "pending"}
            submitting={createState.status === "pending"}
            onCreate={handleCreateSplit}
          />
        </div>

        <TxFeedback
          status={createState.status}
          pendingText="Waiting on your signature, then Soroban RPC."
          successText="Split created"
          hash={createState.hash}
          errorMessage={createState.message}
        />

        <SplitLookup
          lookupId={lookupId}
          onLookupIdChange={setLookupId}
          onLookup={handleLookup}
          disabled={!walletConnected}
          loading={splitLoading}
          error={splitError}
          split={split}
          recentSplits={recentSplits}
          onSelectRecent={handleSelectRecent}
          publicKey={publicKey}
          payStatus={payState.status}
          payHash={payState.hash}
          payError={payState.message}
          paySubmitting={payState.status === "pending"}
          onPayShare={handlePayShare}
        />
      </main>

      <footer className="app-footer">
        <p>
          Built for Stellar Journey to Mastery (Yellow Belt) · Testnet only, no real funds
          involved.
        </p>
      </footer>
    </div>
  );
}

export default App;
