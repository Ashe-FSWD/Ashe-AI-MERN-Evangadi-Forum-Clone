import { apiClient } from "../core/api.client.js";

export const moderationService = {
  async list(filters = {}) {
    const { data } = await apiClient.get("/api/admin/moderation", {
      params: filters,
    });

    return data;
  },

  async getById(id) {
    const { data } = await apiClient.get(`/api/admin/moderation/${id}`);

    return data;
  },

  async review(id, payload) {
    const { data } = await apiClient.patch(
      `/api/admin/moderation/${id}/review`,
      payload,
    );

    return data;
  },
};
