import { safeExecute } from "../../../../db/config.js";

/**
 * Creates a moderation report.
 *
 * IMPORTANT:
 * userId comes directly from the authenticated creator.
 * We do not try to guess the author from contentId.
 */
export const createModerationReportModel = async ({
  contentType,
  contentId,
  userId,
  category,
  severity,
  reason,
  aiResult,
}) => {
  const numericUserId = Number(userId);
  const numericContentId = Number(contentId);

  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    throw new Error(
      "A valid userId is required when creating a moderation report.",
    );
  }

  if (!Number.isInteger(numericContentId) || numericContentId <= 0) {
    throw new Error(
      "A valid contentId is required when creating a moderation report.",
    );
  }

  const result = await safeExecute(
    `INSERT INTO moderation_reports
      (
        content_type,
        content_id,
        user_id,
        category,
        severity,
        status,
        action,
        reason,
        ai_result
      )
     VALUES (?, ?, ?, ?, ?, 'pending', 'none', ?, ?)`,
    [
      contentType,
      numericContentId,
      numericUserId,
      category,
      severity,
      reason,
      JSON.stringify(aiResult),
    ],
  );

  return {
    id: result.insertId,
    userId: numericUserId,
  };
};

/**
 * Lists moderation reports for Super Admin.
 */
export const listModerationReportsModel = async ({
  status,
  category,
  contentType,
}) => {
  const where = [];
  const params = [];

  if (status) {
    where.push("mr.status = ?");
    params.push(status);
  }

  if (category) {
    where.push("mr.category = ?");
    params.push(category);
  }

  if (contentType) {
    where.push("mr.content_type = ?");
    params.push(contentType);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await safeExecute(
    `SELECT
       mr.id,
       mr.content_type AS contentType,
       mr.content_id AS contentId,
       mr.user_id AS userId,
       mr.category,
       mr.severity,
       mr.status,
       mr.reason,
       mr.ai_result AS aiResult,
       mr.reviewed_by AS reviewedBy,
       mr.reviewed_at AS reviewedAt,
       mr.review_note AS reviewNote,
       mr.action,
       mr.created_at AS createdAt,
       mr.updated_at AS updatedAt,

       u.first_name AS firstName,
       u.last_name AS lastName,
       u.email,
       u.is_banned AS isBanned,

       (
         SELECT COUNT(*)
         FROM moderation_reports vr
         WHERE vr.user_id = mr.user_id
           AND vr.category IN (
             'hate',
             'threat',
             'harassment'
           )
           AND vr.status = 'action_taken'
           AND vr.action IN ('hide', 'remove')
       ) AS violationCount,

       CASE
         WHEN mr.content_type = 'question'
         THEN q.title
         ELSE NULL
       END AS questionTitle,

       CASE
         WHEN mr.content_type = 'question'
         THEN q.content
         WHEN mr.content_type = 'answer'
         THEN a.content
         ELSE NULL
       END AS content

     FROM moderation_reports mr

     LEFT JOIN users u
       ON mr.user_id = u.user_id

     LEFT JOIN questions q
       ON mr.content_type = 'question'
      AND mr.content_id = q.question_id

     LEFT JOIN answers a
       ON mr.content_type = 'answer'
      AND mr.content_id = a.answer_id

     ${whereSql}

     ORDER BY mr.created_at DESC`,
    params,
  );

  return rows;
};

/**
 * Gets one moderation report.
 */
export const getModerationReportModel = async (id) => {
  const rows = await safeExecute(
    `SELECT
       mr.id,
       mr.content_type AS contentType,
       mr.content_id AS contentId,
       mr.user_id AS userId,
       mr.category,
       mr.severity,
       mr.status,
       mr.reason,
       mr.ai_result AS aiResult,
       mr.reviewed_by AS reviewedBy,
       mr.reviewed_at AS reviewedAt,
       mr.review_note AS reviewNote,
       mr.action,
       mr.created_at AS createdAt,
       mr.updated_at AS updatedAt,

       u.first_name AS firstName,
       u.last_name AS lastName,
       u.email,
       u.is_banned AS isBanned,

       (
         SELECT COUNT(*)
         FROM moderation_reports vr
         WHERE vr.user_id = mr.user_id
           AND vr.category IN (
             'hate',
             'threat',
             'harassment'
           )
           AND vr.status = 'action_taken'
           AND vr.action IN ('hide', 'remove')
       ) AS violationCount,

       CASE
         WHEN mr.content_type = 'question'
         THEN q.title
         ELSE NULL
       END AS questionTitle,

       CASE
         WHEN mr.content_type = 'question'
         THEN q.content
         WHEN mr.content_type = 'answer'
         THEN a.content
         ELSE NULL
       END AS content

     FROM moderation_reports mr

     LEFT JOIN users u
       ON mr.user_id = u.user_id

     LEFT JOIN questions q
       ON mr.content_type = 'question'
      AND mr.content_id = q.question_id

     LEFT JOIN answers a
       ON mr.content_type = 'answer'
      AND mr.content_id = a.answer_id

     WHERE mr.id = ?`,
    [Number(id)],
  );

  return rows[0] || null;
};

/**
 * Updates a moderation review.
 */
export const updateModerationReportModel = async ({
  id,
  reviewerId,
  status,
  action,
  reviewNote,
}) => {
  await safeExecute(
    `UPDATE moderation_reports
     SET
       status = ?,
       action = ?,
       review_note = ?,
       reviewed_by = ?,
       reviewed_at = NOW()
     WHERE id = ?`,
    [status, action, reviewNote || null, Number(reviewerId), Number(id)],
  );

  return getModerationReportModel(id);
};

/**
 * Makes moderated content visible or hidden.
 *
 * visible = true
 *   -> publish content
 *
 * visible = false
 *   -> keep content hidden
 */
export const setModeratedContentVisibilityModel = async ({
  contentType,
  contentId,
  visible,
  userId = null,
}) => {
  const hidden = visible ? 0 : 1;
  const hiddenBy = visible ? null : userId;

  if (contentType === "question") {
    await safeExecute(
      `UPDATE questions
       SET
         is_hidden = ?,
         hidden_at = CASE
           WHEN ? = 1 THEN NOW()
           ELSE NULL
         END,
         hidden_by = ?
       WHERE question_id = ?`,
      [hidden, hidden, hiddenBy, Number(contentId)],
    );

    return;
  }

  if (contentType === "answer") {
    await safeExecute(
      `UPDATE answers
       SET
         is_hidden = ?,
         hidden_at = CASE
           WHEN ? = 1 THEN NOW()
           ELSE NULL
         END,
         hidden_by = ?
       WHERE answer_id = ?`,
      [hidden, hidden, hiddenBy, Number(contentId)],
    );
  }
};

/**
 * Counts confirmed violations for a user.
 *
 * Only confirmed hate, threat, and harassment count.
 *
 * Political discussion by itself does not count as a violation.
 */
export const getUserViolationCountModel = async (userId) => {
  const rows = await safeExecute(
    `SELECT COUNT(*) AS violationCount
     FROM moderation_reports
     WHERE user_id = ?
       AND category IN (
         'hate',
         'threat',
         'harassment'
       )
       AND status = 'action_taken'
       AND action IN ('hide', 'remove')`,
    [Number(userId)],
  );

  return Number(rows[0]?.violationCount || 0);
};

/**
 * Bans a normal user.
 *
 * Admins and Super Admins cannot be banned by this moderation mechanism.
 */
export const banUserModel = async ({ userId, bannedBy, reason }) => {
  const rows = await safeExecute(
    `SELECT
       user_id,
       role,
       is_banned
     FROM users
     WHERE user_id = ?
     LIMIT 1`,
    [Number(userId)],
  );

  if (rows.length === 0) {
    return {
      userId,
      banned: false,
    };
  }

  const user = rows[0];

  if (user.role === "admin" || user.role === "super-admin") {
    return {
      userId,
      banned: false,
    };
  }

  if (Number(user.is_banned) === 1) {
    return {
      userId,
      banned: true,
      alreadyBanned: true,
    };
  }

  await safeExecute(
    `UPDATE users
     SET
       is_banned = 1,
       banned_at = NOW(),
       banned_by = ?,
       ban_reason = ?
     WHERE user_id = ?`,
    [
      Number(bannedBy),
      reason || "Repeated moderation violations",
      Number(userId),
    ],
  );

  return {
    userId,
    banned: true,
    alreadyBanned: false,
  };
};
