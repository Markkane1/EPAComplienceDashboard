export const createDocumentController = ({ downloadDocumentUseCase }) => {
  const handle = (fn) => async (req, res, next) => {
    try {
      const result = await fn(req, res);
      if (!result) return;
      if (result.download) {
        return res.download(result.download.path, result.download.filename);
      }
      return res.status(result.status ?? 200).json(result.body);
    } catch (error) {
      return next(error);
    }
  };

  return {
    download: handle((req) =>
      downloadDocumentUseCase.execute({
        id: req.params.id,
        user: req.user,
      })
    ),
  };
};
