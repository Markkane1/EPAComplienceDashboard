import { isHearingOnlyUser } from "./utils.js";

export class GetApplicationStatsUseCase {
  constructor({ applicationRepository }) {
    this.applicationRepository = applicationRepository;
  }

  async execute({ user }) {
    const userRoles = user?.roles || [];
    const isHearingOnly = isHearingOnlyUser(userRoles);
    const query = {};
    if (isHearingOnly) {
      if (user?.district) {
        query["description.district"] = user.district;
      } else {
        query["description.district"] = "__none__";
      }
    }

    const applications = await this.applicationRepository.find(query, { select: { status: 1 } });
    const counts = {
      total: applications.length,
      submitted: applications.filter((a) => a.status === "submitted").length,
      hearing_scheduled: applications.filter((a) => a.status === "hearing_scheduled").length,
      approved: applications.filter((a) => a.status === "approved_resolved").length,
      incomplete: applications.filter((a) => a.status === "incomplete").length,
    };
    return { status: 200, body: counts };
  }
}
