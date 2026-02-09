const store = new Map();

const now = () => Date.now();

export const rateLimit = ({ windowMs = 60000, max = 10, keyGenerator }) => {
  return (req, res, next) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip;
    const entry = store.get(key);
    const currentTime = now();

    if (!entry || entry.resetAt <= currentTime) {
      store.set(key, { count: 1, resetAt: currentTime + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - currentTime) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }

    entry.count += 1;
    store.set(key, entry);
    return next();
  };
};
