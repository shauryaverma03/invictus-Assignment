export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return String(date);
}

export function dateValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getTime();
}
