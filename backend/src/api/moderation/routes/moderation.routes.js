import express from "express";

import {
  authenticateUser,
  authorizeSuperAdmin,
} from "../../../middleware/authentication.js";

import {
  listModerationController,
  getModerationController,
  reviewModerationController,
} from "../controller/moderation.controller.js";

const router = express.Router();

router.use(authenticateUser, authorizeSuperAdmin);

router.get("/", listModerationController);

router.get("/:id", getModerationController);

router.patch("/:id/review", reviewModerationController);

export default router;

// import express from "express";
// import {
//   authenticateUser,
//   authorizeSuperAdmin,
// } from "../../../middleware/authentication.js";
// import {
//   listModerationController,
//   getModerationController,
//   reviewModerationController,
// } from "../controller/moderation.controller.js";

// const router = express.Router();

// router.use(authenticateUser, authorizeSuperAdmin);

// router.get("/", listModerationController);
// router.get("/:id", getModerationController);
// router.patch("/:id/review", reviewModerationController);

// export default router;
