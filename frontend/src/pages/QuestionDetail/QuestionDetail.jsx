/**
 * Question Detail: full thread (question + answers), markdown rendering, an
 * answer form (hidden for the author), and the "AI answer fit" coach.
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Send,
  Sparkles,
  User,
  Clock,
  MessageSquare,
  ArrowLeft,
  CheckCircle2,
  Flag,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Bold,
  Italic,
  Code,
  Link,
  Wand2,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { questionService } from "../../services/question/question.service.js";
import { answerService } from "../../services/answer/answer.service.js";
import { timeAgo, isAuthoredByUser, getErrorMessage } from "../../lib/utils";
import RagAnswerBody from "../../components/RagAnswerBody/RagAnswerBody.jsx";
import QuestionCard from "../../components/QuestionCard/QuestionCard.jsx";
import ui from "../../styles/pageStates.module.css";
import styles from "./QuestionDetail.module.css";

const FIT_LEVEL_LABELS = {
  strong: { label: "Strong fit", className: "fitStrong" },
  partial: { label: "Partial fit", className: "fitPartial" },
  weak: { label: "Weak fit", className: "fitWeak" },
};

export default function QuestionDetail() {
  const { questionHash } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [similarQuestions, setSimilarQuestions] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const [answerText, setAnswerText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState(null);
  const [postSuccess, setPostSuccess] = useState(null);

  const [isFitChecking, setIsFitChecking] = useState(false);
  const [fitResult, setFitResult] = useState(null);
  const [fitError, setFitError] = useState(null);

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState(null);

  const [sharedAnswerId, setSharedAnswerId] = useState(null);

  const answerTextareaRef = useRef(null);

  const [votingId, setVotingId] = useState(null);
  const [voteError, setVoteError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await questionService.getSingleQuestion(questionHash);
        if (!mounted) return;
        setQuestion(result.question || null);
        setAnswers(result.answers || []);
      } catch (err) {
        if (mounted)
          setError(getErrorMessage(err, "Failed to load the question."));
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [questionHash]);

  useEffect(() => {
    let mounted = true;
    const loadSimilar = async () => {
      setSimilarLoading(true);
      try {
        const result = await questionService.getSimilarQuestions(questionHash, {
          k: 5,
        });
        if (!mounted) return;
        setSimilarQuestions(result.data || []);
      } catch (_err) {
        if (!mounted) return;
        setSimilarQuestions([]);
      } finally {
        if (mounted) setSimilarLoading(false);
      }
    };

    loadSimilar();
    return () => {
      mounted = false;
    };
  }, [questionHash]);

  const isOwnQuestion = isAuthoredByUser(question, user);

  const handleCheckFit = async () => {
    const trimmed = answerText.trim();
    if (trimmed.length < 20) {
      setFitError("Answer must be at least 20 characters before checking fit.");
      return;
    }
    setFitError(null);
    setFitResult(null);
    setIsFitChecking(true);
    try {
      const result = await questionService.assessAnswerFit(
        questionHash,
        trimmed,
      );
      setFitResult(result.data);
    } catch (err) {
      setFitError(
        getErrorMessage(err, "AI fit check is unavailable right now."),
      );
    } finally {
      setIsFitChecking(false);
    }
  };

  const handlePostAnswer = async (e) => {
    e.preventDefault();
    const trimmed = answerText.trim();
    if (trimmed.length < 20) {
      setPostError("Answer must be at least 20 characters long.");
      return;
    }

    setPostError(null);
    setPostSuccess(null);
    setIsPosting(true);
    try {
      const result = await answerService.postAnswer(question.id, trimmed);
      if (result.data?.status === "pending_review") {
        setAnswerText("");

        setPostSuccess(
          "Your answer was submitted for Super Admin review. " +
            "It will appear after approval.",
        );

        setIsPosting(false);
        return;
      }
      setAnswers((prev) => [...prev, result.data]);
      setAnswerText("");
      setPostSuccess("Answer posted successfully.");
      setFitResult(null);
      setSuggestError(null);
    } catch (err) {
      setPostError(getErrorMessage(err, "Failed to post the answer."));
    } finally {
      setIsPosting(false);
    }
  };

  const handleCopyThreadLink = async (answerId) => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setSharedAnswerId(answerId);
      window.setTimeout(() => {
        setSharedAnswerId((current) => (current === answerId ? null : current));
      }, 2000);
    } catch (_err) {
      setSharedAnswerId(null);
      setVoteError(
        "Could not copy the link — your browser blocked clipboard access.",
      );
    }
  };

  const handleSuggestAnswer = async () => {
    if (isSuggesting) return;
    setSuggestError(null);
    setFitError(null);
    setFitResult(null);
    setIsSuggesting(true);
    try {
      const result = await questionService.suggestAnswer(
        questionHash,
        answerText,
      );
      const suggestion = result.data?.suggestion;
      if (!suggestion) {
        setSuggestError(
          "The AI returned an empty suggestion — please try again.",
        );
        return;
      }
      setAnswerText(suggestion);
      setPostError(null);
      setPostSuccess(null);
      if (answerTextareaRef.current) answerTextareaRef.current.focus();
    } catch (err) {
      setSuggestError(
        getErrorMessage(err, "AI suggestion is unavailable right now."),
      );
    } finally {
      setIsSuggesting(false);
    }
  };

  const wrapSelection = (prefix, suffix = prefix) => {
    const el = answerTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? answerText.length;
    const end = el.selectionEnd ?? answerText.length;
    const selected = answerText.slice(start, end);
    const body = selected || "selected text";
    const next =
      answerText.slice(0, start) +
      prefix +
      body +
      suffix +
      answerText.slice(end);
    setAnswerText(next);
    setPostError(null);
    setPostSuccess(null);
    window.requestAnimationFrame(() => {
      el.focus();
      const newStart = start + prefix.length;
      el.setSelectionRange(newStart, newStart + body.length);
    });
  };

  const insertLink = () => {
    const el = answerTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? answerText.length;
    const end = el.selectionEnd ?? answerText.length;
    const selected = answerText.slice(start, end).trim();
    const label = selected || "link text";
    const url = window.prompt("Enter the link URL:", "https://");
    if (url === null) return;
    const trimmedUrl = url.trim() || "https://example.com";
    const markdown = `[${label}](${trimmedUrl})`;
    const next = answerText.slice(0, start) + markdown + answerText.slice(end);
    setAnswerText(next);
    setPostError(null);
    setPostSuccess(null);
    window.requestAnimationFrame(() => {
      el.focus();
      const newStart = start + markdown.length;
      el.setSelectionRange(newStart, newStart);
    });
  };

  const fitConfig = fitResult
    ? FIT_LEVEL_LABELS[fitResult.level] || FIT_LEVEL_LABELS.partial
    : null;

  const handleVote = async (answer, vote) => {
    if (votingId) return;

    // Clicking the same button again revokes the vote.
    const nextVote = answer.myVote === vote ? 0 : vote;

    setVoteError(null);
    setVotingId(answer.id);
    try {
      const result = await answerService.voteAnswer(answer.id, nextVote);
      setAnswers((prev) =>
        prev.map((a) =>
          a.id === answer.id
            ? {
                ...a,
                voteCount: result.data.voteCount,
                upVotes: result.data.upVotes,
                downVotes: result.data.downVotes,
                myVote: result.data.myVote,
              }
            : a,
        ),
      );
    } catch (err) {
      setVoteError(getErrorMessage(err, "Failed to update vote."));
    } finally {
      setVotingId(null);
    }
  };

  return (
    <div className={styles.questionDetail}>
      <button
        type="button"
        className={styles.questionDetailBack}
        onClick={() => navigate("/dashboard")}
      >
        <ArrowLeft size={16} aria-hidden />
        Back to questions
      </button>

      {isLoading && (
        <div
          className={`${ui.pageStates__message}${ui["pageStates__message--loading"]}`}
          role="status"
        >
          <div className={styles.questionDetailSpinner} aria-hidden />
          Loading thread…
        </div>
      )}

      {!isLoading && error && (
        <div
          className={`${ui.pageStates__message}${ui["pageStates__message--error"]}`}
          role="alert"
        >
          <div className={styles.questionDetailErrorInner}>
            <AlertCircle size={18} aria-hidden />
            <span>{error}</span>
          </div>
        </div>
      )}

      {!isLoading && !error && question && (
        <div className={styles.questionDetailLayout}>
          <div className={styles.questionDetailMain}>
            <article className={styles.questionDetailCard}>
              <div className={styles.questionDetailHeader}>
                <div className={styles.questionDetailMeta}>
                  <span className={styles.questionDetailMetaItem}>
                    <User size={14} aria-hidden />
                    {question.author?.firstName} {question.author?.lastName}
                  </span>
                  {question.createdAt && (
                    <span className={styles.questionDetailMetaItem}>
                      <Clock size={14} aria-hidden />
                      {timeAgo(question.createdAt)}
                    </span>
                  )}
                  <span className={styles.questionDetailMetaItem}>
                    <MessageSquare size={14} aria-hidden />
                    {question.answerCount ?? answers.length}{" "}
                    {(question.answerCount ?? answers.length) === 1
                      ? "answer"
                      : "answers"}
                  </span>
                </div>

                {isOwnQuestion && (
                  <span className={styles.questionDetailOwnBadge}>
                    <Flag size={13} aria-hidden />
                    Your question
                  </span>
                )}
              </div>

              <h2 className={styles.questionDetailTitle}>{question.title}</h2>

              <div className={styles.questionDetailBody}>
                <RagAnswerBody>{question.content}</RagAnswerBody>
              </div>
            </article>

            <section className={styles.questionDetailSection}>
              <h3 className={styles.questionDetailSectionTitle}>
                Answers ({answers.length})
              </h3>

              {answers.length === 0 && (
                <p className={styles.noAnswersHint}>
                  No answers yet. If you can help, post the first one below.
                </p>
              )}

              <div className={styles.questionDetailAnswers}>
                {answers.map((answer) => (
                  <article key={answer.id} className={styles.answerCard}>
                    <div className={styles.answerCardMeta}>
                      <span className={styles.answerCardAuthor}>
                        {answer.author?.firstName} {answer.author?.lastName}
                      </span>
                      {answer.createdAt && (
                        <span className={styles.answerCardTime}>
                          {timeAgo(answer.createdAt)}
                        </span>
                      )}
                      {answer.aiGrade && (
                        <span
                          className={`${styles.answerGrade}${
                            styles[`answerGrade${answer.aiGrade}`]
                          }`}
                          title="Gemini AI recommendation"
                        >
                          <Sparkles size={12} aria-hidden />
                          Gemini: {answer.aiGrade}
                        </span>
                      )}
                    </div>
                    <div className={styles.answerCardBody}>
                      <RagAnswerBody>{answer.content}</RagAnswerBody>
                    </div>
                    <div className={styles.answerCardVotes}>
                      <button
                        type="button"
                        className={styles.answerShareButton}
                        onClick={() => handleCopyThreadLink(answer.id)}
                        title="Copy link to this thread"
                        aria-label="Copy link to this thread"
                      >
                        {sharedAnswerId === answer.id ? (
                          <CheckCircle2 size={15} aria-hidden />
                        ) : (
                          <Share2 size={15} aria-hidden />
                        )}
                        <span>
                          {sharedAnswerId === answer.id ? "Copied!" : "Share"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.voteButton}${
                          answer.myVote === 1
                            ? styles.voteButtonActiveUp
                            : styles.voteButtonUp
                        }`}
                        onClick={() => handleVote(answer, 1)}
                        disabled={votingId === answer.id}
                        title="Upvote"
                        aria-label="Upvote answer"
                        aria-pressed={answer.myVote === 1}
                      >
                        <ThumbsUp size={15} aria-hidden />
                        <span className={styles.voteCount}>
                          {answer.upVotes ?? 0}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.voteButton}${
                          answer.myVote === -1
                            ? styles.voteButtonActiveDown
                            : styles.voteButtonDown
                        }`}
                        onClick={() => handleVote(answer, -1)}
                        disabled={votingId === answer.id}
                        title="Downvote"
                        aria-label="Downvote answer"
                        aria-pressed={answer.myVote === -1}
                      >
                        <ThumbsDown size={15} aria-hidden />
                        <span className={styles.voteCount}>
                          {answer.downVotes ?? 0}
                        </span>
                      </button>
                    </div>
                    {voteError && (
                      <div className={styles.voteError} role="alert">
                        <AlertCircle size={14} aria-hidden />
                        <span>{voteError}</span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>

            {!isOwnQuestion && (
              <section className={styles.questionDetailSection}>
                <h3 className={styles.questionDetailSectionTitle}>
                  Post an answer
                </h3>
                <form className={styles.answerForm} onSubmit={handlePostAnswer}>
                  <div
                    className={styles.answerFormToolbar}
                    role="toolbar"
                    aria-label="Formatting tools"
                  >
                    <button
                      type="button"
                      className={styles.answerFormTool}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => wrapSelection("**")}
                      title="Bold"
                      aria-label="Bold"
                    >
                      <Bold size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={styles.answerFormTool}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => wrapSelection("*")}
                      title="Italic"
                      aria-label="Italic"
                    >
                      <Italic size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={styles.answerFormTool}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => wrapSelection("`")}
                      title="Inline code"
                      aria-label="Inline code"
                    >
                      <Code size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={styles.answerFormTool}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={insertLink}
                      title="Insert link"
                      aria-label="Insert link"
                    >
                      <Link size={16} aria-hidden />
                    </button>
                  </div>

                  <textarea
                    ref={answerTextareaRef}
                    className={styles.answerFormTextarea}
                    placeholder="Write a helpful answer (min 20 characters)… Markdown is supported."
                    value={answerText}
                    onChange={(e) => {
                      setAnswerText(e.target.value);
                      setPostError(null);
                      setPostSuccess(null);
                      setFitResult(null);
                      setSuggestError(null);
                    }}
                    rows={7}
                  />

                  {postError && (
                    <div className={styles.answerFormError} role="alert">
                      <AlertCircle size={16} aria-hidden />
                      <span>{postError}</span>
                    </div>
                  )}

                  {postSuccess && (
                    <div className={styles.answerFormSuccess} role="status">
                      <CheckCircle2 size={16} aria-hidden />
                      <span>{postSuccess}</span>
                    </div>
                  )}

                  {fitError && (
                    <div className={styles.answerFormError} role="alert">
                      <AlertCircle size={16} aria-hidden />
                      <span>{fitError}</span>
                    </div>
                  )}

                  {suggestError && (
                    <div className={styles.answerFormError} role="alert">
                      <AlertCircle size={16} aria-hidden />
                      <span>{suggestError}</span>
                    </div>
                  )}

                  <div className={styles.answerFormActions}>
                    <button
                      type="button"
                      className={styles.answerFormSuggest}
                      onClick={handleSuggestAnswer}
                      disabled={isSuggesting || isPosting}
                    >
                      {isSuggesting ? (
                        <>
                          <span
                            className={styles.answerFormSpinner}
                            aria-hidden
                          />
                          Generating…
                        </>
                      ) : (
                        <>
                          <Wand2 size={16} aria-hidden />
                          Add AI suggestion
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className={styles.answerFormFit}
                      onClick={handleCheckFit}
                      disabled={isFitChecking || isPosting || isSuggesting}
                    >
                      {isFitChecking ? (
                        <>
                          <span
                            className={styles.answerFormSpinner}
                            aria-hidden
                          />
                          Checking fit…
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} aria-hidden />
                          Check answer fit
                        </>
                      )}
                    </button>

                    <button
                      type="submit"
                      className={styles.answerFormSubmit}
                      disabled={isPosting || isFitChecking || isSuggesting}
                    >
                      {isPosting ? "Posting…" : "Post answer"}
                      {!isPosting && <Send size={16} aria-hidden />}
                    </button>
                  </div>
                </form>

                {fitResult && fitConfig && (
                  <div
                    className={`${styles.fitPanel} ${styles[fitConfig.className]}`}
                    role="status"
                  >
                    <div className={styles.fitPanelHeader}>
                      <Sparkles size={16} aria-hidden />
                      <span className={styles.fitPanelLevel}>
                        {fitConfig.label}
                      </span>
                    </div>
                    {fitResult.note && (
                      <p className={styles.fitPanelNote}>{fitResult.note}</p>
                    )}
                  </div>
                )}
              </section>
            )}

            {isOwnQuestion && (
              <div
                className={`${ui.pageStates__message} ${ui["pageStates__message--empty"]}`}
              >
                <p>This is your question — you can't answer your own thread.</p>
              </div>
            )}
          </div>

          <aside
            className={styles.questionDetailSidebar}
            aria-label="Related questions"
          >
            <div className={styles.questionDetailSidebarBox}>
              <h3 className={styles.questionDetailSidebarTitle}>
                Related questions
              </h3>

              {similarLoading && (
                <p className={styles.questionDetailSidebarHint}>
                  Loading related questions…
                </p>
              )}

              {!similarLoading && similarQuestions.length === 0 && (
                <p className={styles.questionDetailSidebarHint}>
                  No related questions found yet.
                </p>
              )}

              {!similarLoading && similarQuestions.length > 0 && (
                <div className={styles.questionDetailSidebarList}>
                  {similarQuestions.map((similar) => (
                    <QuestionCard key={similar.id} question={similar} />
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
