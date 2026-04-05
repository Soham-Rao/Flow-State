import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { buildSecurityRequestContext } from "../../utils/request-context.js";
import {
  createBugReportSchema,
  listBugReportsQuerySchema,
  updateBugReportStatusSchema
} from "./bug-reports.schema.js";
import {
  createBugReport,
  getBugReportSummary,
  listAdminBugReports,
  listMyBugReports,
  updateBugReportStatus
} from "./bug-reports.service.js";

export const bugReportsRouter = Router();

bugReportsRouter.use(requireAuth);

bugReportsRouter.post("/", async (req, res, next) => {
  try {
    const body = createBugReportSchema.parse(req.body ?? {});
    const context = buildSecurityRequestContext(req);
    const data = await createBugReport(req.auth!.userId, body, context);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

bugReportsRouter.get("/mine", async (req, res, next) => {
  try {
    const data = await listMyBugReports(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

bugReportsRouter.get("/summary", async (req, res, next) => {
  try {
    const data = await getBugReportSummary(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

bugReportsRouter.get("/", async (req, res, next) => {
  try {
    const query = listBugReportsQuerySchema.parse(req.query ?? {});
    const data = await listAdminBugReports(req.auth!.userId, query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

bugReportsRouter.patch("/:reportId", async (req, res, next) => {
  try {
    const body = updateBugReportStatusSchema.parse(req.body ?? {});
    const context = buildSecurityRequestContext(req);
    const data = await updateBugReportStatus(req.auth!.userId, req.params.reportId, body.status, context);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
