import HearingDate from "../models/HearingDate.js";
import { HearingRepository } from "../../../../domain/repositories/HearingRepository.js";
import { toPlain, toPlainList } from "./mappers.js";

export class MongooseHearingRepository extends HearingRepository {
  async findByApplicationId(applicationId, options = {}) {
    const { sort } = options;
    let cursor = HearingDate.find({ application_id: applicationId }).lean();
    if (sort) cursor = cursor.sort(sort);
    const docs = await cursor;
    return toPlainList(docs);
  }

  async findLatestByApplicationId(applicationId) {
    const docs = await HearingDate.find({ application_id: applicationId })
      .sort({ sequence_no: -1, hearing_date: -1 })
      .limit(1)
      .lean();
    return docs.length ? toPlain(docs[0]) : null;
  }

  async countByApplicationId(applicationId) {
    return HearingDate.countDocuments({ application_id: applicationId });
  }

  async createHearing(data) {
    const doc = await HearingDate.create(data);
    return toPlain(doc);
  }

  async updateById(id, updates) {
    const doc = await HearingDate.findByIdAndUpdate(id, updates, { new: true });
    return toPlain(doc);
  }

  async updateMany(query, updates) {
    return HearingDate.updateMany(query, updates);
  }
}
