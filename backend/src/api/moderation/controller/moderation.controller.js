import { StatusCodes } from "http-status-codes";

import {
  getModerationReportService,
  listModerationReportsService,
  reviewModerationReportService,
} from "../service/moderation.service.js";

export const listModerationController = async (req, res, next) => {
  try {
    const data = await listModerationReportsService({
      status: req.query.status,
      category: req.query.category,
      contentType: req.query.contentType,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getModerationController = async (req, res, next) => {
  try {
    const data = await getModerationReportService(req.params.id);

    res.status(StatusCodes.OK).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const reviewModerationController = async (req, res, next) => {
  try {
    const data = await reviewModerationReportService({
      id: req.params.id,
      reviewerId: req.user.id,
      status: req.body.status,
      action: req.body.action,
      reviewNote: req.body.reviewNote,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
