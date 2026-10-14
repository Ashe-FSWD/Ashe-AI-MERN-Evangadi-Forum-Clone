import { useEffect, useState } from "react";
import { moderationService } from "../../services/moderation/moderation.service.js";
import styles from "./SuperAdminModeration.module.css";

const initialReview = {
  status: "dismissed",
  action: "none",
  reviewNote: "",
};

export default function SuperAdminModeration() {
  const [reports, setReports] = useState([]);
  const [filters, setFilters] = useState({
    status: "pending",
    category: "",
    contentType: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewingId, setReviewingId] = useState(null);
  const [review, setReview] = useState(initialReview);

  const loadReports = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await moderationService.list(filters);
      setReports(result.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load moderation reports.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [filters.status, filters.category, filters.contentType]);

  const submitReview = async (id) => {
    try {
      await moderationService.review(id, review);
      setReviewingId(null);
      setReview(initialReview);
      await loadReports();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to review report.",
      );
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>AI Content Moderation</h1>
          <p>Review AI-assisted classifications for questions and answers.</p>
        </div>
        <div className={styles.info}>
          <strong>Important:</strong> Political content is not automatically
          harmful. AI flags content for review; the Super Admin makes the final
          decision.
        </div>
      </header>

      <section className={styles.filters}>
        <select
          value={filters.status}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, status: e.target.value }))
          }
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="dismissed">Dismissed</option>
          <option value="action_taken">Action taken</option>
        </select>

        <select
          value={filters.category}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, category: e.target.value }))
          }
        >
          <option value="">All categories</option>
          <option value="political">Political</option>
          <option value="hate">Hate</option>
          <option value="threat">Threat</option>
          <option value="harassment">Harassment</option>
          <option value="other">Other</option>
        </select>

        <select
          value={filters.contentType}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, contentType: e.target.value }))
          }
        >
          <option value="">Questions + Answers</option>
          <option value="question">Questions</option>
          <option value="answer">Answers</option>
        </select>
      </section>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p>Loading moderation reports…</p>
      ) : reports.length === 0 ? (
        <p className={styles.empty}>No moderation reports found.</p>
      ) : (
        <section className={styles.list}>
          {reports.map((report) => {
            const authorFirstName =
              report.authorFirstName || report.firstName || "Unknown";
            const authorLastName =
              report.authorLastName || report.lastName || "";
            const authorEmail = report.authorEmail || report.email || "N/A";
            const violationCount =
              report.authorViolationCount ?? report.violationCount ?? 0;
            const isBanned =
              Number(report.authorIsBanned ?? report.isBanned ?? 0) === 1;

            return (
              <article key={report.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span>
                    {report.contentType} #{report.contentId}
                  </span>
                  <strong>{report.category}</strong>
                  <span>{report.severity}</span>
                  <span>{report.status}</span>
                </div>

                {/* Author Information Container */}
                <div className={styles.authorInfo}>
                  <span>
                    <strong>Author:</strong> {authorFirstName} {authorLastName}{" "}
                    ({authorEmail})
                  </span>
                  <span>
                    {" · "}
                    <strong>Violations:</strong> {violationCount} / 3
                  </span>
                  {isBanned && (
                    <span className={styles.bannedBadge}>
                      {" · "}
                      <strong>BANNED</strong>
                    </span>
                  )}
                </div>

                {report.questionTitle && <h2>{report.questionTitle}</h2>}

                <p className={styles.reason}>{report.reason}</p>

                <div className={styles.content}>
                  {report.content || "Original content is no longer available."}
                </div>

                {report.status === "pending" && (
                  <>
                    {reviewingId === report.id ? (
                      <div className={styles.reviewBox}>
                        <select
                          value={review.status}
                          onChange={(e) =>
                            setReview((prev) => ({
                              ...prev,
                              status: e.target.value,
                            }))
                          }
                        >
                          <option value="reviewed">Approve / Publish</option>
                          <option value="dismissed">Dismiss / Allow</option>
                          <option value="action_taken">
                            Confirm Violation
                          </option>
                        </select>

                        <select
                          value={review.action}
                          onChange={(e) =>
                            setReview((prev) => ({
                              ...prev,
                              action: e.target.value,
                            }))
                          }
                        >
                          <option value="none">No content action</option>
                          <option value="hide">Hide content</option>
                          <option value="remove">
                            Reject / Remove from forum
                          </option>
                        </select>

                        <textarea
                          value={review.reviewNote}
                          onChange={(e) =>
                            setReview((prev) => ({
                              ...prev,
                              reviewNote: e.target.value,
                            }))
                          }
                          placeholder="Review note (optional)"
                          rows={3}
                        />

                        <div className={styles.actions}>
                          <button onClick={() => submitReview(report.id)}>
                            Save review
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReviewingId(null);
                              setReview(initialReview);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReviewingId(report.id)}
                      >
                        Review
                      </button>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
