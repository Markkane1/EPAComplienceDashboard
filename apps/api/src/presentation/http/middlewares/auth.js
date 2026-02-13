import jwt from "jsonwebtoken";
import { config } from "../../../infrastructure/config/config.js";
import User from "../../../infrastructure/db/mongoose/models/User.js";

export async function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

export function requireRole(roles) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    const isAllowed = userRoles.includes("super_admin") || roles.some((role) => userRoles.includes(role));
    if (!isAllowed) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}

export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return next();
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.userId);
    if (user) {
      req.user = user;
    }
  } catch {
    // ignore invalid token
  }
  return next();
}
