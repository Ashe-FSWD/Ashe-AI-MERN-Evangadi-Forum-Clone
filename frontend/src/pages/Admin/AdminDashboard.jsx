/**
 * Admin Dashboard: site-wide stats and recent activity.
 */
import { useState, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  Users,
  MessageSquare,
  MessageCircle,
  FileText,
  Shield,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { adminService } from "../../services/admin/admin.service.js";
import { getErrorMessage } from "../../lib/utils";
import ui from "../../styles/pageStates.module.css";
import styles from "./Admin.module.css";

const NAV = [
  { to: "/admin/users", label: "Manage Users", icon: Users },
  { to: "/admin/questions", label: "Manage Questions", icon: MessageSquare },
  { to: "/admin/answers", label: "Manage Answers", icon: MessageCircle },
  { to: "/admin/documents", label: "Manage Documents", icon: FileText },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await adminService.getStats();
        if (mounted) setStats(data);
      } catch (err) {
        if (mounted) setError(getErrorMessage(err, "Failed to load stats."));
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // if (user?.role !== "admin") {
  //   return <Navigate to="/dashboard" replace />;
  // }
  if (!["admin", "super-admin"].includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const cards = stats?.counts
    ? [
        {
          key: "users",
          label: "Users",
          icon: Users,
          count: stats.counts.users,
          className: styles.statIconUsers,
        },
        {
          key: "questions",
          label: "Questions",
          icon: MessageSquare,
          count: stats.counts.questions,
          className: styles.statIconQuestions,
        },
        {
          key: "answers",
          label: "Answers",
          icon: MessageCircle,
          count: stats.counts.answers,
          className: styles.statIconAnswers,
        },
        {
          key: "documents",
          label: "Documents",
          icon: FileText,
          count: stats.counts.documents,
          className: styles.statIconDocuments,
        },
      ]
    : [];

  return (
    <div className={styles.admin}>
      <div className={styles.adminHeader}>
        <h3 className={styles.adminTitle}>
          <Shield
            size={20}
            style={{ verticalAlign: -3, marginRight: 6 }}
            aria-hidden
          />
          Admin Dashboard
        </h3>
        <p className={styles.adminSubtitle}>
          Site-wide overview and moderation tools for the Evangadi Forum.
        </p>
      </div>

      <nav className={styles.adminNav}>
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className={styles.adminNavLink}>
              <Icon size={16} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {isLoading && (
        <div
          className={`${ui.pageStates__message} ${ui["pageStates__message--loading"]}`}
          role="status"
        >
          Loading stats…
        </div>
      )}

      {!isLoading && error && (
        <div
          className={`${ui.pageStates__message} ${ui["pageStates__message--error"]}`}
          role="alert"
        >
          <AlertCircle size={18} aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {!isLoading && !error && stats && (
        <>
          <div className={styles.statsGrid}>
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.key} className={styles.statCard}>
                  <div className={`${styles.statIcon} ${card.className}`}>
                    <Icon size={20} aria-hidden />
                  </div>
                  <div>
                    <p className={styles.statValue}>{card.count}</p>
                    <p className={styles.statLabel}>{card.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.recentCard}>
            <p className={styles.recentTitle}>Recent Activity</p>
            {stats.recentActivity?.length ? (
              <div className={styles.recentList}>
                {stats.recentActivity.map((activity) => (
                  <div
                    key={`${activity.type}-${activity.id}`}
                    className={styles.recentItem}
                  >
                    <span
                      className={`${styles.recentBadge} ${
                        activity.type === "question"
                          ? styles.badgeQuestion
                          : styles.badgeAnswer
                      }`}
                    >
                      {activity.type}
                    </span>
                    <span className={styles.recentText}>
                      {activity.label || activity.title || "New activity"} —{" "}
                      {activity.first_name} {activity.last_name}
                    </span>
                    <span className={styles.recentTime}>
                      {new Date(activity.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={`${ui.pageStates__message} ${ui["pageStates__message--empty"]}`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Inbox size={20} aria-hidden />
                  <span>No recent activity yet.</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
