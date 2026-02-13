import { isHearingOnlyUser } from "./utils.js";

export class ListApplicationRemarksUseCase {
  constructor({ applicationRepository, remarkRepository }) {
    this.applicationRepository = applicationRepository;
    this.remarkRepository = remarkRepository;
  }

  async execute({ id, user }) {
    const app = await this.applicationRepository.findById(id);
    if (!app) {
      return { status: 404, body: { message: "Application not found." } };
    }

    if (isHearingOnlyUser(user?.roles || []) && user?.district) {
      if (app.description?.district !== user.district) {
        return { status: 403, body: { message: "Forbidden" } };
      }
    }

    const remarks = await this.remarkRepository.findByApplicationId(app.id, { sort: { created_at: 1 } });
    return {
      status: 200,
      body: remarks.map((remark) => ({
        id: remark.id,
        remark: remark.remark,
        proceedings: remark.proceedings || null,
        remark_type: remark.remark_type || "general",
        status_at_time: remark.status_at_time,
        created_at: remark.created_at ? new Date(remark.created_at).toISOString() : null,
      })),
    };
  }
}
