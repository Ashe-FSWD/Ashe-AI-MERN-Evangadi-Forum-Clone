import axios from "axios";

// Local development uses localhost.
// Production uses the deployed Render backend.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3777"
    : "https://ashe-ai-mern-evangadi-forum-clone.onrender.com");

const apiClient = axios.create({
  baseURL: API_BASE_URL.replace(/\/+$/, ""),
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the JWT token to authenticated requests.
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Handle expired or invalid authentication tokens.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || "";

    const isAuthEndpoint =
      requestUrl.includes("/api/auth/login") ||
      requestUrl.includes("/api/auth/register");

    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/auth";
    }

    return Promise.reject(error);
  },
);

export { apiClient };
