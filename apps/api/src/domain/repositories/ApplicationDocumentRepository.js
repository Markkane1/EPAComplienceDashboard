export class ApplicationDocumentRepository {
  async findById(_id) {
    throw new Error("ApplicationDocumentRepository.findById not implemented");
  }

  async findByIds(_ids) {
    throw new Error("ApplicationDocumentRepository.findByIds not implemented");
  }

  async findByApplicationId(_applicationId, _options = {}) {
    throw new Error("ApplicationDocumentRepository.findByApplicationId not implemented");
  }

  async createDocument(_data) {
    throw new Error("ApplicationDocumentRepository.createDocument not implemented");
  }
}
