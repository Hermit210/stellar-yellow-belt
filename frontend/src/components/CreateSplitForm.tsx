import { useState, type FormEvent } from "react";
import { isValidStellarAddress } from "../lib/wallet";

interface ParticipantRow {
  address: string;
  share: string;
}

interface CreateSplitFormProps {
  disabled: boolean;
  submitting: boolean;
  onCreate: (
    description: string,
    totalAmount: bigint,
    participants: string[],
    shares: bigint[]
  ) => void;
}

function emptyRow(): ParticipantRow {
  return { address: "", share: "" };
}

export default function CreateSplitForm({ disabled, submitting, onCreate }: CreateSplitFormProps) {
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [participants, setParticipants] = useState<ParticipantRow[]>([emptyRow(), emptyRow()]);
  const [formError, setFormError] = useState<string | null>(null);

  const updateRow = (index: number, field: keyof ParticipantRow, value: string) => {
    setParticipants((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addRow = () => setParticipants((rows) => [...rows, emptyRow()]);

  const removeRow = (index: number) =>
    setParticipants((rows) => rows.filter((_, i) => i !== index));

  const shareSum = participants.reduce((sum, row) => sum + (Number(row.share) || 0), 0);
  const totalNum = Number(totalAmount) || 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!description.trim()) {
      setFormError("Give the split a description.");
      return;
    }
    if (!totalAmount || Number(totalAmount) <= 0) {
      setFormError("Enter a total amount greater than 0.");
      return;
    }
    if (participants.length === 0) {
      setFormError("Add at least one participant.");
      return;
    }
    for (const row of participants) {
      if (!isValidStellarAddress(row.address)) {
        setFormError(`"${row.address || "(empty)"}" isn't a valid Stellar address.`);
        return;
      }
      if (!row.share || Number(row.share) <= 0) {
        setFormError("Every participant needs a share greater than 0.");
        return;
      }
    }

    onCreate(
      description.trim(),
      BigInt(totalAmount),
      participants.map((row) => row.address.trim()),
      participants.map((row) => BigInt(row.share))
    );
  };

  return (
    <section className="panel">
      <h2 className="panel-title">
        <span className="panel-index">02</span> Create a split
      </h2>

      <form className="send-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Description</span>
          <input
            type="text"
            placeholder="Dinner at Court"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={disabled}
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Total amount</span>
          <input
            type="number"
            step="1"
            min="1"
            placeholder="1000"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            disabled={disabled}
            required
          />
        </label>

        <div className="participant-list">
          {participants.map((row, i) => (
            <div className="participant-row" key={i}>
              <input
                type="text"
                placeholder="GABC...WXYZ"
                value={row.address}
                onChange={(e) => updateRow(i, "address", e.target.value)}
                disabled={disabled}
                spellCheck={false}
                autoComplete="off"
                className="participant-address-input"
              />
              <input
                type="number"
                step="1"
                min="1"
                placeholder="share"
                value={row.share}
                onChange={(e) => updateRow(i, "share", e.target.value)}
                disabled={disabled}
                className="participant-share-input"
              />
              <button
                type="button"
                className="remove-row-btn"
                onClick={() => removeRow(i)}
                disabled={disabled || participants.length <= 1}
                aria-label="Remove participant"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-ghost btn-small" onClick={addRow} disabled={disabled}>
          + Add participant
        </button>

        {totalNum > 0 && shareSum !== totalNum && (
          <p className="field-hint">
            Shares add up to {shareSum}, total is {totalNum} — the contract allows this, but you
            probably want them to match.
          </p>
        )}

        {formError && <p className="field-error">{formError}</p>}

        <button
          className={`btn btn-primary btn-block${submitting ? " btn-sending" : ""}`}
          type="submit"
          disabled={disabled}
        >
          {submitting ? "Creating…" : "Create split"}
        </button>

        {!disabled ? null : <p className="field-hint">Connect your wallet to create a split.</p>}
      </form>
    </section>
  );
}
