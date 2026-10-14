import jwt from "jsonwebtoken";

import { UnauthenticatedError, ForbiddenError } from "../utils/errors/index.js";

import { safeExecute } from "../../db/config.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthenticatedError("Authentication invalid");
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    /*
     * IMPORTANT:
     *
     * Do not trust role/is_banned only from JWT.
     * Check the current database state.
     */
    const rows = await safeExecute(
      `SELECT
         user_id,
         first_name,
         last_name,
         role,
         is_active,
         is_banned
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [payload.id],
    );

    if (rows.length === 0) {
      throw new UnauthenticatedError("User account not found");
    }

    const user = rows[0];

    if (Number(user.is_active) !== 1) {
      throw new UnauthenticatedError("Your account has been deactivated.");
    }

    if (Number(user.is_banned) === 1) {
      throw new ForbiddenError(
        "Your account has been banned because of repeated moderation violations.",
      );
    }

    req.user = {
      id: user.user_id,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
    };

    next();
  } catch (error) {
    if (
      error instanceof UnauthenticatedError ||
      error instanceof ForbiddenError
    ) {
      throw error;
    }

    throw new UnauthenticatedError("Authentication invalid");
  }
};

/**
 * Admin OR Super Admin.
 */
export const authorizeAdmin = (req, res, next) => {
  if (req.user?.role !== "admin" && req.user?.role !== "super-admin") {
    throw new ForbiddenError("Admin access required");
  }

  next();
};

/**
 * Super Admin only.
 */
export const authorizeSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "super-admin") {
    throw new ForbiddenError("Super admin access required");
  }

  next();
};
