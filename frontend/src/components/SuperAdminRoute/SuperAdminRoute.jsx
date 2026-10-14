import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import ProtectedRoute from "../ProtectedRoute/ProtectedRoute.jsx";

export default function SuperAdminRoute({ children }) {
  const { user } = useAuth();

  if (user?.role !== "super-admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <ProtectedRoute>{children}</ProtectedRoute>;
}
