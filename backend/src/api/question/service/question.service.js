import { safeExecute } from "../../../../db/config.js";
import { NotFoundError } from "../../../utils/errors/index.js";

// Moderation by Gemini
import { analyzeAndStoreModerationService } from "../../moderation/service/moderation.service.js";

import {
  cosineSimilarity,
  parseEmbedding,
  generateHexHash,
} from "../../../utils/vector.js";

import { embedText } from "../../../services/gemini.service.js";

// gemini-embedding-001 scores related content ~0.5-0.74 and unrelated ~0.3-0.7,
// so a strict threshold like 0.75 filters out everything. Keep the default low.
const RECOMMEND_THRESHOLD = Number(process.env.RECOMMEND_THRESHOLD) || 0.2;

// The dashboard AI search should list only genuinely similar questions,
// so it uses a stricter threshold (0.6) and a small result cap (2).
const SEMANTIC_SEARCH_THRESHOLD =
  Number(process.env.SEMANTIC_SEARCH_THRESHOLD) || 0.6;

const SEMANTIC_SEARCH_K = Number(process.env.SEMANTIC_SEARCH_K) || 2;

const RECOMMEND_K = Number(process.env.RECOMMEND_K) || 10;

const DEFAULT_ANSWERS_LIMIT = 100;

/**
 * Thread ranking blends AI relevance
 * with the net vote score.
 */
const ANSWER_RANK_AI_WEIGHT = Number(process.env.ANSWER_RANK_AI_WEIGHT) || 0.5;

const ANSWER_RANK_VOTE_WEIGHT =
  Number(process.env.ANSWER_RANK_VOTE_WEIGHT) || 0.5;

/**
 * Gemini AI-score thresholds used to grade answers
 * as Good / Moderate / Low.
 */
const ANSWER_GOOD_MIN = Number(process.env.ANSWER_GOOD_MIN) || 0.6;

const ANSWER_MODERATE_MIN = Number(process.env.ANSWER_MODERATE_MIN) || 0.45;

/**
 * Maps an AI relevance score to a recommendation label.
 *
 * @param {number} score
 * @returns {'Good' | 'Moderate' | 'Low' | null}
 */
function gradeFromScore(score) {
  if (!Number.isFinite(score) || score <= 0) {
    return null;
  }

  if (score >= ANSWER_GOOD_MIN) {
    return "Good";
  }

  if (score >= ANSWER_MODERATE_MIN) {
    return "Moderate";
  }

  return "Low";
}

/**
 * Maps a flat questions JOIN users JOIN answers row
 * to the API question shape.
 */
function mapQuestionRow(row) {
  return {
    id: row.question_id,
    questionHash: row.question_hash,
    title: row.title,
    content: row.content,
    answerCount: Number(row.answerCount) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    author: {
      id: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
    },
  };
}

/**
 * Hydrates question detail rows from a list of question ids.
 *
 * IMPORTANT:
 * Only visible questions are returned.
 *
 * Hidden answers are also excluded from answerCount.
 *
 * @param {number[]} ids
 * @returns {Promise<Array>}
 */
async function hydrateQuestionDetails(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  const sql = `
    SELECT
      q.question_id,
      q.question_hash,
      q.title,
      q.content,
      q.created_at,
      q.updated_at,

      u.user_id,
      u.first_name,
      u.last_name,

      COUNT(a.answer_id) AS answerCount

    FROM questions q

    JOIN users u
      ON u.user_id = q.user_id

    LEFT JOIN answers a
      ON a.question_id = q.question_id
     AND a.is_hidden = FALSE

    WHERE q.question_id IN (
      ${ids.map(() => "?").join(",")}
    )

      AND q.is_hidden = FALSE

    GROUP BY
      q.question_id,
      q.question_hash,
      q.title,
      q.content,
      q.created_at,
      q.updated_at,
      u.user_id,
      u.first_name,
      u.last_name
  `;

  const rows = await safeExecute(sql, ids);

  const byId = new Map(
    rows.map((row) => [row.question_id, mapQuestionRow(row)]),
  );

  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * Creates a question and stores its vector embedding
 * when the question is approved.
 *
 * New questions start hidden.
 *
 * Normal question:
 *
 * INSERT
 *   ↓
 * is_hidden = TRUE
 *   ↓
 * AI moderation
 *   ↓
 * normal
 *   ↓
 * is_hidden = FALSE
 *   ↓
 * embedding
 *
 * Flagged question:
 *
 * INSERT
 *   ↓
 * is_hidden = TRUE
 *   ↓
 * AI moderation
 *   ↓
 * Super Admin review
 */
export const createQuestionWithVectorService = async ({
  title,
  content,
  userId,
}) => {
  const questionHash = generateHexHash(16);

  /*
   * New questions start hidden.
   *
   * This prevents a question that requires moderation
   * from being publicly visible before review.
   */
  const insertSql = `
    INSERT INTO questions
      (
        question_hash,
        user_id,
        title,
        content,
        is_hidden
      )
    VALUES (?, ?, ?, ?, TRUE)
  `;

  const insertResult = await safeExecute(insertSql, [
    questionHash,
    userId,
    title,
    content,
  ]);

  const questionId = insertResult.insertId;

  const createdQuestion = {
    id: questionId,
    questionHash,
    title,
    content,
    userId,
  };

  /*
   * AI MODERATION
   */
  const moderation = await analyzeAndStoreModerationService({
    contentType: "question",
    contentId: questionId,
    content: `${title}\n\n${content}`,
    userId,
  });

  /*
   * If moderation is required:
   *
   * - question remains hidden
   * - no public question is shown
   * - no public search result is created
   */
  if (moderation.flagged) {
    return {
      ...createdQuestion,
      status: "pending_review",
      reportId: moderation.reportId,
    };
  }

  /*
   * Normal content is made visible by
   * the moderation service.
   *
   * Now create the semantic-search vector.
   */
  const sourceText = `${title}\n\n${content}`;

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
       VALUES (?, ?, ?, 'ready')`,
      [questionId, sourceText, JSON.stringify(vector)],
    );
  } catch (_error) {
    await safeExecute(
      `INSERT INTO question_vectors
        (
          question_id,
          source_text,
          embedding,
          status
        )
       VALUES (?, ?, ?, 'failed')`,
      [questionId, sourceText, JSON.stringify([])],
    );
  }

  return {
    ...createdQuestion,
    status: "published",
  };
};

/**
 * Lists visible questions.
 *
 * Supports:
 *
 * search = keyword search
 * mine = authenticated user's questions
 *
 * IMPORTANT:
 * Hidden questions are never returned.
 */
export const getQuestionsService = async ({ search, mine, userId }) => {
  /*
   * IMPORTANT:
   *
   * Every normal question-list query starts
   * by excluding hidden questions.
   */
  const conditions = ["q.is_hidden = FALSE"];

  const params = [];

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;

    conditions.push("(q.title LIKE ? OR q.content LIKE ?)");

    params.push(term, term);
  }

  if (mine === "true" || mine === "1" || mine === true) {
    conditions.push("q.user_id = ?");

    params.push(userId);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT
      q.question_id,
      q.question_hash,
      q.title,
      q.content,
      q.created_at,
      q.updated_at,

      u.user_id,
      u.first_name,
      u.last_name,

      COUNT(a.answer_id) AS answerCount

    FROM questions q

    JOIN users u
      ON u.user_id = q.user_id

    LEFT JOIN answers a
      ON a.question_id = q.question_id
     AND a.is_hidden = FALSE

    ${whereClause}

    GROUP BY
      q.question_id,
      q.question_hash,
      q.title,
      q.content,
      q.created_at,
      q.updated_at,
      u.user_id,
      u.first_name,
      u.last_name

    ORDER BY q.created_at DESC
  `;

  const rows = await safeExecute(sql, params);

  return {
    data: rows.map(mapQuestionRow),

    meta: {
      limit: DEFAULT_ANSWERS_LIMIT,
      total: rows.length,
      sortBy: "newest",
      sortOrder: "desc",
    },
  };
};

/**
 * Computes AI relevance scores for answers.
 *
 * Only ready answer vectors are used.
 *
 * @param {number} questionId
 * @param {number[]} answerIds
 * @returns {Promise<Map<number, number>>}
 */
async function computeAnswerAiScores(questionId, answerIds) {
  if (answerIds.length === 0) {
    return new Map();
  }

  const questionVectorSql = `
    SELECT embedding
    FROM question_vectors
    WHERE question_id = ?
      AND status = 'ready'
    LIMIT 1
  `;

  const questionVectorRows = await safeExecute(questionVectorSql, [questionId]);

  if (questionVectorRows.length === 0) {
    return new Map();
  }

  const questionVector = parseEmbedding(questionVectorRows[0].embedding);

  if (questionVector.length === 0) {
    return new Map();
  }

  const placeholders = answerIds.map(() => "?").join(",");

  const answerVectorSql = `
    SELECT
      answer_id,
      embedding

    FROM answer_vectors

    WHERE status = 'ready'
      AND answer_id IN (${placeholders})
  `;

  const answerVectorRows = await safeExecute(answerVectorSql, answerIds);

  return new Map(
    answerVectorRows.map((row) => [
      row.answer_id,
      cosineSimilarity(questionVector, parseEmbedding(row.embedding)),
    ]),
  );
}

/**
 * Ranks answers by:
 *
 * AI relevance
 * +
 * vote score
 */
function rankAnswers(answers) {
  const votes = answers.map((answer) => answer.voteCount);

  const maxVote = Math.max(...votes, 0);

  const minVote = Math.min(...votes, 0);

  const range = maxVote - minVote;

  answers.forEach((answer) => {
    const normalizedVote =
      range > 0 ? (answer.voteCount - minVote) / range : 0.5;

    answer.combinedScore =
      ANSWER_RANK_AI_WEIGHT * answer.aiScore +
      ANSWER_RANK_VOTE_WEIGHT * normalizedVote;
  });

  answers.sort(
    (a, b) =>
      b.combinedScore - a.combinedScore ||
      new Date(a.createdAt) - new Date(b.createdAt),
  );

  answers.forEach((answer, index) => {
    answer.rank = index + 1;
  });
}

/**
 * Fetches a single visible question
 * with its visible answers.
 *
 * Hidden question:
 *     NOT FOUND
 *
 * Hidden answer:
 *     NOT RETURNED
 *
 * @param {string} questionHash
 * @param {number} [userId]
 * @returns {Promise<Object>}
 */
export const getSingleQuestionService = async (questionHash, userId) => {
  /*
   * PART 12:
   *
   * A hidden question cannot be opened
   * through Question Detail.
   */
  const questionSql = `
    SELECT
      q.question_id,
      q.question_hash,
      q.title,
      q.content,
      q.created_at,
      q.updated_at,

      u.user_id,
      u.first_name,
      u.last_name

    FROM questions q

    JOIN users u
      ON u.user_id = q.user_id

    WHERE q.question_hash = ?
      AND q.is_hidden = FALSE

    LIMIT 1
  `;

  const questionRows = await safeExecute(questionSql, [questionHash]);

  if (questionRows.length === 0) {
    throw new NotFoundError("Question not found");
  }

  const questionRow = questionRows[0];

  /*
   * Hidden answers are excluded.
   */
  const answersSql = `
    SELECT
      a.answer_id,
      a.question_id,
      a.content,
      a.created_at,
      a.updated_at,

      u.user_id,
      u.first_name,
      u.last_name,

      COALESCE(
        SUM(v.vote),
        0
      ) AS voteCount,

      COALESCE(
        SUM(v.vote = 1),
        0
      ) AS upVotes,

      COALESCE(
        SUM(v.vote = -1),
        0
      ) AS downVotes,

      IFNULL(
        MAX(
          CASE
            WHEN v.user_id = ?
            THEN v.vote
          END
        ),
        0
      ) AS myVote,

      av.ai_grade

    FROM answers a

    JOIN users u
      ON u.user_id = a.user_id

    LEFT JOIN answer_votes v
      ON v.answer_id = a.answer_id

    LEFT JOIN answer_vectors av
      ON av.answer_id = a.answer_id

    WHERE a.question_id = ?
      AND a.is_hidden = FALSE

    GROUP BY
      a.answer_id,
      a.question_id,
      a.content,
      a.created_at,
      a.updated_at,

      u.user_id,
      u.first_name,
      u.last_name,

      av.ai_grade

    ORDER BY a.created_at ASC
  `;

  const answerRows = await safeExecute(answersSql, [
    userId,
    questionRow.question_id,
  ]);

  const answers = answerRows.map((row) => ({
    id: row.answer_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    voteCount: Number(row.voteCount) || 0,

    upVotes: Number(row.upVotes) || 0,

    downVotes: Number(row.downVotes) || 0,

    myVote: Number(row.myVote) || 0,

    aiGrade: row.ai_grade || null,

    aiScore: 0,
    combinedScore: 0,
    rank: 1,

    author: {
      id: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
    },
  }));

  /*
   * AI relevance ranking.
   */
  if (answers.length > 0) {
    const aiScores = await computeAnswerAiScores(
      questionRow.question_id,
      answers.map((answer) => answer.id),
    );

    answers.forEach((answer) => {
      const score = Math.max(0, aiScores.get(answer.id) ?? 0);

      answer.aiScore = score;

      if (!answer.aiGrade) {
        answer.aiGrade = gradeFromScore(score);
      }
    });

    rankAnswers(answers);
  }

  return {
    question: {
      id: questionRow.question_id,

      questionHash: questionRow.question_hash,

      title: questionRow.title,

      content: questionRow.content,

      answerCount: answers.length,

      createdAt: questionRow.created_at,

      updatedAt: questionRow.updated_at,

      author: {
        id: questionRow.user_id,

        firstName: questionRow.first_name,

        lastName: questionRow.last_name,
      },
    },

    answers,

    answersMeta: {
      limit: DEFAULT_ANSWERS_LIMIT,

      total: answers.length,
    },
  };
};

/**
 * Forum-wide summary counts for the user dashboard.
 *
 * IMPORTANT:
 * Hidden content is excluded.
 *
 * @param {Object} input
 * @param {number} input.userId
 * @returns {Promise<Object>}
 */
export const getDashboardStatsService = async ({ userId }) => {
  /*
   * PART 13
   *
   * Count only visible questions.
   */
  const [totalQuestions] = await safeExecute(
    `
          SELECT COUNT(*) AS n
          FROM questions
          WHERE is_hidden = FALSE
        `,
    [],
  );

  /*
   * Count only visible answers.
   */
  const [totalReplies] = await safeExecute(
    `
          SELECT COUNT(*) AS n
          FROM answers
          WHERE is_hidden = FALSE
        `,
    [],
  );

  /*
   * Count questions that have at least
   * one visible answer AND are themselves visible.
   *
   * This is safer than counting answers only,
   * because a hidden question should not appear
   * as an answered question.
   */
  const [answeredQuestions] = await safeExecute(
    `
          SELECT COUNT(
            DISTINCT a.question_id
          ) AS n

          FROM answers a

          JOIN questions q
            ON q.question_id =
               a.question_id

          WHERE a.is_hidden = FALSE
            AND q.is_hidden = FALSE
        `,
    [],
  );

  /*
   * My Questions:
   * only the current user's visible questions.
   */
  const [myQuestions] = await safeExecute(
    `
          SELECT COUNT(*) AS n
          FROM questions
          WHERE user_id = ?
            AND is_hidden = FALSE
        `,
    [userId],
  );

  return {
    totalQuestions: Number(totalQuestions.n) || 0,

    totalReplies: Number(totalReplies.n) || 0,

    answeredQuestions: Number(answeredQuestions.n) || 0,

    myQuestions: Number(myQuestions.n) || 0,
  };
};

/**
 * Performs semantic search over stored
 * question embeddings.
 *
 * PART 14
 *
 * IMPORTANT:
 * A vector by itself is not enough.
 *
 * We JOIN question_vectors to questions
 * and check:
 *
 * q.is_hidden = FALSE
 *
 * This prevents hidden questions from
 * appearing in semantic search.
 *
 * @param {Object} input
 * @param {string} input.query
 * @param {number} [input.k]
 * @param {number} [input.threshold]
 * @returns {Promise<Object>}
 */
export const searchQuestionsSemanticService = async ({
  query,
  k = SEMANTIC_SEARCH_K,
  threshold = SEMANTIC_SEARCH_THRESHOLD,
}) => {
  const queryVector = await embedText(query, "RETRIEVAL_QUERY");

  /*
   * PART 14
   *
   * Only use vectors belonging to
   * visible questions.
   */
  const vectorSql = `
      SELECT
        qv.question_id,
        qv.embedding

      FROM question_vectors qv

      JOIN questions q
        ON q.question_id =
           qv.question_id

      WHERE qv.status = 'ready'
        AND q.is_hidden = FALSE
    `;

  const vectorRows = await safeExecute(vectorSql, []);

  const scored = vectorRows
    .map((row) => ({
      questionId: row.question_id,

      score: cosineSimilarity(queryVector, parseEmbedding(row.embedding)),
    }))

    .filter((item) => item.score >= threshold)

    .sort((a, b) => b.score - a.score)

    .slice(0, k);

  console.log(
    `[Semantic search] vectors=${vectorRows.length} ` +
      `queryDim=${queryVector.length} ` +
      `threshold=${threshold} ` +
      `k=${k} ` +
      `topScores=${scored
        .slice(0, 5)
        .map((item) => item.score.toFixed(4))
        .join(", ")}`,
  );

  const data = await hydrateQuestionDetails(
    scored.map((item) => item.questionId),
  );

  const scoreById = new Map(
    scored.map((item) => [item.questionId, item.score]),
  );

  return {
    data: data.map((question) => ({
      ...question,

      score: scoreById.get(question.id) ?? 0,
    })),

    meta: {
      total: data.length,

      k,

      threshold,

      query,

      questionHash: null,
    },
  };
};

/**
 * Finds visible questions similar to the given one.
 *
 * PART 15
 *
 * Hidden questions are excluded both:
 *
 * 1. As the source question
 * 2. As recommended questions
 *
 * @param {Object} input
 * @param {string} input.questionHash
 * @param {number} [input.k]
 * @param {number} [input.threshold]
 * @returns {Promise<Object>}
 */
export const getSimilarQuestionsService = async ({
  questionHash,
  k = RECOMMEND_K,
  threshold = RECOMMEND_THRESHOLD,
}) => {
  /*
   * PART 15 — SOURCE QUESTION
   *
   * The source question itself must
   * also be visible.
   */
  const sourceSql = `
      SELECT
        q.question_id,
        qv.embedding

      FROM questions q

      JOIN question_vectors qv
        ON qv.question_id =
           q.question_id

      WHERE q.question_hash = ?
        AND q.is_hidden = FALSE

      LIMIT 1
    `;

  const sourceRows = await safeExecute(sourceSql, [questionHash]);

  if (sourceRows.length === 0) {
    throw new NotFoundError("Question not found");
  }

  const sourceId = sourceRows[0].question_id;

  const sourceVector = parseEmbedding(sourceRows[0].embedding);

  if (sourceVector.length === 0) {
    return {
      data: [],

      meta: {
        total: 0,
        k,
        threshold,
        query: null,
        questionHash,
      },
    };
  }

  /*
   * PART 15 — RECOMMENDED QUESTIONS
   *
   * Only ready vectors belonging to
   * visible questions are considered.
   */
  const vectorSql = `
      SELECT
        qv.question_id,
        qv.embedding

      FROM question_vectors qv

      JOIN questions q
        ON q.question_id =
           qv.question_id

      WHERE qv.status = 'ready'
        AND q.is_hidden = FALSE
        AND qv.question_id <> ?
    `;

  const vectorRows = await safeExecute(vectorSql, [sourceId]);

  const scored = vectorRows
    .map((row) => ({
      questionId: row.question_id,

      score: cosineSimilarity(sourceVector, parseEmbedding(row.embedding)),
    }))

    .filter((item) => item.score >= threshold)

    .sort((a, b) => b.score - a.score)

    .slice(0, k);

  /*
   * Hydrate only visible questions.
   *
   * hydrateQuestionDetails() also checks
   * q.is_hidden = FALSE.
   */
  const data = await hydrateQuestionDetails(
    scored.map((item) => item.questionId),
  );

  const scoreById = new Map(
    scored.map((item) => [item.questionId, item.score]),
  );

  return {
    data: data.map((question) => ({
      ...question,

      score: scoreById.get(question.id) ?? 0,
    })),

    meta: {
      total: data.length,

      k,

      threshold,

      query: null,

      questionHash,
    },
  };
};
