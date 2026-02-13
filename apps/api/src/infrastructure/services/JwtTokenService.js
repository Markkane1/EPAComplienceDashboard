import jwt from "jsonwebtoken";
import { TokenService } from "../../application/ports/TokenService.js";

export class JwtTokenService extends TokenService {
  constructor(secret) {
    super();
    this.secret = secret;
  }

  signToken(payload, options = {}) {
    return jwt.sign(payload, this.secret, options);
  }

  verifyToken(token) {
    return jwt.verify(token, this.secret);
  }
}
