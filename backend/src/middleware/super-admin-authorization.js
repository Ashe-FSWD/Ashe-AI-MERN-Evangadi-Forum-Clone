import { ForbiddenError } from "../utils/errors/index.js";

const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    throw new ForbiddenError("Authentication required");
  }

  if (req.user.role !== "super-admin") {
    throw new ForbiddenError("Super admin access required");
  }

  next();
};

export default requireSuperAdmin;
