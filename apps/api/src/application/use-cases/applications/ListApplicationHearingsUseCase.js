import { mapHearingResponse } from "../../dtos/mapHearingResponse.js";
import { isHearingOnlyUser } from "./utils.js";

export class ListApplicationHearingsUseCase {
  constructor({ applicationRepository, hearingRepository, documentRepository }) {
    this.applicationRepository = applicationRepository;
    this.hearingRepository = hearingRepository;
    this.documentRepository = documentRepository;
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

    const hearings = await this.hearingRepository.findByApplicationId(app.id, {
      sort: { hearing_date: 1 },
    });
    const hearingOrderIds = hearings.map((hearing) => hearing.hearing_order_document_id).filter(Boolean);
    const hearingOrderDocs = hearingOrderIds.length
      ? await this.documentRepository.findByIds(hearingOrderIds)
      : [];
    const hearingOrderMap = new Map(
      hearingOrderDocs.map((doc) => [doc.id, { id: doc.id, file_name: doc.file_name }])
    );

    const response = hearings.map((hearing) =>
      mapHearingResponse(
        hearing,
        hearing.hearing_order_document_id &&
          hearingOrderMap.has(hearing.hearing_order_document_id?.toString?.() || hearing.hearing_order_document_id)
          ? hearingOrderMap.get(hearing.hearing_order_document_id?.toString?.() || hearing.hearing_order_document_id)
          : null
      )
    );

    return { status: 200, body: response };
  }
}
