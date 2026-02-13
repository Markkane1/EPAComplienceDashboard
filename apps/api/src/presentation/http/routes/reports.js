import { Router } from "express";
import PDFDocument from "pdfkit";
import Application from "../../../infrastructure/db/mongoose/models/Application.js";
import User from "../../../infrastructure/db/mongoose/models/User.js";
import { authRequired, requireRole } from "../middlewares/auth.js";

const router = Router();
router.use(authRequired);
router.use(requireRole(["hearing_officer", "registrar", "admin", "super_admin"]));

const isHearingOnlyUser = (roles = []) =>
  roles.includes("hearing_officer") &&
  !roles.includes("admin") &&
  !roles.includes("super_admin") &&
  !roles.includes("registrar");

const STATUS_GROUPS = {
  pending: ["submitted", "complete", "incomplete", "hearing_scheduled", "under_hearing"],
  approved: ["approved_resolved"],
  rejected: ["rejected_closed"],
};

const toStartOfDay = (value) => new Date(`${String(value)}T00:00:00`);
const toEndOfDay = (value) => new Date(`${String(value)}T23:59:59.999`);

const formatDateLabel = (value) => {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return String(value);
  return `${day}-${month}-${year}`;
};

const formatRowDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const buildHearingOfficerReport = async ({ from, to, violationType, subViolation, user }) => {
  const fromDate = toStartOfDay(from);
  const toDate = toEndOfDay(to);

  const baseQuery = {
    created_at: { $gte: fromDate, $lte: toDate },
  };
  if (violationType) {
    baseQuery["description.violation_type"] = String(violationType);
  }
  if (subViolation) {
    baseQuery["description.sub_violation"] = String(subViolation);
  }

  const applications = await Application.find(baseQuery).lean().sort({ created_at: 1 });

  const officerIds = applications
    .map((app) => app.assigned_hearing_officer_id || app.hearing_officer_id)
    .filter(Boolean);
  const uniqueOfficerIds = [...new Set(officerIds)];
  const officers = uniqueOfficerIds.length
    ? await User.find({ _id: { $in: uniqueOfficerIds } }).lean()
    : [];
  const officerMap = new Map(officers.map((user) => [user._id.toString(), user]));

  const grouped = new Map();
  const isHearingOnly = isHearingOnlyUser(user?.roles);
  const currentOfficerId = user?._id?.toString() || null;

  applications.forEach((app) => {
    const officerId = app.assigned_hearing_officer_id || app.hearing_officer_id || null;
    if (!officerId) return;
    if (isHearingOnly && officerId !== currentOfficerId) return;
    const key = officerId;
    if (!grouped.has(key)) {
      const officer = officerMap.get(String(officerId));
      grouped.set(key, {
        hearing_officer_id: officerId,
        hearing_officer_name: officer?.full_name || officer?.email || "Unknown",
        totals: { total: 0, pending: 0, approved: 0, rejected: 0 },
        applications: [],
      });
    }
    const designation = app.description?.designation || null;
    const applicantBaseName = app.applicant_name || null;
    const applicantDisplayName =
      applicantBaseName && designation
        ? `${applicantBaseName} - ${designation}`
        : applicantBaseName;
    grouped.get(key).applications.push({
      application_id: app.tracking_id,
      applicant_display_name: applicantDisplayName,
      unit_name: app.company_name || app.description?.unit_name || null,
      category: app.description?.industry_category || app.application_type || null,
      unit_id: app.description?.unit_id || null,
      district: app.description?.district || null,
      contact: app.applicant_phone || app.description?.contact_number || null,
      submission_date: app.created_at?.toISOString() || null,
    });
    grouped.get(key).totals.total += 1;
    if (STATUS_GROUPS.pending.includes(app.status)) grouped.get(key).totals.pending += 1;
    if (STATUS_GROUPS.approved.includes(app.status)) grouped.get(key).totals.approved += 1;
    if (STATUS_GROUPS.rejected.includes(app.status)) grouped.get(key).totals.rejected += 1;
  });

  return Array.from(grouped.values()).sort((a, b) =>
    String(a.hearing_officer_name).localeCompare(String(b.hearing_officer_name))
  );
};

router.get("/registrar-disposal", async (req, res) => {
  const { from, to, status_group, district_id } = req.query;
  if (!from || !to) {
    return res.status(400).json({ message: "from and to are required." });
  }

  const fromDate = new Date(String(from));
  const toDate = new Date(String(to));

  let statusFilter = ["approved_resolved", "rejected_closed"];
  if (status_group === "approved") {
    statusFilter = ["approved_resolved"];
  }
  if (status_group === "rejected") {
    statusFilter = ["rejected_closed"];
  }

  const appQuery = {
    status: { $in: statusFilter },
    closed_at: { $gte: fromDate, $lte: toDate },
  };

  if (district_id) {
    appQuery["description.district"] = String(district_id);
  }

  const applications = await Application.find(appQuery).lean().sort({ closed_at: -1 });

  const officerIds = applications.map((app) => app.hearing_officer_id).filter(Boolean);
  const uniqueOfficerIds = [...new Set(officerIds)];
  const officers = uniqueOfficerIds.length
    ? await User.find({ _id: { $in: uniqueOfficerIds } }).lean()
    : [];
  const officerMap = new Map(officers.map((user) => [user._id.toString(), user]));

  const rows = applications.map((app) => {
    const officer = app.hearing_officer_id ? officerMap.get(app.hearing_officer_id) : null;
    return {
      closed_at: app.closed_at?.toISOString() || null,
      application_id: app._id.toString(),
      application_number: app.tracking_id,
      unit_name: app.company_name || null,
      district: app.description?.district || null,
      final_status: app.status,
      hearing_officer_id: app.hearing_officer_id || null,
      hearing_officer_name: officer?.full_name || null,
    };
  });

  return res.json(rows);
});

const buildSummary = async ({ from, to, violationType, subViolation, user }) => {
  const fromDate = new Date(String(from));
  const toDate = new Date(String(to));

  const baseQuery = {
    created_at: { $gte: fromDate, $lte: toDate },
  };
  if (violationType) {
    baseQuery["description.violation_type"] = String(violationType);
  }
  if (subViolation) {
    baseQuery["description.sub_violation"] = String(subViolation);
  }
  if (isHearingOnlyUser(user?.roles)) {
    const officerId = user?._id?.toString() || "__none__";
    baseQuery.$or = [
      { assigned_hearing_officer_id: officerId },
      { hearing_officer_id: officerId },
    ];
  }

  const applications = await Application.find(baseQuery).select("status description").lean();

  const totals = {
    total: applications.length,
    pending: applications.filter((app) => STATUS_GROUPS.pending.includes(app.status)).length,
    approved: applications.filter((app) => STATUS_GROUPS.approved.includes(app.status)).length,
    rejected: applications.filter((app) => STATUS_GROUPS.rejected.includes(app.status)).length,
  };

  const byDistrict = {};
  const byViolation = {};
  const bySubViolation = {};

  applications.forEach((app) => {
    const district = app.description?.district || "Unknown";
    const status = app.status;
    const violation = app.description?.violation_type || "Unknown";
    const subViolationValue = app.description?.sub_violation || "Unknown";

    if (!byDistrict[district]) {
      byDistrict[district] = { total: 0, pending: 0, approved: 0, rejected: 0 };
    }
    if (!byViolation[violation]) {
      byViolation[violation] = { total: 0, pending: 0, approved: 0, rejected: 0 };
    }
    if (!bySubViolation[subViolationValue]) {
      bySubViolation[subViolationValue] = { total: 0, pending: 0, approved: 0, rejected: 0 };
    }

    byDistrict[district].total += 1;
    byViolation[violation].total += 1;
    bySubViolation[subViolationValue].total += 1;

    if (STATUS_GROUPS.pending.includes(status)) {
      byDistrict[district].pending += 1;
      byViolation[violation].pending += 1;
      bySubViolation[subViolationValue].pending += 1;
    }
    if (STATUS_GROUPS.approved.includes(status)) {
      byDistrict[district].approved += 1;
      byViolation[violation].approved += 1;
      bySubViolation[subViolationValue].approved += 1;
    }
    if (STATUS_GROUPS.rejected.includes(status)) {
      byDistrict[district].rejected += 1;
      byViolation[violation].rejected += 1;
      bySubViolation[subViolationValue].rejected += 1;
    }
  });

  return {
    totals,
    byDistrict,
    byViolation,
    bySubViolation,
  };
};

router.get("/summary", async (req, res) => {
  const { from, to, violation_type, sub_violation } = req.query;
  if (!from || !to) {
    return res.status(400).json({ message: "from and to are required." });
  }

  const summary = await buildSummary({
    from,
    to,
    violationType: violation_type,
    subViolation: sub_violation,
    user: req.user,
  });

  return res.json(summary);
});

router.get("/summary/pdf", async (req, res) => {
  const { from, to, violation_type, sub_violation } = req.query;
  if (!from || !to) {
    return res.status(400).json({ message: "from and to are required." });
  }

  const summary = await buildSummary({
    from,
    to,
    violationType: violation_type,
    subViolation: sub_violation,
    user: req.user,
  });

  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"reports-summary.pdf\"");
  doc.pipe(res);

  doc.fontSize(18).text("Reports Summary", { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`From: ${from}  To: ${to}`);
  if (violation_type) {
    doc.text(`Violation Type: ${violation_type}`);
  }
  if (sub_violation) {
    doc.text(`Sub-Violation: ${sub_violation}`);
  }
  doc.moveDown();

  const addSection = (title, entries, keyLabel) => {
    doc.fontSize(12).text(title, { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10).text(`${keyLabel} | Total | Pending | Approved | Rejected`);
    doc.moveDown(0.2);
    entries.forEach(([label, counts]) => {
      doc.text(
        `${label} | ${counts.total} | ${counts.pending} | ${counts.approved} | ${counts.rejected}`
      );
    });
    doc.moveDown();
  };

  doc.fontSize(12).text("Totals", { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(10).text(`Total: ${summary.totals.total}`);
  doc.text(`Pending: ${summary.totals.pending}`);
  doc.text(`Approved: ${summary.totals.approved}`);
  doc.text(`Rejected: ${summary.totals.rejected}`);
  doc.moveDown();

  addSection("District Wise", Object.entries(summary.byDistrict), "District");
  addSection("Violation Wise", Object.entries(summary.byViolation), "Violation");
  addSection("Sub-Violation Wise", Object.entries(summary.bySubViolation), "Sub-Violation");

  doc.end();
});

router.get("/hearing-officer-wise", async (req, res) => {
  const { from, to, violation_type, sub_violation } = req.query;
  if (!from || !to) {
    return res.status(400).json({ message: "from and to are required." });
  }

  const sections = await buildHearingOfficerReport({
    from,
    to,
    violationType: violation_type,
    subViolation: sub_violation,
    user: req.user,
  });
  return res.json(sections);
});

router.get("/hearing-officer-wise/pdf", async (req, res) => {
  const { from, to, officer_id, violation_type, sub_violation } = req.query;
  if (!from || !to || !officer_id) {
    return res.status(400).json({ message: "from, to, and officer_id are required." });
  }
  if (String(officer_id) === "unassigned") {
    return res.status(400).json({ message: "unassigned is not allowed." });
  }

  const isHearingOnly = isHearingOnlyUser(req.user?.roles);
  const currentOfficerId = req.user?._id?.toString() || null;
  if (isHearingOnly && String(officer_id) !== currentOfficerId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const sections = await buildHearingOfficerReport({
    from,
    to,
    violationType: violation_type,
    subViolation: sub_violation,
    user: req.user,
  });
  const section = sections.find((item) => item.hearing_officer_id === String(officer_id));

  const officerName = section?.hearing_officer_name || "Unknown";
  const rows = section?.applications || [];

  const doc = new PDFDocument({ margin: 30, layout: "landscape", size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"hearing-officer-report.pdf\"");
  doc.pipe(res);

  const titleFrom = formatDateLabel(from);
  const titleTo = formatDateLabel(to);

  const columns = [
    { label: "Application ID", key: "application_id", width: 12 },
    { label: "Applicant Name", key: "applicant_display_name", width: 20 },
    { label: "Unit Name", key: "unit_name", width: 16 },
    { label: "Category", key: "category", width: 14 },
    { label: "Unit ID", key: "unit_id", width: 8 },
    { label: "District", key: "district", width: 10 },
    { label: "Contact", key: "contact", width: 10 },
    { label: "Submission Date", key: "submission_date", width: 10 },
  ];

  const marginLeft = doc.page.margins.left;
  const marginRight = doc.page.margins.right;
  const availableWidth = doc.page.width - marginLeft - marginRight;
  const totalUnits = columns.reduce((sum, col) => sum + col.width, 0);
  const columnWidths = columns.map((col) =>
    Math.floor((availableWidth * col.width) / totalUnits)
  );
  columnWidths[columnWidths.length - 1] +=
    availableWidth - columnWidths.reduce((sum, width) => sum + width, 0);

  const headerHeight = 22;
  const rowHeight = 20;
  const cellPaddingX = 4;
  const cellPaddingY = 6;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;

  const drawTableHeader = (y) => {
    doc.font("Helvetica-Bold").fontSize(9);
    let x = marginLeft;
    columns.forEach((col, idx) => {
      doc.rect(x, y, columnWidths[idx], headerHeight).stroke();
      doc.text(col.label, x + cellPaddingX, y + cellPaddingY, {
        width: columnWidths[idx] - cellPaddingX * 2,
        lineBreak: false,
        ellipsis: true,
      });
      x += columnWidths[idx];
    });
    return y + headerHeight;
  };

  const drawRow = (row, y) => {
    doc.font("Helvetica").fontSize(8);
    let x = marginLeft;
    columns.forEach((col, idx) => {
      let value = row[col.key] ?? "";
      if (col.key === "submission_date") {
        value = formatRowDate(value);
      }
      doc.rect(x, y, columnWidths[idx], rowHeight).stroke();
      doc.text(String(value || ""), x + cellPaddingX, y + cellPaddingY, {
        width: columnWidths[idx] - cellPaddingX * 2,
        lineBreak: false,
        ellipsis: true,
      });
      x += columnWidths[idx];
    });
    return y + rowHeight;
  };

  const drawPage = () => {
    doc.font("Helvetica-Bold").fontSize(14).text("HEARING OFFICER REPORT", {
      align: "center",
    });
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).text(`Officer: ${officerName}`, { align: "center" });
    doc.text(`From ${titleFrom} To ${titleTo}`, { align: "center" });
    const startY = doc.y + 8;
    return drawTableHeader(startY);
  };

  let currentY = drawPage();
  rows.forEach((row) => {
    if (currentY + rowHeight > bottomLimit) {
      doc.addPage({ margin: 30, layout: "landscape", size: "A4" });
      currentY = drawPage();
    }
    currentY = drawRow(row, currentY);
  });

  doc.end();
});

export default router;
