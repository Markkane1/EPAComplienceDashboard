import bcrypt from "bcryptjs";
import { PasswordHasher } from "../../application/ports/PasswordHasher.js";

export class BcryptPasswordHasher extends PasswordHasher {
  async hash(value, rounds = 10) {
    return bcrypt.hash(value, rounds);
  }

  async compare(value, hash) {
    return bcrypt.compare(value, hash);
  }
}
