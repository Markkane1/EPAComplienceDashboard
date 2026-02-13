export const toPlain = (doc) => {
  if (!doc) return null;
  const raw = doc.toObject ? doc.toObject() : doc;
  const id = raw._id?.toString?.() || raw.id?.toString?.() || raw._id || raw.id || null;
  return { ...raw, id, _id: raw._id || id };
};

export const toPlainList = (docs) => (docs || []).map(toPlain).filter(Boolean);
