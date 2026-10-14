import { StatusCodes } from "http-status-codes";
import {
  createQuestionWithVectorService,
  getQuestionsService,
  getSingleQuestionService,
  searchQuestionsSemanticService,
  getSimilarQuestionsService,
  getDashboardStatsService,
} from "../service/question.service.js";
import {
  generateQuestionDraftCoachService,
  assessAnswerAgainstQuestionService,
  generateSuggestedAnswerService,
} from "../../../services/geminiTextCoach.service.js";

/**
 * POST /api/questions
 * Creates a question and generates its embedding.
 */
export const createQuestionController = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    const question = await createQuestionWithVectorService({
      title,
      content,
      userId: req.user.id,
    });

    if (question.status === "pending_review") {
      return res.status(202).json({
        success: true,
        message: "Your question was submitted for Super Admin review.",
        data: question,
      });
    }

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Question posted successfully.",
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/questions
 * Lists questions with optional search / mine filters.
 */
export const getQuestionsController = async (req, res, next) => {
  try {
    const { search, mine } = req.query;
    const result = await getQuestionsService({
      search,
      mine,
      userId: req.user.id,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Questions fetched successfully.",
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/questions/stats
 * Returns dashboard summary counts.
 */
export const getDashboardStatsController = async (req, res, next) => {
  try {
    const data = await getDashboardStatsService({ userId: req.user.id });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Dashboard stats fetched successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/questions/:questionHash
 * Returns a single question with its answers.
 */
export const getSingleQuestionController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;
    const result = await getSingleQuestionService(questionHash, req.user.id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Question fetched successfully",
      question: result.question,
      answers: result.answers,
      answersMeta: result.answersMeta,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/questions/search
 * Performs semantic search using question embeddings.
 */
export const searchQuestionsSemanticController = async (req, res, next) => {
  try {
    const { query, k, threshold } = req.query;
    const result = await searchQuestionsSemanticService({
      query,
      k: k === undefined ? undefined : Number(k),
      threshold: threshold === undefined ? undefined : Number(threshold),
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Semantic search completed successfully",
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/questions/:questionHash/similar
 * Returns questions similar to the given one.
 */
export const getSimilarQuestionsController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;
    const { k, threshold } = req.query;
    const result = await getSimilarQuestionsService({
      questionHash,
      k: k === undefined ? undefined : Number(k),
      threshold: threshold === undefined ? undefined : Number(threshold),
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Similar questions fetched successfully",
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/questions/:questionHash/answer-fit
 * Evaluates how well a draft answer fits the question.
 */
export const assessAnswerAgainstQuestionController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;
    const { answerText } = req.body;

    const data = await assessAnswerAgainstQuestionService({
      questionHash,
      answerText,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Answer fit assessed",
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/questions/draft-coach
 * Generates AI suggestions for a question draft.
 */
export const generateQuestionDraftCoachController = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    const data = await generateQuestionDraftCoachService({ title, content });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Draft suggestions generated",
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/questions/:questionHash/answer-suggest
 * Generates an AI-drafted answer for the question.
 */
export const generateSuggestedAnswerController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;
    const { answerText } = req.body;

    const data = await generateSuggestedAnswerService({
      questionHash,
      answerText,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Suggested answer generated",
      data,
    });
  } catch (error) {
    next(error);
  }
};

// import { StatusCodes } from "http-status-codes";
// import {
//   createQuestionWithVectorService,
//   getQuestionsService,
//   getSingleQuestionService,
//   searchQuestionsSemanticService,
//   getSimilarQuestionsService,
//   getDashboardStatsService,
// } from "../service/question.service.js";
// import {
//   generateQuestionDraftCoachService,
//   assessAnswerAgainstQuestionService,
//   generateSuggestedAnswerService,
// } from "../../../services/geminiTextCoach.service.js";

// /**
//  * POST /api/questions
//  * Creates a question and generates its embedding.
//  */
// export const createQuestionController = async (req, res, next) => {
//   try {
//     const { title, content } = req.body;

//     const question = await createQuestionWithVectorService({
//       title,
//       content,
//       userId: req.user.id,
//     });

//     res.status(StatusCodes.CREATED).json({
//       success: true,
//       message: "Question posted successfully.",
//       data: question,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * GET /api/questions
//  * Lists questions with optional search / mine filters.
//  */
// export const getQuestionsController = async (req, res, next) => {
//   try {
//     const { search, mine } = req.query;
//     const result = await getQuestionsService({
//       search,
//       mine,
//       userId: req.user.id,
//     });

//     res.status(StatusCodes.OK).json({
//       success: true,
//       message: "Questions fetched successfully.",
//       data: result.data,
//       meta: result.meta,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * GET /api/questions/stats
//  * Returns dashboard summary counts.
//  */
// export const getDashboardStatsController = async (req, res, next) => {
//   try {
//     const data = await getDashboardStatsService({ userId: req.user.id });

//     res.status(StatusCodes.OK).json({
//       success: true,
//       message: "Dashboard stats fetched successfully.",
//       data,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * GET /api/questions/:questionHash
//  * Returns a single question with its answers.
//  */
// export const getSingleQuestionController = async (req, res, next) => {
//   try {
//     const { questionHash } = req.params;
//     const result = await getSingleQuestionService(questionHash, req.user.id);

//     res.status(StatusCodes.OK).json({
//       success: true,
//       message: "Question fetched successfully",
//       question: result.question,
//       answers: result.answers,
//       answersMeta: result.answersMeta,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * GET /api/questions/search
//  * Performs semantic search using question embeddings.
//  */
// export const searchQuestionsSemanticController = async (req, res, next) => {
//   try {
//     const { query, k, threshold } = req.query;
//     const result = await searchQuestionsSemanticService({
//       query,
//       k: k === undefined ? undefined : Number(k),
//       threshold: threshold === undefined ? undefined : Number(threshold),
//     });

//     res.status(StatusCodes.OK).json({
//       success: true,
//       message: "Semantic search completed successfully",
//       data: result.data,
//       meta: result.meta,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * GET /api/questions/:questionHash/similar
//  * Returns questions similar to the given one.
//  */
// export const getSimilarQuestionsController = async (req, res, next) => {
//   try {
//     const { questionHash } = req.params;
//     const { k, threshold } = req.query;
//     const result = await getSimilarQuestionsService({
//       questionHash,
//       k: k === undefined ? undefined : Number(k),
//       threshold: threshold === undefined ? undefined : Number(threshold),
//     });

//     res.status(StatusCodes.OK).json({
//       success: true,
//       message: "Similar questions fetched successfully",
//       data: result.data,
//       meta: result.meta,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * POST /api/questions/:questionHash/answer-fit
//  * Evaluates how well a draft answer fits the question.
//  */
// export const assessAnswerAgainstQuestionController = async (req, res, next) => {
//   try {
//     const { questionHash } = req.params;
//     const { answerText } = req.body;

//     const data = await assessAnswerAgainstQuestionService({
//       questionHash,
//       answerText,
//     });

//     res.status(StatusCodes.OK).json({
//       success: true,
//       message: "Answer fit assessed",
//       data,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * POST /api/questions/draft-coach
//  * Generates AI suggestions for a question draft.
//  */
// export const generateQuestionDraftCoachController = async (req, res, next) => {
//   try {
//     const { title, content } = req.body;

//     const data = await generateQuestionDraftCoachService({ title, content });

//     res.status(StatusCodes.OK).json({
//       success: true,
//       message: "Draft suggestions generated",
//       data,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * POST /api/questions/:questionHash/answer-suggest
//  * Generates an AI-drafted answer for the question.
//  */
// export const generateSuggestedAnswerController = async (req, res, next) => {
//   try {
//     const { questionHash } = req.params;
//     const { answerText } = req.body;

//     const data = await generateSuggestedAnswerService({
//       questionHash,
//       answerText,
//     });

//     res.status(StatusCodes.OK).json({
//       success: true,
//       message: "Suggested answer generated",
//       data,
//     });
//   } catch (error) {
//     next(error);
//   }
// };
