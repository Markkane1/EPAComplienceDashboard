export const mapHearingResponse = (hearing, hearingOrderDoc = null) => {
  const id = hearing.id || hearing._id?.toString?.() || hearing._id || null;
  return {
    id,
    hearing_date: hearing.hearing_date ? new Date(hearing.hearing_date).toISOString() : null,
    hearing_type: hearing.hearing_type,
    is_active: Boolean(hearing.is_active),
    sequence_no: hearing.sequence_no,
    hearing_order_document: hearingOrderDoc
      ? {
          id: hearingOrderDoc.id || hearingOrderDoc._id?.toString?.() || hearingOrderDoc._id || null,
          file_name: hearingOrderDoc.file_name,
        }
      : null,
    created_at: hearing.created_at ? new Date(hearing.created_at).toISOString() : null,
  };
};
