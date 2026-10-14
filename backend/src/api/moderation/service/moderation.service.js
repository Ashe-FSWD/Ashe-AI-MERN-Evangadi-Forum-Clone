import { BadRequestError, NotFoundError } from "../../../utils/errors/index.js";

import {
  embedText,
  recommendAnswerGrade,
} from "../../../services/gemini.service.js";
// ✅ CORRECT (4 levels goes up to backend/db/config.js)
import { safeExecute } from "../../../../db/config.js";

import { moderateContent } from "../../../ai/moderation.service.js";

import {
  createModerationReportModel,
  getModerationReportModel,
  listModerationReportsModel,
  updateModerationReportModel,
  setModeratedContentVisibilityModel,
  getUserViolationCountModel,
  banUserModel,
} from "../model/moderation.model.js";

const BAN_THRESHOLD = 3;

const categoryFromResult = (result) => {
  if (result.hate) return "hate";
  if (result.threat) return "threat";
  if (result.harassment) return "harassment";
  if (result.political) return "political";

  return "other";
};

/**
 * Generates the vector only after content is approved/published.
 */
const generateQuestionVector = async (questionId) => {
  const rows = await safeExecute(
    `SELECT title, content
     FROM questions
     WHERE question_id = ?
     LIMIT 1`,
    [Number(questionId)],
  );

  if (rows.length === 0) return;

  const sourceText = `${rows[0].title}\n\n${rows[0].content}`;

  try {
    const vector = await embedText(sourceText, "RETRIEVAL_DOCUMENT");

    await safeExecute(
      `INSERT INTO question_vectors
        (
          question_id,
          source_text,
          embedding,
          status
        )
       VALUES (?, ?, ?, 'ready')
       ON DUPLICATE KEY UPDATE
         source_text = VALUES(source_text),
         embedding = VALUES(embedding),
         status = 'ready'`,
      [Number(questionId), sourceText, JSON.stringify(vector)],
    );
  } catch (error) {
    console.warn(`[moderation] question vector failed: ${error.message}`);
  }
};

/**
 * Generates answer vector and notification after approval.
 */
const generateAnswerVectorAndNotification = async (answerId) => {
  const rows = await safeExecute(
    `SELECT
       a.content,
       q.content AS questionContent,
       q.question_hash,
       q.question_id,
       q.title,
       q.user_id AS questionOwnerId,
       u.first_name,
       u.last_name
     FROM answers a
     JOIN questions q
       ON q.question_id = a.question_id
     JOIN users u
       ON u.user_id = a.user_id
     WHERE a.answer_id = ?
     LIMIT 1`,
    [Number(answerId)],
  );

  if (rows.length === 0) return;

  const row = rows[0];

  try {
    const vector = await embedText(row.content, "RETRIEVAL_DOCUMENT");

    await safeExecute(
      `INSERT INTO answer_vectors
        (
          answer_id,
          source_text,
          embedding,
          status
        )
       VALUES (?, ?, ?, 'ready')
       ON DUPLICATE KEY UPDATE
         source_text = VALUES(source_text),
         embedding = VALUES(embedding),
         status = 'ready'`,
      [Number(answerId), row.content, JSON.stringify(vector)],
    );

    recommendAnswerGrade(row.questionContent, row.content)
      .then((grade) =>
        safeExecute(
          `UPDATE answer_vectors
           SET ai_grade = ?
           WHERE answer_id = ?`,
          [grade, Number(answerId)],
        ),
      )
      .catch((error) => {
        console.warn(`[moderation] answer grade failed: ${error.message}`);
      });
  } catch (error) {
    console.warn(`[moderation] answer vector failed: ${error.message}`);
  }

  // Notification is sent only after the answer becomes public.
  try {
    const authorName = [row.first_name, row.last_name]
      .filter(Boolean)
      .join(" ");

    const message =
      `${authorName || "Someone"} answered your question: ` +
      `${String(row.title || "your question").slice(0, 60)}`;

    await safeExecute(
      `INSERT INTO notifications
        (
          user_id,
          type,
          message,
          question_id,
          question_hash
        )
       VALUES (?, 'answer_added', ?, ?, ?)`,
      [
        row.questionOwnerId,
        message.slice(0, 500),
        row.question_id,
        row.question_hash,
      ],
    );
  } catch (error) {
    console.warn(`[moderation] notification failed: ${error.message}`);
  }
};

/**
 * Runs AI moderation.
 */
export const analyzeAndStoreModerationService = async ({
  contentType,
  contentId,
  content,
  userId,
}) => {
  if (!["question", "answer"].includes(contentType)) {
    throw new BadRequestError("contentType must be question or answer");
  }

  if (!contentId) {
    throw new BadRequestError("contentId is required");
  }

  if (!content?.trim()) {
    throw new BadRequestError("content is required");
  }

  if (!userId) {
    throw new BadRequestError("userId is required for moderation");
  }

  const result = await moderateContent({
    contentType,
    content,
  });

  if (!result.needsReview) {
    await setModeratedContentVisibilityModel({
      contentType,
      contentId,
      visible: true,
    });

    return {
      flagged: false,
      published: true,
      result,
    };
  }

  const category = categoryFromResult(result);

  const report = await createModerationReportModel({
    contentType,
    contentId,
    userId,
    category,
    severity: result.severity,
    reason: result.reason,
    aiResult: result,
  });

  return {
    flagged: true,
    published: false,
    reportId: report.id,
    userId: report.userId,
    result,
  };
};

/**
 * Lists reports and ensures user details (author information) are loaded.
 */
export const listModerationReportsService = async (filters = {}) => {
  const reports = await listModerationReportsModel(filters);

  // Helper to fetch user details if listModerationReportsModel does not perform a SQL JOIN
  const enrichedReports = await Promise.all(
    reports.map(async (report) => {
      if (report.authorFirstName || report.firstName || !report.userId) {
        return report;
      }

      try {
        const userRows = await safeExecute(
          `SELECT 
             user_id, 
             first_name AS firstName, 
             last_name AS lastName, 
             email, 
             violation_count AS violationCount, 
             is_banned AS isBanned 
           FROM users 
           WHERE user_id = ? 
           LIMIT 1`,
          [report.userId],
        );

        if (userRows.length > 0) {
          return {
            ...report,
            authorFirstName: userRows[0].firstName,
            authorLastName: userRows[0].lastName,
            authorEmail: userRows[0].email,
            authorViolationCount: userRows[0].violationCount,
            authorIsBanned: userRows[0].isBanned,
          };
        }
      } catch (err) {
        console.warn(
          `[moderation] Failed to load author details: ${err.message}`,
        );
      }

      return report;
    }),
  );

  return enrichedReports;
};

/**
 * Gets one report.
 */
export const getModerationReportService = async (id) => {
  const report = await getModerationReportModel(id);

  if (!report) {
    throw new NotFoundError("Moderation report not found");
  }

  return report;
};

/**
 * Reviews a pending moderation report.
 */
export const reviewModerationReportService = async ({
  id,
  reviewerId,
  status,
  action,
  reviewNote,
}) => {
  const allowedStatuses = ["reviewed", "dismissed", "action_taken"];
  const allowedActions = ["none", "hide", "remove"];

  if (!allowedStatuses.includes(status)) {
    throw new BadRequestError("Invalid moderation status");
  }

  if (!allowedActions.includes(action)) {
    throw new BadRequestError("Invalid moderation action");
  }

  const existing = await getModerationReportModel(id);

  if (!existing) {
    throw new NotFoundError("Moderation report not found");
  }

  if (existing.status !== "pending") {
    throw new BadRequestError(
      "This moderation report has already been reviewed.",
    );
  }

  const publish =
    action === "none" && (status === "reviewed" || status === "dismissed");

  const contentAction = action === "hide" || action === "remove";

  if (contentAction && status !== "action_taken") {
    throw new BadRequestError(
      "Hide/remove actions must use action_taken status.",
    );
  }

  if (status === "action_taken" && action === "none") {
    throw new BadRequestError("action_taken requires hide or remove.");
  }

  if (publish) {
    await setModeratedContentVisibilityModel({
      contentType: existing.contentType,
      contentId: existing.contentId,
      visible: true,
    });
  }

  if (contentAction) {
    await setModeratedContentVisibilityModel({
      contentType: existing.contentType,
      contentId: existing.contentId,
      visible: false,
      userId: reviewerId,
    });
  }

  const reviewedReport = await updateModerationReportModel({
    id,
    reviewerId,
    status,
    action,
    reviewNote,
  });

  if (publish) {
    if (existing.contentType === "question") {
      await generateQuestionVector(existing.contentId);
    }

    if (existing.contentType === "answer") {
      await generateAnswerVectorAndNotification(existing.contentId);
    }
  }

  let violationCount = 0;
  let banned = false;

  if (
    status === "action_taken" &&
    ["hate", "threat", "harassment"].includes(existing.category) &&
    existing.userId
  ) {
    violationCount = await getUserViolationCountModel(existing.userId);

    if (violationCount >= BAN_THRESHOLD) {
      const banResult = await banUserModel({
        userId: existing.userId,
        bannedBy: reviewerId,
        reason: "User reached 3 confirmed moderation violations.",
      });

      banned = banResult.banned;
    }
  }

  return {
    report: reviewedReport,
    violationCount,
    banThreshold: BAN_THRESHOLD,
    banned,
  };
};
