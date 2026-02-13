import { config } from "../../../infrastructure/config/config.js";

export const createApplicationController = ({
  createApplicationUseCase,
  getApplicationStatsUseCase,
  getApplicationByIdUseCase,
  listApplicationHearingsUseCase,
  setApplicationViolationUseCase,
  listApplicationsUseCase,
  updateApplicationUseCase,
  listApplicationDocumentsUseCase,
  uploadApplicationDocumentUseCase,
  listApplicationRemarksUseCase,
  markApplicationIncompleteUseCase,
  markApplicationCompleteUseCase,
  scheduleHearingUseCase,
  adjournHearingUseCase,
  approveApplicationUseCase,
  rejectApplicationUseCase,
}) => {
  const handle = (fn) => async (req, res, next) => {
    try {
      const result = await fn(req, res);
      if (!result) return;
      res.status(result.status ?? 200).json(result.body);
    } catch (error) {
      return next(error);
    }
  };

  return {
    create: handle((req) =>
      createApplicationUseCase.execute({
        payload: req.body,
        user: req.user || null,
        request: req,
      })
    ),
    stats: handle((req) => getApplicationStatsUseCase.execute({ user: req.user })),
    getById: handle((req) => getApplicationByIdUseCase.execute({ id: req.params.id, user: req.user })),
    listHearings: handle((req) =>
      listApplicationHearingsUseCase.execute({ id: req.params.id, user: req.user })
    ),
    setViolation: handle((req) =>
      setApplicationViolationUseCase.execute({
        id: req.params.id,
        violation_type: req.body?.violation_type,
        sub_violation: req.body?.sub_violation,
        user: req.user,
        request: req,
      })
    ),
    list: handle((req) => listApplicationsUseCase.execute({ query: req.query, user: req.user })),
    update: handle((req) =>
      updateApplicationUseCase.execute({
        id: req.params.id,
        payload: req.body,
        user: req.user,
        request: req,
      })
    ),
    listDocuments: handle((req) => {
      const baseUrl = config.publicBaseUrl || `${req.protocol}://${req.get("host")}`;
      return listApplicationDocumentsUseCase.execute({
        id: req.params.id,
        user: req.user,
        baseUrl,
      });
    }),
    uploadDocument: handle((req) => {
      const baseUrl = config.publicBaseUrl || `${req.protocol}://${req.get("host")}`;
      return uploadApplicationDocumentUseCase.execute({
        id: req.params.id,
        user: req.user || null,
        file: req.file,
        doc_type: req.body?.doc_type,
        request: req,
        baseUrl,
      });
    }),
    listRemarks: handle((req) =>
      listApplicationRemarksUseCase.execute({
        id: req.params.id,
        user: req.user,
      })
    ),
    markIncomplete: handle((req) =>
      markApplicationIncompleteUseCase.execute({
        id: req.params.id,
        remarks: req.body?.remarks,
        user: req.user,
        request: req,
      })
    ),
    markComplete: handle((req) =>
      markApplicationCompleteUseCase.execute({
        id: req.params.id,
        remarks: req.body?.remarks,
        user: req.user,
        request: req,
      })
    ),
    schedule: handle((req) =>
      scheduleHearingUseCase.execute({
        id: req.params.id,
        payload: req.body,
        user: req.user,
        request: req,
      })
    ),
    adjourn: handle((req) =>
      adjournHearingUseCase.execute({
        id: req.params.id,
        payload: req.body,
        file: req.file,
        user: req.user,
        request: req,
      })
    ),
    approve: handle((req) =>
      approveApplicationUseCase.execute({
        id: req.params.id,
        payload: req.body,
        file: req.file,
        user: req.user,
        request: req,
      })
    ),
    reject: handle((req) =>
      rejectApplicationUseCase.execute({
        id: req.params.id,
        payload: req.body,
        file: req.file,
        user: req.user,
        request: req,
      })
    ),
  };
};
