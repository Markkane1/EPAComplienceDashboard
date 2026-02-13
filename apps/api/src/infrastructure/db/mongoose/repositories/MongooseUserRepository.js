import UserModel from "../models/User.js";
import { User } from "../../../../domain/entities/User.js";
import { UserRepository } from "../../../../domain/repositories/UserRepository.js";

export class MongooseUserRepository extends UserRepository {
  async findByEmail(email) {
    const doc = await UserModel.findOne({ email }).lean();
    return User.fromPersistence(doc);
  }

  async findById(id) {
    const doc = await UserModel.findById(id).lean();
    return User.fromPersistence(doc);
  }

  async findByCnic(cnic) {
    const doc = await UserModel.findOne({ cnic }).lean();
    return User.fromPersistence(doc);
  }

  async findByMagicLoginToken(tokenHash, now) {
    const doc = await UserModel.findOne({
      magic_login_token: tokenHash,
      magic_login_expires_at: { $gt: now },
    }).lean();
    return User.fromPersistence(doc);
  }

  async findByVerificationToken(tokenHash, now) {
    const doc = await UserModel.findOne({
      verification_token: tokenHash,
      verification_expires_at: { $gt: now },
    }).lean();
    return User.fromPersistence(doc);
  }

  async createUser(data) {
    const doc = await UserModel.create(data);
    return User.fromPersistence(doc);
  }

  async updateUser(id, updates) {
    const doc = await UserModel.findByIdAndUpdate(id, updates, { new: true });
    return User.fromPersistence(doc);
  }
}
