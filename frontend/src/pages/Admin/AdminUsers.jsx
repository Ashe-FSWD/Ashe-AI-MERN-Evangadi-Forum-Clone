/**
 * Admin Users: view all accounts, promote/demote, activate/deactivate, or delete.
 */
import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Shield,
  ShieldOff,
  Power,
  PowerOff,
  Trash2,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { adminService } from "../../services/admin/admin.service.js";
import { getErrorMessage } from "../../lib/utils";
import ui from "../../styles/pageStates.module.css";
import styles from "./Admin.module.css";

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const isSuperAdmin = user?.role === "super-admin";

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminService.getUsers();
      setUsers(data || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load users."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const handleRole = async (target, nextRole) => {
    if (target.id === user?.id) return;
    setBusyId(target.id);
    try {
      await adminService.updateUserRole(target.id, nextRole);
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update role."));
    } finally {
      setBusyId(null);
    }
  };

  const handleStatus = async (target, nextActive) => {
    if (target.id === user?.id) return;
    setBusyId(target.id);
    try {
      await adminService.updateUserStatus(target.id, nextActive);
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update status."));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (target) => {
    if (target.id === user?.id) return;
    const ok = window.confirm(
      `Delete ${target.firstName} ${target.lastName} (${target.email})? Their questions, answers and documents will be removed too.`,
    );
    if (!ok) return;

    setBusyId(target.id);
    try {
      await adminService.deleteUser(target.id);
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete user."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={styles.admin}>
      <div className={styles.adminHeader}>
        <h3 className={styles.adminTitle}>Manage Users</h3>
        <p className={styles.adminSubtitle}>
          All registered accounts. You can promote, activate, deactivate, or
          manage users.
        </p>
      </div>

      {isLoading && (
        <div
          className={`${ui.pageStates__message} ${ui["pageStates__message--loading"]}`}
          role="status"
        >
          Loading users…
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

      {!isLoading && !error && users.length === 0 && (
        <div
          className={`${ui.pageStates__message} ${ui["pageStates__message--empty"]}`}
        >
          <Inbox size={24} aria-hidden />
          <span>No users registered yet.</span>
        </div>
      )}

      {!isLoading && !error && users.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Content</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = String(u.id) === String(user?.id);
                const busy = busyId === u.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <span className={styles.cellPrimary}>
                        {u.firstName} {u.lastName}
                        {isSelf && " (you)"}
                      </span>
                    </td>
                    <td>
                      <span className={styles.cellMuted}>{u.email}</span>
                    </td>
                    <td>
                      <span
                        className={`${styles.pill} ${
                          u.role === "super-admin"
                            ? styles.pillSuperAdmin
                            : u.role === "admin"
                              ? styles.pillAdmin
                              : styles.pillUser
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`${styles.pill} ${
                          u.isActive ? styles.pillActive : styles.pillInactive
                        }`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <span className={styles.cellMuted}>
                        {u.questionCount} Q / {u.answerCount} A /{" "}
                        {u.documentCount} D
                      </span>
                    </td>
                    <td>
                      <span className={styles.cellMuted}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <div className={styles.cellActions}>
                        {/* Promote: Available for regular users (Admins & Super-Admins can promote) */}
                        {u.role === "user" && (
                          <button
                            type="button"
                            className={styles.btn}
                            disabled={busy || isSelf}
                            onClick={() => handleRole(u, "admin")}
                            title="Promote to admin"
                          >
                            <Shield size={14} aria-hidden />
                            Promote
                          </button>
                        )}

                        {/* Demote: ONLY for Super-Admins */}
                        {isSuperAdmin &&
                          (u.role === "admin" || u.role === "super-admin") && (
                            <button
                              type="button"
                              className={styles.btn}
                              disabled={busy || isSelf}
                              onClick={() => handleRole(u, "user")}
                              title="Demote to user"
                            >
                              <ShieldOff size={14} aria-hidden />
                              Demote
                            </button>
                          )}

                        {/* Activate / Deactivate: Available for BOTH Admin and Super-Admin */}
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy || isSelf}
                          onClick={() => handleStatus(u, !u.isActive)}
                          title={u.isActive ? "Deactivate" : "Activate"}
                        >
                          {u.isActive ? (
                            <PowerOff size={14} aria-hidden />
                          ) : (
                            <Power size={14} aria-hidden />
                          )}
                          {u.isActive ? "Deactivate" : "Activate"}
                        </button>

                        {/* Delete: ONLY for Super-Admins */}
                        {isSuperAdmin && (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnDanger}`}
                            disabled={busy || isSelf}
                            onClick={() => handleDelete(u)}
                            title="Delete user"
                          >
                            <Trash2 size={14} aria-hidden />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
