import { useState, type FormEvent } from "react";

interface PayShareFormProps {
  remaining: bigint;
  submitting: boolean;
  onPay: (amount: bigint) => void;
}

export default function PayShareForm({ remaining, submitting, onPay }: PayShareFormProps) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!amount || Number(amount) <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    const parsed = BigInt(amount);
    if (parsed > remaining) {
      setError(`That's more than your remaining share (${remaining}).`);
      return;
    }
    onPay(parsed);
    setAmount("");
  };

  return (
    <form className="send-form pay-share-form" onSubmit={handleSubmit}>
      <label className="field">
        <span className="field-label">Pay toward your share (remaining: {remaining.toString()})</span>
        <input
          type="number"
          step="1"
          min="1"
          max={remaining.toString()}
          placeholder="100"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={submitting || remaining <= 0n}
          required
        />
      </label>

      {error && <p className="field-error">{error}</p>}

      <button
        className={`btn btn-primary btn-block${submitting ? " btn-sending" : ""}`}
        type="submit"
        disabled={submitting || remaining <= 0n}
      >
        {remaining <= 0n ? "Fully paid" : submitting ? "Paying…" : "Pay share"}
      </button>
    </form>
  );
}
