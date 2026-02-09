import { Router } from "express";
import PDFDocument from "pdfkit";
import HearingDate from "../models/HearingDate.js";
import Application from "../models/Application.js";
import User from "../models/User.js";
import { authRequired } from "../middleware/auth.js";
import { mapHearing } from "../utils/mappers.js";

const router = Router();

const isHearingOnlyUser = (roles = []) =>
  roles.includes("hearing_officer") &&
  !roles.includes("admin") &&
  !roles.includes("super_admin") &&
  !roles.includes("registrar");

router.get("/", authRequired, async (req, res) => {
  const userRoles = req.user?.roles || [];
  const isHearingOnly = isHearingOnlyUser(userRoles);
  const appQuery = {};
  if (isHearingOnly) {
    if (req.user?.district) {
      appQuery["description.district"] = req.user.district;
    } else {
      appQuery["description.district"] = "__none__";
    }
  }

  const applications = await Application.find(appQuery);
  const applicationIds = applications.map((app) => app._id);
  const hearings = await HearingDate.find({ application_id: { $in: applicationIds } }).sort({ hearing_date: 1 });
  const appMap = new Map(applications.map((app) => [app._id.toString(), app]));

  const response = hearings.map((hearing) => mapHearing(hearing, appMap.get(hearing.application_id.toString()) || null));
  return res.json(response);
});

router.get("/report", authRequired, async (req, res) => {
  const { from, to, officer_id } = req.query;
  if (!from || !to) {
    return res.status(400).json({ message: "from and to are required." });
  }
  const rows = await buildHearingReportRows({ from, to, officer_id, user: req.user });
  return res.json(rows);
});

const formatDateLabel = (value) => {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return String(value);
  return `${day}-${month}-${year}`;
};

const buildHearingReportRows = async ({ from, to, officer_id, user }) => {
  const fromDate = new Date(`${String(from)}T00:00:00`);
  const toDate = new Date(`${String(to)}T23:59:59.999`);

  const hearingQuery = {
    hearing_date: { $gte: fromDate, $lte: toDate },
    is_active: true,
  };

  const userRoles = user?.roles || [];
  const isHearingOnly = isHearingOnlyUser(userRoles);
  const appQuery = { _id: { $in: [] } };

  const hearings = await HearingDate.find(hearingQuery).sort({ hearing_date: 1 });
  const applicationIds = hearings.map((hearing) => hearing.application_id);
  appQuery._id = { $in: applicationIds };
  if (isHearingOnly) {
    if (user?.district) {
      appQuery["description.district"] = user.district;
    } else {
      appQuery["description.district"] = "__none__";
    }
  }
  const applications = await Application.find(appQuery);
  const appMap = new Map(applications.map((app) => [app._id.toString(), app]));

  const allHearings = applicationIds.length
    ? await HearingDate.find({ application_id: { $in: applicationIds } }).sort({ hearing_date: 1 })
    : [];
  const firstHearingByApp = new Map();
  allHearings.forEach((hearing) => {
    const appId = hearing.application_id?.toString();
    if (!appId) return;
    if (!firstHearingByApp.has(appId)) {
      firstHearingByApp.set(appId, hearing.hearing_date || null);
    }
  });

  const officerIds = applications
    .map((app) => app.hearing_officer_id)
    .filter(Boolean);
  const uniqueOfficerIds = [...new Set(officerIds)];
  const officers = uniqueOfficerIds.length
    ? await User.find({ _id: { $in: uniqueOfficerIds } })
    : [];
  const officerMap = new Map(officers.map((user) => [user._id.toString(), user]));

  const allowedApplicationIds = new Set(applications.map((app) => app._id.toString()));
  const rows = hearings
    .filter((hearing) => allowedApplicationIds.has(hearing.application_id.toString()))
    .map((hearing) => {
      const app = appMap.get(hearing.application_id.toString());
      if (!app) return null;
      const district = app.description?.district || null;
      const unitId = app.description?.unit_id || null;
      const unitName = app.company_name || app.description?.unit_name || null;
      const category = app.description?.industry_category || app.application_type || null;
      const contact = app.applicant_phone || app.description?.contact_number || null;
      const firstHearingDate = firstHearingByApp.get(app._id.toString()) || null;
      const submissionDate = app.created_at || null;
      const designation = app.description?.designation || null;
      const applicantBaseName = app.applicant_name || null;
      const applicantDisplayName =
        applicantBaseName && designation
          ? `${applicantBaseName} - ${designation}`
          : applicantBaseName;
      const officerId = app.hearing_officer_id || null;
      const officer = officerId ? officerMap.get(officerId) : null;
      return {
        hearing_id: hearing._id.toString(),
        application_id: app._id.toString(),
        application_number: app.tracking_id,
        applicant_name: applicantBaseName,
        applicant_display_name: applicantDisplayName,
        unit_name: unitName,
        category,
        unit_id: unitId,
        district,
        contact,
        first_hearing_date: firstHearingDate ? new Date(firstHearingDate).toISOString() : null,
        submission_date: submissionDate ? new Date(submissionDate).toISOString() : null,
        status: app.status,
        hearing_officer_id: officerId,
        hearing_officer_name: officer?.full_name || null,
      };
    })
    .filter(Boolean);

  const filteredRows = officer_id
    ? rows.filter((row) => row.hearing_officer_id === officer_id)
    : rows;

  return filteredRows;
};

router.get("/report/pdf", authRequired, async (req, res) => {
  const { from, to, officer_id } = req.query;
  if (!from || !to) {
    return res.status(400).json({ message: "from and to are required." });
  }

  const rows = await buildHearingReportRows({ from, to, officer_id, user: req.user });
  const titleDate = formatDateLabel(from);

  const doc = new PDFDocument({ margin: 30, layout: "landscape", size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"cause-list.pdf\"");
  doc.pipe(res);

  const columns = [
    { label: "Application ID", key: "application_number", width: 12 },
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

  const formatRowDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

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
    doc.font("Helvetica-Bold").fontSize(16).text(`CAUSE LIST DATED ${titleDate}`, {
      align: "center",
    });
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
