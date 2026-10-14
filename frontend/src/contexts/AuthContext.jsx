import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/auth/auth.service.js";

/**
 * Authentication Context providing user state and auth methods.
 */
const AuthContext = createContext(undefined);

/**
 * AuthProvider component that wraps the app to provide authentication context.
 */
export function AuthProvider({ children }) {
  // Authentication state — restored synchronously from localStorage on mount.
  const [user, setUser] = useState(() => {
    const token = authService.getStoredToken();
    const storedUser = authService.getStoredUser();
    return token && storedUser ? storedUser : null;
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  /**
   * Registers a new user. Does not automatically log them in.
   * @param {Object} userData - { firstName, lastName, email, password }
   */
  const register = async (userData) => {
    setLoading(true);
    try {
      const { user: registeredUser } = await authService.register(userData);
      return { success: true, user: registeredUser };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Authenticates a user and updates the session state.
   * @param {Object} credentials - { email, password }
   */
  const login = async (credentials) => {
    setLoading(true);
    try {
      const { user: loggedInUser } = await authService.login(credentials);
      setUser(loggedInUser);
      return { success: true };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clears the user session and redirects to the login page.
   */
  const logout = () => {
    authService.logout();
    setUser(null);
    navigate("/auth");
  };

  // Context value with state and methods
  const value = {
    user,
    loading,
    register,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to access the authentication context.
 * @throws {Error} If used outside of AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
// end of file
