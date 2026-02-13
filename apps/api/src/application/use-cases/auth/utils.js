export const normalizeContact = (value) => String(value || "").replace(/[\s-]/g, "");

export const isValidPkContact = (value) => {
  if (!value) return true;
  const normalized = normalizeContact(value);
  return /^(\\+92|0)3\\d{9}$/.test(normalized);
};
