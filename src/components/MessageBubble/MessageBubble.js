"use client";

import { useMemo, useState } from "react";
import { parseAIMessage } from "@/utils/parseAIMessage";
import styles from "./MessageBubble.module.css";

const isTestEnv = typeof window !== "undefined" && localStorage.getItem("dashboardEnv") === "test";
const N8N_EXECUTION_BASE_URL = isTestEnv
  ? "https://n8n-testing.plumcut.com/workflow/DvQnmrtHLO4UPMuP/executions"
  : "https://n8n.plumcut.com/workflow/OCYvieDL6GMoxbYuM06ml/executions";
const PRODUCTION_BUG_REPORTERS = new Set(["charbel", "nour", "michael"]);
const URL_PATTERN = /https?:\/\/[^\s<>"')]+/gi;
const TWILIO_MEDIA_PATH_PATTERN = /^\/2010-04-01\/Accounts\/[^/]+\/Messages\/[^/]+\/Media\/[^/?#]+\/?$/i;
const GOOGLE_DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif", "heic", "heif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "ogg", "ogv"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "ogg", "oga", "opus", "webm"]);

function formatTimestamp(datetime) {
  const date = new Date(datetime);
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  }

  const includeYear = date.getFullYear() !== now.getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function toText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function cleanupUrl(rawUrl) {
  return String(rawUrl || "").replace(/[),.;!?]+$/g, "");
}

function extractUrls(content) {
  const matches = String(content || "").match(URL_PATTERN) || [];
  const deduped = [];

  matches.forEach((match) => {
    const cleaned = cleanupUrl(match);
    if (cleaned && !deduped.includes(cleaned)) {
      deduped.push(cleaned);
    }
  });

  return deduped;
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function detectMediaTypeFromExtension(url) {
  const parsedUrl = parseUrl(url);
  if (!parsedUrl) {
    return null;
  }

  const pathname = parsedUrl.pathname.toLowerCase();
  const extension = pathname.includes(".") ? pathname.split(".").pop() : "";
  if (!extension) {
    return null;
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }
  if (AUDIO_EXTENSIONS.has(extension)) {
    return "audio";
  }
  return null;
}

function getGoogleDriveFileId(url) {
  const parsedUrl = parseUrl(url);
  if (!parsedUrl) {
    return null;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (!GOOGLE_DRIVE_HOSTS.has(hostname)) {
    return null;
  }

  const fileIdFromQuery = parsedUrl.searchParams.get("id");
  if (fileIdFromQuery) {
    return fileIdFromQuery;
  }

  const filePathMatch = parsedUrl.pathname.match(/\/file\/d\/([^/]+)/i);
  if (filePathMatch?.[1]) {
    return filePathMatch[1];
  }

  return null;
}

function getGoogleDriveImageUrls(fileId) {
  const encodedId = encodeURIComponent(fileId);
  return [
    `https://drive.google.com/thumbnail?id=${encodedId}&sz=w2000`,
    `https://drive.google.com/uc?export=download&id=${encodedId}`,
    `https://drive.google.com/uc?export=view&id=${encodedId}`,
  ];
}

function isGoogleDriveFileUrl(url) {
  return Boolean(getGoogleDriveFileId(url));
}

function isTwilioMediaUrl(url) {
  const parsedUrl = parseUrl(url);
  if (!parsedUrl) {
    return false;
  }

  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname.toLowerCase() !== "api.twilio.com") {
    return false;
  }

  return TWILIO_MEDIA_PATH_PATTERN.test(parsedUrl.pathname);
}

function extractMediaUrls(content) {
  return extractUrls(content).filter(
    (url) => isGoogleDriveFileUrl(url) || isTwilioMediaUrl(url) || Boolean(detectMediaTypeFromExtension(url))
  );
}

function stripMediaUrls(content) {
  const text = String(content || "");
  const mediaUrls = extractMediaUrls(text);
  if (mediaUrls.length === 0) {
    return text;
  }

  const withoutUrls = mediaUrls.reduce((current, mediaUrl) => current.split(mediaUrl).join(""), text);
  return withoutUrls.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function formatToolCall(toolCall) {
  const name = toolCall?.name || "unknown_tool";
  const argsText = toText(toolCall?.args || {});
  return `name: '${name}'\nargs: ${argsText}`;
}

function ChevronIcon({ expanded }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={expanded ? styles.chevronExpanded : ""}>
      <path
        d="M7 10l5 5 5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapsibleMessageText({ content, hasMedia }) {
  const normalizedContent = String(content || "").trim();
  const [isExpanded, setIsExpanded] = useState(!hasMedia);

  if (!normalizedContent) {
    return null;
  }

  if (!hasMedia) {
    return normalizedContent;
  }

  return (
    <div className={styles.collapsibleTextWrap}>
      <button
        type="button"
        className={styles.contentToggle}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span>{isExpanded ? "Hide text" : "Show text"}</span>
        <ChevronIcon expanded={isExpanded} />
      </button>
      {isExpanded && <div className={styles.collapsibleText}>{normalizedContent}</div>}
    </div>
  );
}

function MediaAttachment({ url }) {
  const googleDriveFileId = getGoogleDriveFileId(url);
  const isGoogleDriveUrl = Boolean(googleDriveFileId);
  const googleDriveImageCandidates = useMemo(
    () => (googleDriveFileId ? getGoogleDriveImageUrls(googleDriveFileId) : []),
    [googleDriveFileId]
  );
  const mediaSrc = url;
  const isTwilioUrl = isTwilioMediaUrl(url);
  const detectedMediaType = isGoogleDriveUrl ? "image" : detectMediaTypeFromExtension(url);
  const mediaRenderOrder = useMemo(() => {
    if (isGoogleDriveUrl) {
      return ["image"];
    }

    if (detectedMediaType) {
      const ordered = [detectedMediaType];
      ["image", "video", "audio"].forEach((candidate) => {
        if (candidate !== detectedMediaType) {
          ordered.push(candidate);
        }
      });
      return ordered;
    }

    if (isTwilioUrl) {
      return ["image", "video", "audio"];
    }

    return [];
  }, [detectedMediaType, isGoogleDriveUrl, isTwilioUrl]);
  const [renderAttemptIndex, setRenderAttemptIndex] = useState(0);
  const [googleDriveAttemptIndex, setGoogleDriveAttemptIndex] = useState(0);
  const mediaType = mediaRenderOrder[renderAttemptIndex] || null;
  const mediaImageSrc =
    isGoogleDriveUrl && googleDriveImageCandidates.length > 0
      ? googleDriveImageCandidates[Math.min(googleDriveAttemptIndex, googleDriveImageCandidates.length - 1)]
      : mediaSrc;
  const handleMediaError = () => {
    if (isGoogleDriveUrl && mediaType === "image" && googleDriveAttemptIndex < googleDriveImageCandidates.length - 1) {
      setGoogleDriveAttemptIndex((current) => current + 1);
      return;
    }
    setRenderAttemptIndex((current) => current + 1);
  };

  if (mediaType === "image") {
    return (
      <img
        className={styles.mediaImage}
        src={mediaImageSrc}
        alt="Chat attachment"
        loading="lazy"
        onError={handleMediaError}
      />
    );
  }

  if (mediaType === "video") {
    return <video className={styles.mediaVideo} src={mediaSrc} controls preload="metadata" onError={handleMediaError} />;
  }

  if (mediaType === "audio") {
    return <audio className={styles.mediaAudio} src={mediaSrc} controls preload="none" onError={handleMediaError} />;
  }

  return (
    <a className={styles.mediaLink} href={url} target="_blank" rel="noreferrer">
      Open attachment
    </a>
  );
}

function MediaAttachments({ content, extraUrls, messageKey }) {
  const mediaUrls = useMemo(() => {
    const fromContent = extractMediaUrls(String(content || ""));
    const combined = [...fromContent];

    (extraUrls || []).forEach((url) => {
      if (typeof url === "string" && url.trim() && !combined.includes(url)) {
        combined.push(url);
      }
    });

    return combined;
  }, [content, extraUrls]);

  if (mediaUrls.length === 0) {
    return null;
  }

  return (
    <div className={styles.mediaList}>
      {mediaUrls.map((url, index) => (
        <MediaAttachment key={`${messageKey}-${index}-${url}`} url={url} />
      ))}
    </div>
  );
}

export default function MessageBubble({ message, clientName = "", userId = "", reportExecutionId = "" }) {
  const type = message?.type;
  const datetime = message?.datetime;
  const data = message?.data || {};
  const executionId = message?.execution_id || null;
  const normalizedReportExecutionId = String(reportExecutionId || "").trim();
  const effectiveReportExecutionId = normalizedReportExecutionId || executionId || "";
  const [isToolExpanded, setIsToolExpanded] = useState(false);
  const [bugStatus, setBugStatus] = useState(null);
  const bugReportingContext = useMemo(() => {
    if (typeof window === "undefined") {
      return { canReport: false, reviewerName: "" };
    }

    const dashboardEnv = String(window.localStorage.getItem("dashboardEnv") || "production")
      .trim()
      .toLowerCase();
    const reviewerName = String(window.localStorage.getItem("reviewerName") || "")
      .trim()
      .toLowerCase();

    return {
      canReport: dashboardEnv === "production" && PRODUCTION_BUG_REPORTERS.has(reviewerName),
      reviewerName,
    };
  }, []);

  if (!type || !datetime) {
    return null;
  }

  const timeLabel = formatTimestamp(datetime);

  if (type === "human") {
    const humanContent = toText(data.content);
    const visibleHumanContent = stripMediaUrls(humanContent);
    const humanMediaUrls = extractMediaUrls(humanContent);
    const structuredMediaUrls = Array.isArray(data.media_urls) ? data.media_urls : [];
    const hasHumanMedia = humanMediaUrls.length > 0 || structuredMediaUrls.length > 0;
    const executionHref = executionId
      ? `${N8N_EXECUTION_BASE_URL}/${encodeURIComponent(executionId)}`
      : null;

    return (
      <div className={`${styles.row} ${styles.humanRow}`}>
        <p className={styles.roleLabel}>
          Human
          {executionId && (
            <>
              {" - "}
              <a className={styles.executionLink} href={executionHref} target="_blank" rel="noreferrer">
                {executionId}
              </a>
            </>
          )}
        </p>
        <div className={`${styles.bubble} ${styles.humanBubble}`}>
          <CollapsibleMessageText content={visibleHumanContent} hasMedia={hasHumanMedia} />
          <MediaAttachments
            content={humanContent}
            extraUrls={structuredMediaUrls}
            messageKey={`human-${datetime}-${executionId || "na"}`}
          />
        </div>
        <p className={styles.timestamp} suppressHydrationWarning>
          {timeLabel}
        </p>
      </div>
    );
  }

  if (type === "tool") {
    const toolCall = data?.tool_call || {};
    const toolResponse = data?.tool_response || {};
    const isError = Boolean(data?.is_error);
    const toolName = toolCall?.name || toolResponse?.name || "unknown_tool";

    return (
      <div className={`${styles.row} ${styles.aiRow}`}>
        <p className={styles.roleLabel}>Tool</p>
        <div className={`${styles.bubble} ${styles.toolBubble} ${isError ? styles.toolBubbleError : ""}`}>
          <div className={styles.toolSummaryRow}>
            <p className={styles.toolName}>{toolName}</p>
            <span className={`${styles.toolBadge} ${isError ? styles.toolBadgeError : styles.toolBadgeSuccess}`}>
              {isError ? "Error" : "Success"}
            </span>
          </div>

          <button
            type="button"
            className={styles.toolToggle}
            onClick={() => setIsToolExpanded((current) => !current)}
          >
            <span>{isToolExpanded ? "Hide details" : "Show details"}</span>
            <ChevronIcon expanded={isToolExpanded} />
          </button>

          {isToolExpanded && (
            <ul className={styles.toolList}>
              <li className={styles.toolLine}>
                <strong>Tool Call</strong>
                <pre className={styles.toolCode}>{formatToolCall(toolCall)}</pre>
              </li>
              <li className={styles.toolLine}>
                <strong>Tool Response</strong>
                <pre className={styles.toolCode}>{toText(toolResponse.content)}</pre>
              </li>
            </ul>
          )}
        </div>
        <p className={styles.timestamp} suppressHydrationWarning>
          {timeLabel}
        </p>
      </div>
    );
  }

  const rawContent = toText(data.content);
  const { message: aiMessage } = parseAIMessage(rawContent);
  const visibleAiContent = stripMediaUrls(aiMessage);
  const aiMediaUrls = extractMediaUrls(aiMessage);
  const aiStructuredMediaUrls = Array.isArray(data.media_urls) ? data.media_urls : [];
  const hasAiMedia = aiMediaUrls.length > 0 || aiStructuredMediaUrls.length > 0;
  const reportBugBtnClassName = [
    styles.reportBugBtn,
    bugStatus === "loading" ? styles.reportBugBtnLoading : "",
    bugStatus === "success" ? styles.reportBugBtnSuccess : "",
    bugStatus === "error" ? styles.reportBugBtnError : "",
  ]
    .filter(Boolean)
    .join(" ");
  const bugIcon = bugStatus === "success" ? "✓" : bugStatus === "error" ? "✗" : "🐛";

  async function handleReportBug() {
    if (bugStatus === "loading" || !bugReportingContext.canReport) {
      return;
    }

    setBugStatus("loading");

    try {
      const response = await fetch("/api/report-bug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageContent: aiMessage,
          timestamp: datetime,
          executionId: effectiveReportExecutionId,
          clientName: String(clientName || "").trim(),
          userId: String(userId || "").trim(),
          clientUserId: String(userId || "").trim(),
          dashboardHost: window.location.hostname,
          dashboardClient: window.location.hostname.toLowerCase().includes("tiadib")
            ? "TiaDib"
            : window.location.hostname.toLowerCase().includes("plum")
              ? "plum"
              : "",
          reporterName: bugReportingContext.reviewerName,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `Request failed (${response.status})`);
      }

      const notionDatabaseUrl = String(payload?.notionDatabaseUrl || "").trim();
      if (notionDatabaseUrl) {
        window.open(notionDatabaseUrl, "_blank", "noopener,noreferrer");
      }

      setBugStatus("success");
    } catch (error) {
      console.error("[dashboard] report bug failed:", error?.message || error);
      setBugStatus("error");
    }
  }

  return (
    <div className={`${styles.row} ${styles.aiRow}`}>
      <p className={styles.roleLabel}>AI</p>
      <div className={styles.bubbleRow}>
        {bugReportingContext.canReport && (
          <button
            type="button"
            className={reportBugBtnClassName}
            onClick={handleReportBug}
            disabled={bugStatus === "loading"}
            aria-label="Report bug for this AI message"
            title={
              bugStatus === "loading"
                ? "Creating report..."
                : bugStatus === "success"
                  ? "Bug reported"
                  : bugStatus === "error"
                    ? "Failed to report bug"
                    : "Report bug"
            }
          >
            {bugStatus === "loading" ? <span className={styles.reportBugSpinner} aria-hidden="true" /> : bugIcon}
          </button>
        )}
        <div className={`${styles.bubble} ${styles.aiBubble}`}>
          <CollapsibleMessageText content={visibleAiContent} hasMedia={hasAiMedia} />
          <MediaAttachments
            content={aiMessage}
            extraUrls={aiStructuredMediaUrls}
            messageKey={`ai-${datetime}-${executionId || "na"}`}
          />
        </div>
      </div>
      <p className={styles.timestamp} suppressHydrationWarning>
        {timeLabel}
      </p>
    </div>
  );
}
