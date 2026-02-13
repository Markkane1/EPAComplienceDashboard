import { mapApplicationResponse } from "../../dtos/mapApplicationResponse.js";
import { CLOSED_STATUSES, HEARING_DIVISION_STATUSES, isApplicantOnlyUser, isHearingOnlyUser } from "./utils.js";

export class ListApplicationsUseCase {
  constructor({ applicationRepository }) {
    this.applicationRepository = applicationRepository;
  }

  async execute({ query, user }) {
    const { status, status_in: statusIn, search, limit, page } = query || {};

    const queryFilter = {};
    const userRoles = user?.roles || [];
    const isHearingOnly = isHearingOnlyUser(userRoles);
    const isApplicantOnly = isApplicantOnlyUser(userRoles);

    let requestedStatuses = null;
    if (statusIn) {
      const statuses = String(statusIn)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (statuses.length) {
        requestedStatuses = statuses;
      }
    } else if (status && status !== "all") {
      if (status === "closed") {
        requestedStatuses = CLOSED_STATUSES;
      } else {
        requestedStatuses = [String(status)];
      }
    }

    if (isApplicantOnly) {
      const applicantId = user?._id?.toString?.() || user?.id || null;
      const applicantEmail = user?.email;
      const applicantCnic = user?.cnic;
      const cnicValue = applicantCnic ? String(applicantCnic).trim() : null;
      queryFilter.$or = [
        { applicant_user_id: applicantId || "__none__" },
        ...(applicantEmail ? [{ applicant_email: String(applicantEmail).toLowerCase().trim() }] : []),
        ...(cnicValue ? [{ applicant_cnic: cnicValue }] : []),
        ...(cnicValue ? [{ "description.cnic": cnicValue }] : []),
      ];
      if (requestedStatuses) {
        queryFilter.status = { $in: requestedStatuses };
      }
    } else if (isHearingOnly) {
      const allowedOpen = HEARING_DIVISION_STATUSES;
      const allowedClosed = CLOSED_STATUSES;
      const hearingUserId = user?._id?.toString?.() || user?.id || "__none__";
      const filtered = requestedStatuses
        ? requestedStatuses.filter((value) => [...allowedOpen, ...allowedClosed].includes(value))
        : allowedOpen;
      const wantsClosed = filtered.some((value) => allowedClosed.includes(value));
      const wantsOpen = filtered.some((value) => allowedOpen.includes(value));

      if (wantsOpen && wantsClosed) {
        queryFilter.$or = [
          { status: { $in: filtered.filter((value) => allowedOpen.includes(value)) } },
          {
            status: { $in: filtered.filter((value) => allowedClosed.includes(value)) },
            hearing_officer_id: hearingUserId,
          },
        ];
      } else if (wantsClosed) {
        queryFilter.status = { $in: filtered.filter((value) => allowedClosed.includes(value)) };
        queryFilter.hearing_officer_id = hearingUserId;
      } else {
        queryFilter.status = { $in: filtered };
      }

      if (user?.district) {
        queryFilter["description.district"] = user.district;
      } else {
        queryFilter["description.district"] = "__none__";
      }
    } else if (requestedStatuses) {
      queryFilter.status = { $in: requestedStatuses };
    }

    if (search) {
      const term = String(search).trim();
      if (term) {
        // Optimize search: tracking_id uses prefix match, others use regex
        const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        queryFilter.$or = [
          { tracking_id: { $regex: "^" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
          { applicant_name: regex },
          { applicant_email: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
        ];
      }
    }

    const pageSize = limit ? Number(limit) : null;
    const pageNumber = page ? Math.max(1, Number(page)) : null;

    if (pageSize && pageNumber) {
      // Execute count and find queries in parallel for better performance
      const [total, results] = await Promise.all([
        this.applicationRepository.count(queryFilter),
        this.applicationRepository.find(queryFilter, {
          sort: { created_at: -1 },
          skip: (pageNumber - 1) * pageSize,
          limit: pageSize,
        }),
      ]);
      return {
        status: 200,
        body: {
          items: results.map(mapApplicationResponse),
          total,
          page: pageNumber,
          limit: pageSize,
        },
      };
    }

    const results = await this.applicationRepository.find(queryFilter, {
      sort: { created_at: -1 },
      limit: pageSize || 0,
    });
    return { status: 200, body: results.map(mapApplicationResponse) };
  }
}
