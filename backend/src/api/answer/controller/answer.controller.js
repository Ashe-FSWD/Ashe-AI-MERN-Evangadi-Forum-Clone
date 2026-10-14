import { StatusCodes } from "http-status-codes";
import {
  createAnswerService,
  voteAnswerService,
} from "../service/answer.service.js";

/**
 * POST /api/answers
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next.
 */
export const createAnswerController = async (req, res, next) => {
  try {
    const { questionId, content } = req.body;

    const answer = await createAnswerService({
      questionId,
      content,
      userId: req.user.id,
    });

    if (answer.status === "pending_review") {
      return res.status(202).json({
        success: true,
        message: "Your answer was submitted for Super Admin review.",
        data: answer,
      });
    }

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Answer posted successfully.",
      data: answer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/answers/:answerId/vote
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next.
 */
export const voteAnswerController = async (req, res, next) => {
  try {
    const { answerId } = req.params;
    const { vote } = req.body;

    const result = await voteAnswerService({
      answerId: Number(answerId),
      userId: req.user.id,
      vote: Number(vote),
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Vote recorded successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// import { StatusCodes } from "http-status-codes";
// import {
//   createAnswerService,
//   voteAnswerService,
// } from "../service/answer.service.js";

// /**
//  * POST /api/answers
//  *
//  * @param {import('express').Request} req - Express request.
//  * @param {import('express').Response} res - Express response.
//  * @param {import('express').NextFunction} next - Express next.
//  */
// export const createAnswerController = async (req, res, next) => {
//   try {
//     const { questionId, content } = req.body;

//     const answer = await createAnswerService({
//       questionId,
//       content,
//       userId: req.user.id,
//     });

//     res.status(StatusCodes.CREATED).json({
//       success: true,
//       message: "Answer posted successfully",
//       data: answer,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * POST /api/answers/:answerId/vote
//  *
//  * @param {import('express').Request} req - Express request.
//  * @param {import('express').Response} res - Express response.
//  * @param {import('express').NextFunction} next - Express next.
//  */
// export const voteAnswerController = async (req, res, next) => {
//   try {
//     const { answerId } = req.params;
//     const { vote } = req.body;

//     const result = await voteAnswerService({
//       answerId: Number(answerId),
//       userId: req.user.id,
//       vote: Number(vote),
//     });

//     res.status(StatusCodes.OK).json({
//       success: true,
//       message: "Vote recorded successfully",
//       data: result,
//     });
//   } catch (error) {
//     next(error);
//   }
// };
