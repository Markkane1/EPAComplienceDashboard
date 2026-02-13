export class PasswordHasher {
  hash(_value, _rounds) {
    throw new Error("PasswordHasher.hash not implemented");
  }

  compare(_value, _hash) {
    throw new Error("PasswordHasher.compare not implemented");
  }
}
