import ApplicationRemark from "../models/ApplicationRemark.js";
import { ApplicationRemarkRepository } from "../../../../domain/repositories/ApplicationRemarkRepository.js";
import { toPlain, toPlainList } from "./mappers.js";

export class MongooseApplicationRemarkRepository extends ApplicationRemarkRepository {
  async findByApplicationId(applicationId, options = {}) {
    const { sort } = options;
    let cursor = ApplicationRemark.find({ application_id: applicationId }).lean();
    if (sort) cursor = cursor.sort(sort);
    const docs = await cursor;
    return toPlainList(docs);
  }

  async createRemark(data) {
    const doc = await ApplicationRemark.create(data);
    return toPlain(doc);
  }
}
