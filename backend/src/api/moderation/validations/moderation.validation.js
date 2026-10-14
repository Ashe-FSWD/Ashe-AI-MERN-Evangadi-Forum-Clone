import { BadRequestError } from "../../../utils/errors/index.js";

export const reviewModerationValidation = (req, res, next) => {
  const { status, action } = req.body;

  if (!["reviewed", "dismissed", "action_taken"].includes(status)) {
    throw new BadRequestError("Invalid moderation status");
  }

  if (!["none", "hide", "remove"].includes(action)) {
    throw new BadRequestError("Invalid moderation action");
  }

  if (
    req.body.reviewNote !== undefined &&
    req.body.reviewNote !== null &&
    typeof req.body.reviewNote !== "string"
  ) {
    throw new BadRequestError("reviewNote must be a string");
  }

  next();
};
