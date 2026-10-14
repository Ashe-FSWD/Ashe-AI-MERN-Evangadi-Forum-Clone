import express from "express";
import { db } from "./db/config.js";
import { mainRouter } from "./src/api/routes.js";
import { errorHandler } from "./src/middleware/error-handler.js";
import { resetInterruptedDocumentsService } from "./src/api/rag/service/rag.service.js";
import {
  ensureAdminSchema,
  ensureAnswerVotesSchema,
  ensureAnswerVectorsSchema,
  ensureNotificationsSchema,
} from "./db/migrate.js";
import cors from "cors";

const app = express();
const port = process.env.PORT || 3777;

// Restrict CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header, such as server-side health checks.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
  }),
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

app.use("/api", mainRouter);

app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const connection = await db.getConnection();

    console.log("Database connection established successfully.");
    connection.release();

    // Apply additive schema changes (admin role columns) when missing.
    await ensureAdminSchema();

    // Create the answer voting table when missing.
    await ensureAnswerVotesSchema();

    // Create the answer embedding table when missing.
    await ensureAnswerVectorsSchema();

    // Create the notifications table when missing.
    await ensureNotificationsSchema();

    // Documents stuck in `processing` from a previous run can never finish
    // (their background job died with the old process). Mark them failed.
    await resetInterruptedDocumentsService();

    app.listen(port, (err) => {
      if (err) {
        console.error("Failed to start the server:", err.message);
        process.exit(1);
      }
      console.log(`Server running on port http://localhost:${port}`);
    });
  } catch (error) {
    console.error(
      "Failed to connect to the database. Server not started.",
      error.message,
    );
    process.exit(1);
  }
};

startServer();
