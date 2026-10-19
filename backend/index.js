import express from "express";
import cors from "cors";

import { db } from "./db/config.js";
import { mainRouter } from "./src/api/routes.js";
import { errorHandler } from "./src/middleware/error-handler.js";
import {
  ensureAdminSchema,
  ensureAnswerVotesSchema,
  ensureAnswerVectorsSchema,
  ensureNotificationsSchema,
} from "./db/migrate.js";
import { resetInterruptedDocumentsService } from "./src/api/rag/service/rag.service.js";

const app = express();
const port = process.env.PORT || 3777;

// Set FRONTEND_URL to comma-separated frontend origins.
// Example:
// FRONTEND_URL=https://your-app.vercel.app,http://localhost:5173
const allowedOrigins = [
  ...(process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header, such as health checks.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health-check endpoint.
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Application API routes.
app.use("/api", mainRouter);

// Central error handler.
app.use(errorHandler);

const startServer = async () => {
  try {
    // Verify database connectivity before accepting requests.
    const connection = await db.getConnection();

    console.log("Database connection established successfully.");
    connection.release();

    // Apply existing schema migrations.
    await ensureAdminSchema();
    await ensureAnswerVotesSchema();
    await ensureAnswerVectorsSchema();
    await ensureNotificationsSchema();

    // Recover documents interrupted by a previous process shutdown.
    await resetInterruptedDocumentsService();

    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start the server:", error.message);
    process.exit(1);
  }
};

startServer();
