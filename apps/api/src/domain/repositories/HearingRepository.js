export class HearingRepository {
  async findByApplicationId(_applicationId, _options = {}) {
    throw new Error("HearingRepository.findByApplicationId not implemented");
  }

  async findLatestByApplicationId(_applicationId) {
    throw new Error("HearingRepository.findLatestByApplicationId not implemented");
  }

  async countByApplicationId(_applicationId) {
    throw new Error("HearingRepository.countByApplicationId not implemented");
  }

  async createHearing(_data) {
    throw new Error("HearingRepository.createHearing not implemented");
  }

  async updateById(_id, _updates) {
    throw new Error("HearingRepository.updateById not implemented");
  }

  async updateMany(_query, _updates) {
    throw new Error("HearingRepository.updateMany not implemented");
  }
}
