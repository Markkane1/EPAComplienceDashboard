import ApplicationDocument from "../models/ApplicationDocument.js";
import { ApplicationDocumentRepository } from "../../../../domain/repositories/ApplicationDocumentRepository.js";
import { toPlain, toPlainList } from "./mappers.js";

export class MongooseApplicationDocumentRepository extends ApplicationDocumentRepository {
  async findById(id) {
    const doc = await ApplicationDocument.findById(id).lean();
    return toPlain(doc);
  }

  async findByIds(ids) {
    const docs = await ApplicationDocument.find({ _id: { $in: ids } }).lean();
    return toPlainList(docs);
  }

  async findByApplicationId(applicationId, options = {}) {
    const { sort } = options;
    let cursor = ApplicationDocument.find({ application_id: applicationId }).lean();
    if (sort) cursor = cursor.sort(sort);
    const docs = await cursor;
    return toPlainList(docs);
  }

  async createDocument(data) {
    const doc = await ApplicationDocument.create(data);
    return toPlain(doc);
  }
}
