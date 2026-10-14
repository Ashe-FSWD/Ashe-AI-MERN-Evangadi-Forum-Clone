import { safeExecute } from "../../../../db/config.js";
import {
  embedText,
  recommendAnswerGrade,
} from "../../../services/gemini.service.js";
import { BadRequestError, NotFoundError } from "../../../utils/errors/index.js";
import { analyzeAndStoreModerationService } from "../../moderation/service/moderation.service.js";

/** Queries the up/down tallies + current user's vote for one answer. */
async function fetchVoteSummary(answerId, userId) {
  const summarySql = `
    SELECT
      COALESCE(SUM(vote = 1), 0) AS upVotes,
      COALESCE(SUM(vote = -1), 0) AS downVotes,
      COALESCE(SUM(vote), 0) AS voteCount
    FROM answer_votes
    WHERE answer_id = ?
  `;
  const [summaryRow] = await safeExecute(summarySql, [answerId]);

  const mineSql = `
    SELECT vote FROM answer_votes
    WHERE answer_id = ? AND user_id = ?
    LIMIT 1
  `;
  const mineRows = await safeExecute(mineSql, [answerId, userId]);

  return {
    voteCount: Number(summaryRow?.voteCount) || 0,
    upVotes: Number(summaryRow?.upVotes) || 0,
    downVotes: Number(summaryRow?.downVotes) || 0,
    myVote: Number(mineRows[0]?.vote) || 0,
  };
}

export const createAnswerService = async ({ questionId, content, userId }) => {
  const questionSql = `
    SELECT
      question_id,
      user_id,
      title,
      question_hash,
      content
    FROM questions
    WHERE question_id = ?
      AND is_hidden = FALSE
    LIMIT 1
  `;

  const questionRows = await safeExecute(questionSql, [questionId]);

  if (questionRows.length === 0) {
    throw new NotFoundError("Question not found");
  }

  const ownerId = questionRows[0].user_id;

  if (Number(ownerId) === Number(userId)) {
    throw new BadRequestError("You cannot answer your own question");
  }

  /*
   * Answer starts hidden.
   */
  const insertSql = `
    INSERT INTO answers
      (
        question_id,
        user_id,
        content,
        is_hidden
      )
    VALUES (?, ?, ?, TRUE)
  `;

  const insertResult = await safeExecute(insertSql, [
    questionId,
    userId,
    content,
  ]);

  const answerId = insertResult.insertId;

  /*
   * Fetch created answer.
   */
  const fetchSql = `
    SELECT
      a.answer_id,
      a.question_id,
      a.content,
      a.created_at,
      a.updated_at,
      u.user_id,
      u.first_name,
      u.last_name
    FROM answers a
    JOIN users u
      ON u.user_id = a.user_id
    WHERE a.answer_id = ?
    LIMIT 1
  `;

  const answerRows = await safeExecute(fetchSql, [answerId]);
  const row = answerRows[0];

  /*
   * AI MODERATION
   */
  const moderation = await analyzeAndStoreModerationService({
    contentType: "answer",
    contentId: answerId,
    content: content,
    userId,
  });

  /*
   * Review required.
   *
   * Answer stays hidden.
   * No vector.
   * No notification.
   */
  if (moderation.flagged) {
    return {
      id: answerId,
      questionId,
      content,
      status: "pending_review",
      reportId: moderation.reportId,
      author: {
        id: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
      },
    };
  }

  /*
   * Normal answer:
   * moderation already made it visible.
   */

  const sourceText = row.content;

  try {
    const vector = await embedText(sourceText, "RETRIEVAL_DOCUMENT");

    await safeExecute(
      `INSERT INTO answer_vectors
        (
          answer_id,
          source_text,
          embedding,
          status
        )
       VALUES (?, ?, ?, 'ready')`,
      [answerId, sourceText, JSON.stringify(vector)],
    );
  } catch (_error) {
    await safeExecute(
      `INSERT INTO answer_vectors
        (
          answer_id,
          source_text,
          embedding,
          status
        )
       VALUES (?, ?, ?, 'failed')`,
      [answerId, sourceText, JSON.stringify([])],
    );
  }

  /*
   * AI answer quality recommendation.
   */
  recommendAnswerGrade(questionRows[0].content, sourceText)
    .then((grade) => {
      return safeExecute(
        `UPDATE answer_vectors
         SET ai_grade = ?
         WHERE answer_id = ?`,
        [grade, answerId],
      );
    })
    .catch((error) => {
      console.warn(`[answer-grades] failed: ${error.message}`);
    });

  /*
   * Notify question owner only after
   * the answer is actually published.
   */
  try {
    const authorName = [row.first_name, row.last_name]
      .filter(Boolean)
      .join(" ");

    const title = String(questionRows[0].title || "your question").slice(0, 60);

    const message =
      `${authorName || "Someone"} answered ` + `your question: ${title}`;

    await safeExecute(
      `INSERT INTO notifications
        (
          user_id,
          type,
          message,
          question_id,
          question_hash
        )
       VALUES (
         ?,
         'answer_added',
         ?,
         ?,
         ?
       )`,
      [
        ownerId,
        message.slice(0, 500),
        questionId,
        questionRows[0].question_hash,
      ],
    );
  } catch (error) {
    console.warn(`[notifications] failed: ${error.message}`);
  }

  return {
    id: row.answer_id,
    questionId: row.question_id,
    content: row.content,
    status: "published",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    voteCount: 0,
    upVotes: 0,
    downVotes: 0,
    myVote: 0,
    aiGrade: null,
    author: {
      id: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
    },
  };
};

/**
 * Sets, changes, or removes the authenticated user's vote on an answer.
 *
 * Accepted votes: 1 = up, -1 = down, 0 = remove existing vote.
 *
 * @param {Object} input
 * @param {number} input.answerId - Target answer id.
 * @param {number} input.userId - Authenticated user id.
 * @param {number} input.vote - 1, -1, or 0.
 * @returns {Promise<Object>} `{ voteCount, myVote }`.
 * @throws {NotFoundError} When the answer does not exist.
 */
export const voteAnswerService = async ({ answerId, userId, vote }) => {
  const answerSql = "SELECT answer_id FROM answers WHERE answer_id = ? LIMIT 1";
  const answerRows = await safeExecute(answerSql, [answerId]);

  if (answerRows.length === 0) {
    throw new NotFoundError("Answer not found");
  }

  if (vote === 0) {
    await safeExecute(
      "DELETE FROM answer_votes WHERE answer_id = ? AND user_id = ?",
      [answerId, userId],
    );
  } else {
    const upsertSql = `
      INSERT INTO answer_votes (user_id, answer_id, vote)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE vote = ?
    `;
    await safeExecute(upsertSql, [userId, answerId, vote, vote]);
  }

  return fetchVoteSummary(answerId, userId);
};
