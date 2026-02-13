export class UserRepository {
  async findByEmail(_email) {
    throw new Error("UserRepository.findByEmail not implemented");
  }

  async findById(_id) {
    throw new Error("UserRepository.findById not implemented");
  }

  async findByCnic(_cnic) {
    throw new Error("UserRepository.findByCnic not implemented");
  }

  async findByMagicLoginToken(_tokenHash, _now) {
    throw new Error("UserRepository.findByMagicLoginToken not implemented");
  }

  async findByVerificationToken(_tokenHash, _now) {
    throw new Error("UserRepository.findByVerificationToken not implemented");
  }

  async createUser(_data) {
    throw new Error("UserRepository.createUser not implemented");
  }

  async updateUser(_id, _updates) {
    throw new Error("UserRepository.updateUser not implemented");
  }
}
