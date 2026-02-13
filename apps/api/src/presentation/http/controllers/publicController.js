/**
 * @typedef {import("@repo/shared").TrackedApplication} TrackedApplication
 * @typedef {import("@repo/shared").HearingInfo} HearingInfo
 */
export const createPublicController = ({ getPublicApplicationUseCase, getPublicApplicationHearingsUseCase }) => {
  const handle = (fn) => async (req, res, next) => {
    try {
      const result = await fn(req, res);
      if (!result) return;
      return res.status(result.status ?? 200).json(result.body);
    } catch (error) {
      return next(error);
    }
  };

  return {
    getApplication: handle((req) =>
      getPublicApplicationUseCase.execute({
        trackingId: req.params.trackingId,
      })
    ),
    getHearings: handle((req) =>
      getPublicApplicationHearingsUseCase.execute({
        trackingId: req.params.trackingId,
      })
    ),
  };
};
