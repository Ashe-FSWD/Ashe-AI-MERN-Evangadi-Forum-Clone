/**
 * Post Question: ask a new question with an optional AI draft coach.
 * The coach runs `POST /api/questions/draft-coach`, creation runs
 * `POST /api/questions` and redirects to the new thread or displays a
 * moderation pending message.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Send,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  PenSquare,
} from "lucide-react";
import { questionService } from "../../services/question/question.service.js";
import { getErrorMessage } from "../../lib/utils";
import styles from "./PostQuestion.module.css";

export default function PostQuestion() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ title: "", content: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCoaching, setIsCoaching] = useState(false);
  const [coachFeedback, setCoachFeedback] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  const validateForm = () => {
    const title = formData.title.trim();
    const content = formData.content.trim();

    if (title.length < 5) {
      return "Title must be at least 5 characters long.";
    }
    if (content.length < 10) {
      return "Content must be at least 10 characters long.";
    }
    return null;
  };

  const handleCoach = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setCoachFeedback(null);
    setIsCoaching(true);
    try {
      const result = await questionService.generateQuestionDraftCoach({
        title: formData.title.trim(),
        content: formData.content.trim(),
      });
      setCoachFeedback(result.data);
    } catch (err) {
      setError(getErrorMessage(err, "AI coach is unavailable right now."));
    } finally {
      setIsCoaching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      const result = await questionService.createQuestion({
        title: formData.title.trim(),
        content: formData.content.trim(),
      });

      if (result.data?.status === "pending_review") {
        setSuccess(
          "Your question was submitted for Super Admin review. " +
            "It will appear in the forum after approval.",
        );

        setFormData({
          title: "",
          content: "",
        });

        setIsSubmitting(false);
        return;
      }

      setSuccess("Question posted successfully.");
      const hash = result.data?.questionHash;
      navigate(hash ? `/questions/${hash}` : "/dashboard", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to post the question."));
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.postQuestion}>
      <div className={styles.postQuestionIntro}>
        <h3 className={styles.postQuestionTitle}>Ask a clear question</h3>
        <p className={styles.postQuestionSubtitle}>
          Include your environment, error messages, and what you already tried.
          Peers can then help you in one pass.
        </p>
      </div>

      <form className={styles.postQuestionForm} onSubmit={handleSubmit}>
        <div className={styles.postQuestionField}>
          <label htmlFor="questionTitle" className={styles.postQuestionLabel}>
            Title
          </label>
          <input
            id="questionTitle"
            type="text"
            className={styles.postQuestionInput}
            placeholder="e.g. How do I connect React to Express?"
            value={formData.title}
            onChange={(e) => handleChange("title", e.target.value)}
            maxLength={255}
          />
          <p className={styles.postQuestionHint}>
            5–255 characters. A specific title gets faster answers.
          </p>
        </div>

        <div className={styles.postQuestionField}>
          <label htmlFor="questionContent" className={styles.postQuestionLabel}>
            Details
          </label>
          <textarea
            id="questionContent"
            className={styles.postQuestionTextarea}
            placeholder="Describe the problem, paste the relevant code, include error messages and what you have tried…"
            value={formData.content}
            onChange={(e) => handleChange("content", e.target.value)}
            rows={10}
          />
          <p className={styles.postQuestionHint}>
            At least 10 characters. Markdown and code blocks are supported.
          </p>
        </div>

        {error && (
          <div className={styles.postQuestionError} role="alert">
            <AlertCircle size={16} aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className={styles.postQuestionSuccess} role="status">
            <CheckCircle2 size={16} aria-hidden />
            <span>{success}</span>
          </div>
        )}

        <div className={styles.postQuestionActions}>
          <button
            type="button"
            className={styles.postQuestionCoach}
            onClick={handleCoach}
            disabled={isCoaching || isSubmitting}
          >
            {isCoaching ? (
              <>
                <span className={styles.postQuestionSpinner} aria-hidden />
                Coaching…
              </>
            ) : (
              <>
                <Sparkles size={16} aria-hidden />
                Get AI feedback
              </>
            )}
          </button>

          <button
            type="submit"
            className={styles.postQuestionSubmit}
            disabled={isSubmitting || isCoaching}
          >
            {isSubmitting ? "Posting…" : "Post question"}
            {!isSubmitting && <Send size={16} aria-hidden />}
          </button>
        </div>
      </form>

      {coachFeedback && (
        <div className={styles.postQuestionCoachPanel} role="status">
          <div className={styles.postQuestionCoachHeader}>
            <span className={styles.postQuestionCoachIcon} aria-hidden>
              <Lightbulb size={16} />
            </span>
            <h4 className={styles.postQuestionCoachTitle}>AI draft coach</h4>
          </div>

          {coachFeedback.feedback && (
            <p className={styles.postQuestionCoachFeedback}>
              {coachFeedback.feedback}
            </p>
          )}

          {Array.isArray(coachFeedback.tips) &&
            coachFeedback.tips.length > 0 && (
              <ul className={styles.postQuestionCoachTips}>
                {coachFeedback.tips.map((tip, index) => (
                  <li key={index} className={styles.postQuestionCoachTip}>
                    <PenSquare size={14} aria-hidden />
                    {tip}
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
    </div>
  );
}
