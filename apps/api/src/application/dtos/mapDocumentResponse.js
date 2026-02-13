export const mapDocumentResponse = (doc, baseUrl = "") => {
  const id = doc.id || doc._id?.toString?.() || doc._id || null;
  const urlBase = baseUrl.replace(/\/$/, "");
  const filePath = doc.file_path;
  const fileUrl = urlBase ? `${urlBase}/${filePath.replace(/^\/+/, "")}` : `/${filePath.replace(/^\/+/, "")}`;
  return {
    id,
    application_id: doc.application_id?.toString?.() || doc.application_id,
    file_name: doc.file_name,
    file_path: doc.file_path,
    file_type: doc.file_type || null,
    file_size: doc.file_size || null,
    created_by: doc.created_by || null,
    updated_by: doc.updated_by || null,
    uploaded_at: doc.uploaded_at ? new Date(doc.uploaded_at).toISOString() : null,
    file_url: fileUrl,
  };
};
