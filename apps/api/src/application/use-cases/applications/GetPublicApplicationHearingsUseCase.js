export class GetPublicApplicationHearingsUseCase {
  constructor({ applicationRepository, hearingRepository }) {
    this.applicationRepository = applicationRepository;
    this.hearingRepository = hearingRepository;
  }

  async execute({ trackingId }) {
    const normalized = String(trackingId || "").trim().toUpperCase();
    const app = await this.applicationRepository.findByTrackingId(normalized);
    if (!app) {
      return { status: 200, body: [] };
    }

    const hearings = await this.hearingRepository.findByApplicationId(app.id, {
      sort: { hearing_date: 1 },
    });
    const response = hearings.map((hearing) => ({
      id: hearing.id,
      hearing_date: hearing.hearing_date ? new Date(hearing.hearing_date).toISOString() : null,
      hearing_type: hearing.hearing_type,
    }));
    return { status: 200, body: response };
  }
}
