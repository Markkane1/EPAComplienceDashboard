export const createHearingOrderDocument = async ({
  applicationId,
  file,
  userId,
  applicationDocumentRepository,
  fileStorage,
}) => {
  const relativePath = fileStorage.relativeToUploadDir(file.path);
  const fileName = `Hearing Order: ${file.originalname}`;
  return applicationDocumentRepository.createDocument({
    application_id: applicationId,
    file_name: fileName,
    file_path: `uploads/${relativePath}`,
    file_type: file.mimetype,
    file_size: file.size,
    created_by: userId || null,
    updated_by: userId || null,
  });
};

export const attachHearingOrderToLatest = async ({ applicationId, hearingRepository, documentId }) => {
  const latestHearing = await hearingRepository.findLatestByApplicationId(applicationId);
  if (latestHearing) {
    await hearingRepository.updateById(latestHearing.id, { hearing_order_document_id: documentId });
  }
};
