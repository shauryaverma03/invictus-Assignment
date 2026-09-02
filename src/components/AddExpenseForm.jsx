import { useEffect, useMemo, useRef, useState } from "react";
import { percentsSumTo100 } from "../lib/money.js";

const CATEGORIES = ["Food", "Travel", "Fun", "Stay"];

function todayISO() {
  // Build the date from local calendar components, not toISOString() (which
  // is UTC). For anyone west of Greenwich in the evening, or east of it in
  // the early morning, toISOString() lands on the *other* calendar day from
  // what the user's clock actually shows.
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function evenPercents(ids) {
  if (!ids.length) return {};
  const base = Number((100 / ids.length).toFixed(2));
  const pcts = {};
  ids.forEach((id, i) => {
    pcts[id] = i === ids.length - 1 ? Number((100 - base * (ids.length - 1)).toFixed(2)) : base;
  });
  return pcts;
}

export default function AddExpenseForm({ members, onAdd }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(members[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState("Food");
  const [splitType, setSplitType] = useState("equal");
  const [splitWith, setSplitWith] = useState(members.map((m) => m.id));
  const [percents, setPercents] = useState(evenPercents(members.map((m) => m.id)));
  const [error, setError] = useState("");

  const selected = useMemo(
    () => members.filter((m) => splitWith.includes(m.id)),
    [members, splitWith]
  );

  // The founding members default to selected in "Split between" because
  // splitWith is seeded from `members` on first mount. But this form never
  // unmounts, so anyone added to the group *after* that — via "Add member"
  // in the Summary panel — was silently left unselected instead, with no
  // visual difference to flag it. Keep new arrivals included by default,
  // the same way everyone already in the group is.
  const prevMemberIdsRef = useRef(members.map((m) => m.id));
  useEffect(() => {
    const prevIds = prevMemberIdsRef.current;
    const newIds = members.map((m) => m.id).filter((id) => !prevIds.includes(id));
    if (newIds.length) {
      setSplitWith((prev) => [...prev, ...newIds.filter((id) => !prev.includes(id))]);
      setPercents((prev) => {
        const next = { ...prev };
        newIds.forEach((id) => {
          if (!(id in next)) next[id] = 0;
        });
        return next;
      });
    }
    prevMemberIdsRef.current = members.map((m) => m.id);
  }, [members]);

  // Adding or removing someone from the split should only touch their own
  // percentage row — it must never throw away percentages the user already
  // typed in for everyone else.
  function toggleMember(id) {
    setSplitWith((prev) => {
      const isRemoving = prev.includes(id);
      const next = isRemoving ? prev.filter((x) => x !== id) : [...prev, id];
      setPercents((prev) => {
        if (isRemoving) {
          const rest = { ...prev };
          delete rest[id];
          return rest;
        }
        // Default a newly-added person to 0% rather than guessing how to
        // redistribute everyone else's numbers for them.
        return { ...prev, [id]: 0 };
      });
      return next;
    });
  }

  function submit(e) {
    e.preventDefault();
    setError("");
    const n = Number(amount);
    if (!description.trim() || !Number.isFinite(n) || n <= 0) {
      setError("Add a description and a positive amount.");
      return;
    }
    const parsedDate = new Date(date);
    if (!date || Number.isNaN(parsedDate.getTime())) {
      setError("Pick a valid date.");
      return;
    }
    if (!splitWith.length) {
      setError("Pick at least one person to split with.");
      return;
    }
    if (splitType === "percent" && !percentsSumTo100(percents)) {
      setError("Percentages must add to 100.");
      return;
    }

    // Round to the nearest cent so the stored amount is always a clean
    // currency value — never more precise than money actually is.
    const roundedAmount = Math.round(n * 100) / 100;

    onAdd({
      description: description.trim(),
      amount: roundedAmount,
      paidBy: Number(paidBy),
      splitType,
      splitWith: splitWith.map(Number),
      percents: splitType === "percent" ? percents : undefined,
      date: parsedDate,
      category,
    });

    setDescription("");
    setAmount("");
  }

  return (
    <section className="card">
      <h2>Add expense</h2>
      <form onSubmit={submit}>
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <label htmlFor="desc">Description</label>
            <input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this for?"
            />
          </div>
          <div className="field">
            <label htmlFor="amt">Amount</label>
            <input
              id="amt"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="payer">Paid by</label>
            <select
              id="payer"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="cat">Category</label>
            <select
              id="cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="legend">Split between</div>
          <div className="chips" style={{ marginTop: 6 }}>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`chip ${splitWith.includes(m.id) ? "on" : ""}`}
                onClick={() => toggleMember(m.id)}
              >
                {m.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <label className="check">
            <input
              type="radio"
              name="splitType"
              checked={splitType === "equal"}
              onChange={() => setSplitType("equal")}
            />
            Split equally
          </label>
          <label className="check">
            <input
              type="radio"
              name="splitType"
              checked={splitType === "percent"}
              onChange={() => {
                setSplitType("percent");
                // Only seed an even split the first time — don't clobber
                // percentages the user already customized for this exact
                // group of people if they're just switching modes back and forth.
                setPercents((prev) => {
                  const keys = Object.keys(prev).map(Number);
                  const matchesCurrentSplit =
                    splitWith.length === keys.length &&
                    splitWith.every((id) => keys.includes(id));
                  return matchesCurrentSplit ? prev : evenPercents(splitWith);
                });
              }}
            />
            Custom %
          </label>
        </div>

        {splitType === "percent" && (
          <div className="percent-grid">
            {selected.map((m) => (
              <div className="percent-row" key={m.id}>
                <span>{m.name}</span>
                <input
                  type="number"
                  step="0.01"
                  value={percents[m.id] ?? ""}
                  onChange={(e) =>
                    setPercents((p) => ({ ...p, [m.id]: Number(e.target.value) }))
                  }
                />
              </div>
            ))}
          </div>
        )}

        {error && <p className="error">{error}</p>}
        <div style={{ marginTop: 12 }}>
          <button className="btn" type="submit">
            Save expense
          </button>
        </div>
      </form>
    </section>
  );
}
