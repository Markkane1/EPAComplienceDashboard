export class GetPublicApplicationUseCase {
  constructor({ applicationRepository }) {
    this.applicationRepository = applicationRepository;
  }

  async execute({ trackingId }) {
    const normalized = String(trackingId || "").trim().toUpperCase();
    const app = await this.applicationRepository.findByTrackingId(normalized);
    if (!app) {
      return { status: 200, body: [] };
    }

    return {
      status: 200,
      body: [
        {
          tracking_id: app.tracking_id,
          application_type: app.application_type,
          status: app.status,
          applicant_name: app.applicant_name,
          company_name: app.company_name || null,
          created_at: app.created_at ? new Date(app.created_at).toISOString() : null,
          updated_at: app.updated_at ? new Date(app.updated_at).toISOString() : null,
        },
      ],
    };
  }
}
