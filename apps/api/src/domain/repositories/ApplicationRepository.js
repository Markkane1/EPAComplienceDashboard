export class ApplicationRepository {
  async createApplication(_data) {
    throw new Error("ApplicationRepository.createApplication not implemented");
  }

  async findById(_id) {
    throw new Error("ApplicationRepository.findById not implemented");
  }

  async findByTrackingId(_trackingId) {
    throw new Error("ApplicationRepository.findByTrackingId not implemented");
  }

  async find(_query, _options = {}) {
    throw new Error("ApplicationRepository.find not implemented");
  }

  async count(_query) {
    throw new Error("ApplicationRepository.count not implemented");
  }

  async updateById(_id, _updates) {
    throw new Error("ApplicationRepository.updateById not implemented");
  }
}
