import express from "express";
import authRoutes from "./auth/routes/auth.routes.js";
import questionRoutes from "./question/routes/question.routes.js";
import answerRoutes from "./answer/routes/answer.routes.js";
import ragRoutes from "./rag/routes/rag.routes.js";
import adminRoutes from "./admin/routes/admin.routes.js";
import notificationRoutes from "./notification/routes/notification.routes.js";
import moderationRoutes from "./moderation/routes/moderation.routes.js";

export const mainRouter = express.Router();

mainRouter.use("/auth", authRoutes);

mainRouter.use("/questions", questionRoutes);

mainRouter.use("/answers", answerRoutes);

mainRouter.use("/rag/documents", ragRoutes);

mainRouter.use("/admin", adminRoutes);

mainRouter.use("/admin/moderation", moderationRoutes);

mainRouter.use("/notifications", notificationRoutes);

// import express from "express";
// import authRoutes from "./auth/routes/auth.routes.js";
// import questionRoutes from "./question/routes/question.routes.js";
// import answerRoutes from "./answer/routes/answer.routes.js";
// import ragRoutes from "./rag/routes/rag.routes.js";
// import adminRoutes from "./admin/routes/admin.routes.js";
// import notificationRoutes from "./notification/routes/notification.routes.js";

// export const mainRouter = express.Router();

// // Authentication routes
// mainRouter.use("/auth", authRoutes);

// // Questions routes (incl. semantic search / similar / AI coach endpoints)
// mainRouter.use("/questions", questionRoutes);

// // Answers routes
// mainRouter.use("/answers", answerRoutes);

// // RAG document routes
// mainRouter.use("/rag/documents", ragRoutes);

// // Admin routes (all require an authenticated admin session)
// mainRouter.use("/admin", adminRoutes);

// // Notifications routes
// mainRouter.use("/notifications", notificationRoutes);
