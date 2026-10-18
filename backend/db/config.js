import dotenv from "dotenv";
dotenv.config();
import mysql from "mysql2/promise";

const sslEnabled =
  String(process.env.DB_SSL || "false").toLowerCase() === "true";
const sslCa = process.env.DB_SSL_CA;

const ssl = sslEnabled
  ? {
      // Aiven recommends verifying the server certificate using its CA.
      ...(sslCa ? { ca: sslCa.replace(/\\n/g, "\n") } : {}),
      // rejectUnauthorized: true,
      rejectUnauthorized: false,
    }
  : undefined;

export const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "evangadi_forum",
  ...(ssl ? { ssl } : {}),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

const ensureParams = (params) => {
  if (params === undefined || params === null) {
    throw new Error("SQL parameters are required");
  }
  const isArray = Array.isArray(params);
  const isObject = !isArray && typeof params === "object";
  if (!isArray && !isObject) {
    throw new Error("SQL parameters must be an array or object");
  }
};

export const safeExecute = async (sql, params) => {
  if (typeof sql !== "string" || sql.trim().length === 0) {
    throw new Error("SQL query must be a non-empty string");
  }
  ensureParams(params);
  const [result] = await db.execute(sql, params);
  return result;
};
