export function formatMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "$0.00";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

// Splits `amount` into whole cents across `ids`, handing any leftover cent(s)
// to the first ids in the list, so the shares always add back up to the
// original amount exactly (no money invented or lost to rounding).
export function splitEqual(amount, ids) {
  const n = ids.length || 1;
  const totalCents = Math.round(Number(amount) * 100);
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  const shares = {};
  ids.forEach((id, i) => {
    const cents = base + (i < remainder ? 1 : 0);
    shares[id] = cents / 100;
  });
  return shares;
}

export function percentsSumTo100(percents) {
  const values = Object.values(percents).map(Number);
  const sum = values.reduce((a, b) => a + b, 0);
  // Allow for floating point noise (e.g. 33.33 + 33.33 + 33.34 can land on
  // 99.99999999999999), but not for percentages that are genuinely off.
  return Math.abs(sum - 100) < 0.005;
}

// Same largest-remainder idea as splitEqual: round each percentage's share
// down to whole cents, then hand out the leftover cents to the entries that
// were rounded down the most, so the total still matches `amount` exactly.
export function splitByPercent(amount, percents) {
  const totalCents = Math.round(Number(amount) * 100);
  const entries = Object.entries(percents).map(([id, pct]) => ({
    id,
    // share in dollars is (amount * pct / 100); in cents that's amount * pct
    rawCents: Number(amount) * Number(pct),
  }));

  let allocated = 0;
  const withBase = entries.map((e) => {
    const base = Math.floor(e.rawCents);
    allocated += base;
    return { id: e.id, base, remainder: e.rawCents - base };
  });

  let leftover = totalCents - allocated;
  const order = [...withBase].sort((a, b) => b.remainder - a.remainder);
  const bonus = new Set();
  for (const entry of order) {
    if (leftover <= 0) break;
    bonus.add(entry.id);
    leftover -= 1;
  }

  const shares = {};
  for (const entry of withBase) {
    const cents = entry.base + (bonus.has(entry.id) ? 1 : 0);
    shares[entry.id] = cents / 100;
  }
  return shares;
}

export function sharesForExpense(expense) {
  if (expense.splitType === "percent" && expense.percents) {
    return splitByPercent(expense.amount, expense.percents);
  }
  return splitEqual(expense.amount, expense.splitWith);
}
