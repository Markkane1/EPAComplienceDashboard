import Application from "../models/Application.js";
import { ApplicationRepository } from "../../../../domain/repositories/ApplicationRepository.js";
import { toPlain, toPlainList } from "./mappers.js";

export class MongooseApplicationRepository extends ApplicationRepository {
  async createApplication(data) {
    const doc = await Application.create(data);
    return toPlain(doc);
  }

  async findById(id) {
    const doc = await Application.findById(id).lean();
    return toPlain(doc);
  }

  async findByTrackingId(trackingId) {
    const doc = await Application.findOne({ tracking_id: trackingId }).lean();
    return toPlain(doc);
  }

  async find(query, options = {}) {
    const { sort, skip, limit, select, lean = true } = options;
    let cursor = Application.find(query);
    if (select) cursor = cursor.select(select);
    if (lean) cursor = cursor.lean();
    if (sort) cursor = cursor.sort(sort);
    if (skip) cursor = cursor.skip(skip);
    if (limit || limit === 0) cursor = cursor.limit(limit);
    const docs = await cursor;
    return toPlainList(docs);
  }

  async count(query) {
    return Application.countDocuments(query);
  }

  async updateById(id, updates) {
    const doc = await Application.findByIdAndUpdate(id, updates, { new: true });
    return toPlain(doc);
  }
}
