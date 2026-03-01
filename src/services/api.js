import { chats as mockChats, users as mockUsers } from "@/data/mockData";

const API_BASE_URL = process.env.N8N_DASHBOARD_API_BASE_URL?.replace(/\/+$/, "") || "";
const API_KEY = process.env.N8N_DASHBOARD_API_KEY || "";

// Turn any raw user object into the consistent user shape the UI expects.
function normalizeUser(user) {
  const username =
    typeof user?.username === "string"
      ? user.username.trim()
      : typeof user?.name === "string"
        ? user.name.trim()
        : "";

  return {
    _id: user?._id ? String(user._id) : "",
    user_id: user?.user_id || user?.sessionId || "",
    active_image_url: user?.active_image_url || user?.active_image_id || "",
    image_activated_at: user?.image_activated_at || null,
    username,
  };
}

// Build a small, safe preview object from the latest message.
function normalizeLatestMessagePreview(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  const rawType = typeof message.type === "string" ? message.type.trim().toLowerCase() : "";
  const type = rawType === "human" || rawType === "ai" || rawType === "tool" ? rawType : "ai";

  const content = toStringSafe(message.content || message?.data?.content);
  const rawDatetime = typeof message.datetime === "string" ? message.datetime.trim() : "";
  const datetime = isValidDatetimeValue(rawDatetime) ? rawDatetime : null;

  if (!content && !rawDatetime && !rawType) {
    return null;
  }

  return {
    type,
    content,
    datetime,
  };
}

// Normalize a user and attach a normalized latest-message preview.
function normalizeUserWithPreview(user) {
  return {
    ...normalizeUser(user),
    latest_message: normalizeLatestMessagePreview(user?.latest_message),
  };
}

// Convert unknown values to strings without throwing errors.
function toStringSafe(value) {
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
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// Pad numbers to 2 digits (for dates and times).
function pad2(value) {
  return String(value).padStart(2, "0");
}

// Convert day/month/year parts into an ISO date string (YYYY-MM-DD).
function datePartsToIsoDate(day, month, year) {
  if (!day || !month || !year) {
    return null;
  }

  const normalizedYear = year < 100 ? 2000 + year : year;
  return `${normalizedYear}-${pad2(month)}-${pad2(day)}`;
}

// Parse supported date formats and return YYYY-MM-DD when valid.
function parseDateString(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parts = value.split("/").map((part) => Number(part.trim()));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [first, second, third] = parts;
  if (first > 31 || second > 12) {
    return null;
  }

  return datePartsToIsoDate(first, second, third);
}

// Parse a time string and return HH:MM:SS when valid.
function parseTimeString(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const parts = value.split(":").map((part) => Number(part.trim()));
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [hours, minutes, seconds = 0] = parts;
  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

// Build one usable datetime for a message from direct or metadata fields.
function buildMessageDatetime(message) {
  if (message?.datetime && typeof message.datetime === "string") {
    const rawDatetime = message.datetime.trim();
    if (!Number.isNaN(new Date(rawDatetime).getTime())) {
      return rawDatetime;
    }
  }

  const metadata = message?.data?.response_metadata || {};
  const isHuman = message?.type === "human";
  const dateField =
    (isHuman ? metadata.human_date : metadata.ai_date) || metadata.date || metadata.message_date;
  const timeField =
    (isHuman ? metadata.human_time : metadata.ai_time) || metadata.time || metadata.message_time;

  const isoDate = parseDateString(dateField);
  const isoTime = parseTimeString(timeField);
  if (!isoDate || !isoTime) {
    return null;
  }

  return `${isoDate}T${isoTime}`;
}

// Extract strict turn context for a human message (execution id + datetime).
function getStrictHumanTurnContext(message) {
  const executionId = toStringSafe(
    message?.execution_id || message?.data?.response_metadata?.executionID
  ).trim();

  const metadata = message?.data?.response_metadata || {};
  const isoDate = parseDateString(metadata.human_date);
  const isoTime = parseTimeString(metadata.human_time);

  if (!executionId || !isoDate || !isoTime) {
    return null;
  }

  return {
    executionId,
    datetime: `${isoDate}T${isoTime}`,
  };
}

// Normalize a raw tool call into id/name/args format.
function normalizeToolCall(toolCall) {
  if (!toolCall || typeof toolCall !== "object") {
    return null;
  }

  const id = toStringSafe(toolCall.id || toolCall?.args?.id).trim();
  const name = toStringSafe(toolCall.name).trim();
  const args =
    toolCall.args && typeof toolCall.args === "object" && !Array.isArray(toolCall.args)
      ? toolCall.args
      : {};

  if (!id && !name) {
    return null;
  }

  return {
    id,
    name,
    args,
  };
}

// Find tool calls in all known locations of an AI message.
function extractToolCalls(message) {
  const candidates = [
    message?.data?.tool_calls,
    message?.tool_calls,
    message?.data?.additional_kwargs?.tool_calls,
    message?.additional_kwargs?.tool_calls,
  ];

  const rawToolCalls =
    candidates.find((candidate) => Array.isArray(candidate) && candidate.length) || [];

  return rawToolCalls.map((toolCall) => normalizeToolCall(toolCall)).filter(Boolean);
}

// Read media URLs from both formatted and raw message shapes.
function normalizeMediaUrlsFromMessage(message) {
  const candidates = [
    message?.data?.media_urls,
    message?.media_urls,
    message?.data?.additional_kwargs?.mediaUrls,
    message?.additional_kwargs?.mediaUrls,
  ];

  const rawMediaUrls = candidates.find((candidate) => Array.isArray(candidate)) || [];
  const normalized = [];

  rawMediaUrls.forEach((url) => {
    if (typeof url !== "string") {
      return;
    }

    const trimmed = url.trim();
    if (trimmed && !normalized.includes(trimmed)) {
      normalized.push(trimmed);
    }
  });

  return normalized;
}

// Normalize a tool response so downstream code can read it consistently.
function normalizeToolResponse(message) {
  return {
    tool_call_id: toStringSafe(message?.data?.tool_call_id || message?.tool_call_id).trim(),
    name: toStringSafe(message?.data?.name || message?.name).trim(),
    content: toStringSafe(message?.data?.content || message?.content),
  };
}

// Parse JSON-like text when possible, otherwise return null.
function parseJsonIfPossible(content) {
  const text = toStringSafe(content).trim();
  if (!text.startsWith("{") && !text.startsWith("[")) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Check plain text for common error phrases.
function hasErrorSignalInText(text) {
  return /there was an error|workflow did not return a response|invalid url|failed|exception|technical issue/i.test(
    text
  );
}

// Recursively inspect parsed JSON data for error signals.
function hasErrorSignalInParsedValue(value) {
  if (Array.isArray(value)) {
    return value.some((item) => hasErrorSignalInParsedValue(item));
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const status = typeof value.status === "string" ? value.status.toLowerCase() : "";
  if (status === "error" || status === "failed") {
    return true;
  }

  if (value.error_code !== null && value.error_code !== undefined && value.error_code !== "") {
    return true;
  }

  if (typeof value.error_message === "string" && value.error_message.trim()) {
    return true;
  }

  if (typeof value.response === "string" && hasErrorSignalInText(value.response)) {
    return true;
  }

  if (typeof value.text === "string" && hasErrorSignalInText(value.text)) {
    return true;
  }

  return Object.values(value).some((item) => hasErrorSignalInParsedValue(item));
}

// Detect whether tool output content indicates an error.
function detectToolError(content) {
  const parsed = parseJsonIfPossible(content);
  if (parsed !== null) {
    return hasErrorSignalInParsedValue(parsed);
  }

  return hasErrorSignalInText(toStringSafe(content));
}

// Normalize tool messages that already include tool_call + tool_response data.
function normalizeStructuredToolMessage(message, fallbackDatetime = null) {
  const datetime = buildMessageDatetime(message) || fallbackDatetime;
  if (!datetime) {
    return null;
  }

  const toolCall = normalizeToolCall(message?.data?.tool_call);
  if (!toolCall) {
    return null;
  }

  const rawResponse = message?.data?.tool_response || {};
  const toolResponse = {
    tool_call_id: toStringSafe(rawResponse.tool_call_id || toolCall.id).trim(),
    name: toStringSafe(rawResponse.name || toolCall.name).trim(),
    content: toStringSafe(rawResponse.content),
  };

  return {
    type: "tool",
    data: {
      tool_call: toolCall,
      tool_response: toolResponse,
      is_error: Boolean(message?.data?.is_error) || detectToolError(toolResponse.content),
    },
    datetime,
    execution_id: null,
  };
}

// Index tool responses by tool_call_id so AI tool calls can be paired later.
function buildToolResponseLookup(rawMessages) {
  const toolResponsesById = new Map();

  rawMessages.forEach((message) => {
    if (message?.type !== "tool") {
      return;
    }

    if (message?.data?.tool_call) {
      return;
    }

    const toolResponse = normalizeToolResponse(message);
    if (!toolResponse.tool_call_id || toolResponsesById.has(toolResponse.tool_call_id)) {
      return;
    }

    toolResponsesById.set(toolResponse.tool_call_id, toolResponse);
  });

  return toolResponsesById;
}

// Return true when a datetime string can be parsed into a real date/time.
function isValidDatetimeValue(value) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

// Normalize one message that already looks close to final dashboard format.
function normalizeAlreadyFormattedMessage(message, index) {
  const type = message?.type;
  if (type !== "human" && type !== "ai" && type !== "tool") {
    return null;
  }

  const datetime = toStringSafe(message?.datetime).trim();
  if (!isValidDatetimeValue(datetime)) {
    return null;
  }

  if (type === "human") {
    const executionId = toStringSafe(message?.execution_id).trim();
    if (!executionId) {
      return null;
    }

    const mediaUrls = normalizeMediaUrlsFromMessage(message);

    return {
      order: index,
      type: "human",
      data: {
        content: toStringSafe(message?.data?.content || message?.content),
        media_urls: mediaUrls,
      },
      datetime,
      execution_id: executionId,
    };
  }

  if (type === "ai") {
    const mediaUrls = normalizeMediaUrlsFromMessage(message);

    return {
      order: index,
      type: "ai",
      data: {
        content: toStringSafe(message?.data?.content || message?.content),
        media_urls: mediaUrls,
      },
      datetime,
      execution_id: null,
    };
  }

  const toolCall =
    normalizeToolCall(message?.data?.tool_call || message?.tool_call) ||
    (() => {
      const id = toStringSafe(message?.data?.tool_response?.tool_call_id || message?.tool_response?.tool_call_id).trim();
      const name = toStringSafe(message?.data?.tool_response?.name || message?.tool_response?.name).trim();
      if (!id && !name) {
        return null;
      }
      return {
        id,
        name: name || "tool",
        args: {},
      };
    })();

  const rawToolResponse = message?.data?.tool_response || message?.tool_response || {};
  const toolResponse = {
    tool_call_id: toStringSafe(rawToolResponse.tool_call_id || toolCall?.id).trim(),
    name: toStringSafe(rawToolResponse.name || toolCall?.name).trim(),
    content: toStringSafe(rawToolResponse.content),
  };

  if (!toolCall && !toolResponse.tool_call_id && !toolResponse.name) {
    return null;
  }

  return {
    order: index,
    type: "tool",
    data: {
      tool_call: toolCall || { id: toolResponse.tool_call_id, name: toolResponse.name || "tool", args: {} },
      tool_response: toolResponse,
      is_error: Boolean(message?.data?.is_error) || detectToolError(toolResponse.content),
    },
    datetime,
    execution_id: null,
  };
}

// Normalize message arrays that are already mostly preformatted.
function normalizePreformattedMessages(rawMessages) {
  const looksPreformatted = rawMessages.some(
    (message) =>
      isValidDatetimeValue(message?.datetime) &&
      (message?.execution_id !== undefined ||
        message?.data?.tool_call ||
        message?.data?.tool_response ||
        message?.tool_call ||
        message?.tool_response)
  );

  if (!looksPreformatted) {
    return null;
  }

  const normalized = rawMessages
    .map((message, index) => normalizeAlreadyFormattedMessage(message, index))
    .filter(Boolean);

  let hasStartedWithValidHuman = false;
  const filtered = [];

  normalized.forEach((message) => {
    if (message.type === "human") {
      if (!message.execution_id) {
        return;
      }
      hasStartedWithValidHuman = true;
      filtered.push(message);
      return;
    }

    if (!hasStartedWithValidHuman) {
      return;
    }

    filtered.push(message);
  });

  return filtered
    .sort((a, b) => {
      const timeDelta = new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
      if (timeDelta !== 0) {
        return timeDelta;
      }
      return a.order - b.order;
    })
    .map(({ order, ...message }) => message);
}

// Normalize raw chat messages into a clean, ordered timeline for the UI.
function normalizeRawMessages(rawMessages) {
  const normalizedPreformattedMessages = normalizePreformattedMessages(rawMessages);
  if (normalizedPreformattedMessages) {
    return normalizedPreformattedMessages;
  }

  const toolResponsesById = buildToolResponseLookup(rawMessages);
  const normalizedMessages = [];
  let hasStartedWithValidHuman = false;
  let activeTurnDatetime = null;

  rawMessages.forEach((message, index) => {
    const type = message?.type;

    if (type === "human") {
      const strictHumanTurn = getStrictHumanTurnContext(message);
      if (!strictHumanTurn) {
        return;
      }

      hasStartedWithValidHuman = true;
      activeTurnDatetime = strictHumanTurn.datetime;
      const humanMediaUrls = normalizeMediaUrlsFromMessage(message);

      normalizedMessages.push({
        order: index,
        type: "human",
        data: {
          content: toStringSafe(message?.data?.content || message?.content),
          media_urls: humanMediaUrls,
        },
        datetime: strictHumanTurn.datetime,
        execution_id: strictHumanTurn.executionId,
      });
      return;
    }

    if (!hasStartedWithValidHuman) {
      return;
    }

    if (type === "ai") {
      const datetime = buildMessageDatetime(message) || activeTurnDatetime;
      if (!datetime) {
        return;
      }

      const toolCalls = extractToolCalls(message);
      if (!toolCalls.length) {
        const aiMediaUrls = normalizeMediaUrlsFromMessage(message);

        normalizedMessages.push({
          order: index,
          type: "ai",
          data: {
            content: toStringSafe(message?.data?.content || message?.content),
            media_urls: aiMediaUrls,
          },
          datetime,
          execution_id: null,
        });
        return;
      }

      toolCalls.forEach((toolCall) => {
        const matchedToolResponse = toolCall.id ? toolResponsesById.get(toolCall.id) : null;

        const toolResponse = {
          tool_call_id: toStringSafe(matchedToolResponse?.tool_call_id || toolCall.id).trim(),
          name: toStringSafe(matchedToolResponse?.name || toolCall.name).trim(),
          content: toStringSafe(matchedToolResponse?.content),
        };

        normalizedMessages.push({
          order: index,
          type: "tool",
          data: {
            tool_call: toolCall,
            tool_response: toolResponse,
            is_error: detectToolError(toolResponse.content),
          },
          datetime,
          execution_id: null,
        });
      });

      return;
    }

    if (type === "tool" && message?.data?.tool_call) {
      const normalizedToolMessage = normalizeStructuredToolMessage(message, activeTurnDatetime);
      if (normalizedToolMessage) {
        normalizedMessages.push({ ...normalizedToolMessage, order: index });
      }
    }
  });

  return normalizedMessages
    .sort((a, b) => {
      const timeDelta = new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
      if (timeDelta !== 0) {
        return timeDelta;
      }
      return a.order - b.order;
    })
    .map(({ order, ...message }) => message);
}

// Normalize one chat object and its messages.
function normalizeChat(chat) {
  const rawMessages = Array.isArray(chat?.messages) ? chat.messages : [];
  const messages = normalizeRawMessages(rawMessages);

  return {
    _id: chat?._id ? String(chat._id) : "",
    sessionId: chat?.sessionId || "",
    messages,
  };
}

// Build user previews by matching each user with the latest message in their chat.
function buildUsersWithPreviewFromUsersAndChats(users, chats) {
  const latestBySession = new Map();

  chats.forEach((chat) => {
    const sessionId = chat?.sessionId;
    if (!sessionId) {
      return;
    }

    const messages = Array.isArray(chat?.messages) ? chat.messages : [];
    if (messages.length === 0) {
      return;
    }

    const latestMessage = messages[messages.length - 1];
    const normalizedPreview = normalizeLatestMessagePreview(latestMessage);
    if (!normalizedPreview) {
      return;
    }

    latestBySession.set(sessionId, normalizedPreview);
  });

  return users.map((user) => ({
    ...user,
    latest_message: latestBySession.get(user.user_id) || null,
  }));
}

// Compute fallback dashboard stats from local mock data.
function computeMockStats() {
  return {
    totalUsers: mockUsers.length,
    totalMessages: mockChats.reduce((count, chat) => count + (chat?.messages?.length || 0), 0),
    imagesGenerated: mockUsers.filter((user) => Boolean(user.active_image_url || user.active_image_id))
      .length,
    activeSessions: mockChats.filter((chat) => (chat?.messages?.length || 0) > 0).length,
  };
}

// Perform a GET request to the backend API and safely parse JSON.
async function fetchJson(pathname, searchParams, requestOptions = {}) {
  if (!API_BASE_URL) {
    throw new Error("N8N_DASHBOARD_API_BASE_URL is not set");
  }

  const url = new URL(pathname, `${API_BASE_URL}/`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers = {
    Accept: "application/json",
  };

  if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }

  const { headers: overrideHeaders, ...restRequestOptions } = requestOptions || {};
  const hasExplicitCache = Object.prototype.hasOwnProperty.call(restRequestOptions, "cache");
  const hasRevalidate =
    typeof restRequestOptions?.next === "object" &&
    restRequestOptions.next !== null &&
    restRequestOptions.next.revalidate !== undefined;
  const resolvedCache = hasExplicitCache ? restRequestOptions.cache : "no-store";

  const response = await fetch(url.toString(), {
    method: "GET",
    ...(!hasRevalidate ? { cache: resolvedCache } : {}),
    headers: {
      ...headers,
      ...(overrideHeaders || {}),
    },
    ...restRequestOptions,
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${pathname} (${response.status})`);
  }

  const raw = await response.text();
  if (!raw || !raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON returned for ${pathname}`);
  }
}

// Perform a POST request to the backend API and safely parse JSON.
async function postJson(pathname, body, requestOptions = {}) {
  if (!API_BASE_URL) {
    throw new Error("N8N_DASHBOARD_API_BASE_URL is not set");
  }

  const url = new URL(pathname, `${API_BASE_URL}/`);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }

  const { headers: overrideHeaders, ...restRequestOptions } = requestOptions || {};
  const response = await fetch(url.toString(), {
    method: "POST",
    cache: "no-store",
    headers: {
      ...headers,
      ...(overrideHeaders || {}),
    },
    body: JSON.stringify(body || {}),
    ...restRequestOptions,
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${pathname} (${response.status})`);
  }

  const raw = await response.text();
  if (!raw || !raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON returned for ${pathname}`);
  }
}

function normalizeIsoDatetime(value) {
  const text = toStringSafe(value).trim();
  if (!text) {
    return null;
  }

  const timestamp = new Date(text).getTime();
  if (Number.isNaN(timestamp)) {
    return text;
  }

  return new Date(timestamp).toISOString();
}

function normalizeReadReceipt(receipt) {
  const chatUserId = toStringSafe(receipt?.chatUserId).trim();
  const reviewerName = toStringSafe(receipt?.reviewerName).trim().toLowerCase();

  if (!chatUserId || !reviewerName) {
    return null;
  }

  return {
    chatUserId,
    reviewerName,
    lastReadDatetime: normalizeIsoDatetime(receipt?.lastReadDatetime),
    markedAt: normalizeIsoDatetime(receipt?.markedAt),
  };
}

function hasMongoUpdateSuccess(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const target = payload?.json && typeof payload.json === "object" ? payload.json : payload;
  const acknowledged = target.acknowledged === true;
  const modifiedCount = Number(target.modifiedCount) || 0;
  const upsertedCount = Number(target.upsertedCount) || 0;
  const matchedCount = Number(target.matchedCount) || 0;

  return acknowledged || modifiedCount > 0 || upsertedCount > 0 || matchedCount > 0;
}

// Identify Next.js dynamic-server-usage errors that should be re-thrown.
function isDynamicServerUsageError(error) {
  const message = String(error?.message || "");
  return message.includes("Dynamic server usage");
}

// Read a message type and keep only supported values (human/ai/tool).
function getMessageType(message) {
  const rawType =
    typeof message?.type === "string"
      ? message.type
      : typeof message?.kwargs?.type === "string"
        ? message.kwargs.type
        : "";
  const type = rawType.trim().toLowerCase();
  return type === "human" || type === "ai" || type === "tool" ? type : null;
}

// Get the best datetime value we can from a message.
function getMessageDatetimeValue(message) {
  const rawDatetime =
    typeof message?.datetime === "string"
      ? message.datetime.trim()
      : typeof message?.response_metadata?.human_date === "string"
        ? message.response_metadata.human_date.trim()
        : "";

  if (!rawDatetime) {
    return null;
  }

  if (rawDatetime.includes("T") && !Number.isNaN(new Date(rawDatetime).getTime())) {
    return rawDatetime;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(rawDatetime)) {
    return rawDatetime;
  }

  const parsedDate = parseDateString(rawDatetime);
  return parsedDate || null;
}

// Convert a datetime into a YYYY-MM-DD key for daily grouping.
function getMessageDateKey(datetimeValue) {
  if (!datetimeValue) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(datetimeValue)) {
    return datetimeValue.slice(0, 10);
  }

  const time = new Date(datetimeValue).getTime();
  if (Number.isNaN(time)) {
    return null;
  }

  return new Date(time).toISOString().slice(0, 10);
}

// Extract message hour (0-23) for hourly activity charts.
function getMessageHour(message, datetimeValue) {
  if (typeof message?.datetime === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}/.test(message.datetime)) {
    const hour = Number.parseInt(message.datetime.slice(11, 13), 10);
    if (!Number.isNaN(hour) && hour >= 0 && hour < 24) {
      return hour;
    }
  }

  if (datetimeValue && datetimeValue.includes("T")) {
    const hour = Number.parseInt(datetimeValue.slice(11, 13), 10);
    if (!Number.isNaN(hour) && hour >= 0 && hour < 24) {
      return hour;
    }
  }

  const fallbackTime =
    typeof message?.response_metadata?.human_time === "string"
      ? message.response_metadata.human_time
      : typeof message?.data?.response_metadata?.human_time === "string"
        ? message.data.response_metadata.human_time
        : "";
  const hour = Number.parseInt(fallbackTime.slice(0, 2), 10);
  if (!Number.isNaN(hour) && hour >= 0 && hour < 24) {
    return hour;
  }
  return null;
}

// Build date+hour activity buckets from normalized chats.
function computeActivityByDateHourFromChats(chats) {
  const bucketMap = new Map();

  (Array.isArray(chats) ? chats : []).forEach((chat) => {
    const messages = Array.isArray(chat?.messages) ? chat.messages : [];

    messages.forEach((message) => {
      const datetimeValue = getMessageDatetimeValue(message);
      const dateKey = getMessageDateKey(datetimeValue);
      const hour = getMessageHour(message, datetimeValue);

      if (!dateKey || hour === null) {
        return;
      }

      const bucketKey = `${dateKey}|${hour}`;
      bucketMap.set(bucketKey, (bucketMap.get(bucketKey) || 0) + 1);
    });
  });

  return Array.from(bucketMap.entries())
    .map(([bucketKey, count]) => {
      const [date, hourRaw] = bucketKey.split("|");
      return {
        date,
        hour: Number(hourRaw),
        count: Number(count) || 0,
      };
    })
    .filter(
      (entry) =>
        Boolean(entry.date) &&
        Number.isInteger(entry.hour) &&
        entry.hour >= 0 &&
        entry.hour < 24
    )
    .sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.hour - b.hour;
    });
}

// Aggregate date+hour buckets into a 24-hour activity summary.
function aggregateActivityByHour(activityByDateHour) {
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));

  (Array.isArray(activityByDateHour) ? activityByDateHour : []).forEach((entry) => {
    const hour = Number(entry?.hour);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      return;
    }
    hourly[hour].count += Number(entry?.count) || 0;
  });

  return hourly;
}

// Sum message-type counters safely.
function getMessageTypeTotal(messageTypeBreakdown) {
  if (!messageTypeBreakdown || typeof messageTypeBreakdown !== "object") {
    return 0;
  }

  return (
    (Number(messageTypeBreakdown.human) || 0) +
    (Number(messageTypeBreakdown.ai) || 0) +
    (Number(messageTypeBreakdown.tool) || 0)
  );
}

// Extract the tool name from a tool message.
function getMessageToolName(message) {
  return (
    toStringSafe(message?.data?.tool_call?.name).trim() ||
    toStringSafe(message?.name).trim() ||
    toStringSafe(message?.data?.name).trim() ||
    null
  );
}

// Return true when a tool message is marked as an error.
function isToolMessageError(message) {
  return Boolean(message?.data?.is_error || message?.is_error);
}

// Create an empty insights object with all required keys.
function createEmptyInsights() {
  return {
    overview: {
      totalUsers: 0,
      totalMessages: 0,
      activeSessions: 0,
      imagesGenerated: 0,
      avgMessagesPerUser: 0,
      toolErrorRate: 0,
    },
    messagesByDate: [],
    messageTypeBreakdown: {
      human: 0,
      ai: 0,
      tool: 0,
    },
    toolUsage: [],
    topUsers: [],
    activityByHour: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
    activityByDateHour: [],
  };
}

// Normalize backend insights payload into a predictable structure.
function normalizeInsightsPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return createEmptyInsights();
  }

  const overviewSource = payload.overview && typeof payload.overview === "object" ? payload.overview : {};
  const typeSource =
    payload.messageTypeBreakdown && typeof payload.messageTypeBreakdown === "object"
      ? payload.messageTypeBreakdown
      : {};
  const rawActivityByDateHour = Array.isArray(payload.activityByDateHour)
    ? payload.activityByDateHour
    : Array.isArray(payload.activityByDayHour)
      ? payload.activityByDayHour
      : [];
  const normalizedActivityByDateHour = rawActivityByDateHour
    .map((entry) => ({
      date: toStringSafe(entry?.date).slice(0, 10),
      hour: Number(entry?.hour),
      count: Number(entry?.count) || 0,
    }))
    .filter(
      (entry) =>
        Boolean(entry.date) &&
        Number.isInteger(entry.hour) &&
        entry.hour >= 0 &&
        entry.hour < 24
    )
    .sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.hour - b.hour;
    });
  const hasPayloadActivityByHour =
    Array.isArray(payload.activityByHour) && payload.activityByHour.length > 0;

  return {
    overview: {
      totalUsers: Number(overviewSource.totalUsers) || 0,
      totalMessages: Number(overviewSource.totalMessages) || 0,
      activeSessions: Number(overviewSource.activeSessions) || 0,
      imagesGenerated: Number(overviewSource.imagesGenerated) || 0,
      avgMessagesPerUser: Number(overviewSource.avgMessagesPerUser) || 0,
      toolErrorRate: Number(overviewSource.toolErrorRate) || 0,
    },
    messagesByDate: Array.isArray(payload.messagesByDate)
      ? payload.messagesByDate
          .map((entry) => {
            const human = Number(entry?.human) || 0;
            const ai = Number(entry?.ai) || 0;
            const tool = Number(entry?.tool) || 0;
            const hasExplicitTotal = entry?.total !== undefined && entry?.total !== null;
            return {
              date: toStringSafe(entry?.date).slice(0, 10),
              human,
              ai,
              tool,
              total: hasExplicitTotal ? Number(entry?.total) || 0 : human + ai + tool,
            };
          })
          .filter((entry) => Boolean(entry.date))
          .sort((a, b) => a.date.localeCompare(b.date))
      : [],
    messageTypeBreakdown: {
      human: Number(typeSource.human) || 0,
      ai: Number(typeSource.ai) || 0,
      tool: Number(typeSource.tool) || 0,
    },
    toolUsage: Array.isArray(payload.toolUsage)
      ? payload.toolUsage
          .map((entry) => {
            const calls = Number(entry?.calls) || 0;
            const errors = Number(entry?.errors) || 0;
            const successRate =
              Number(entry?.successRate) ||
              (calls > 0 ? Math.round(((calls - errors) / calls) * 100) : 0);
            return {
              name: toStringSafe(entry?.name).trim() || "tool",
              calls,
              errors,
              successRate,
            };
          })
          .sort((a, b) => b.calls - a.calls)
      : [],
    topUsers: Array.isArray(payload.topUsers)
      ? payload.topUsers
          .map((entry) => ({
            sessionId: toStringSafe(entry?.sessionId).trim(),
            messageCount: Number(entry?.messageCount) || 0,
            username: entry?.username ? toStringSafe(entry.username).trim() : null,
          }))
          .filter((entry) => Boolean(entry.sessionId))
          .sort((a, b) => b.messageCount - a.messageCount)
      : [],
    activityByHour: hasPayloadActivityByHour
      ? Array.from({ length: 24 }, (_, hour) => {
          const source = payload.activityByHour.find((entry) => Number(entry?.hour) === hour);
          return {
            hour,
            count: Number(source?.count) || 0,
          };
        })
      : aggregateActivityByHour(normalizedActivityByDateHour),
    activityByDateHour: normalizedActivityByDateHour,
  };
}

// Build insights locally from users + chats when API insights are unavailable.
async function computeInsightsFromExistingData() {
  const [users, chats] = await Promise.all([fetchUsers(), fetchChats()]);
  const insights = createEmptyInsights();

  const messagesByDate = {};
  const activityByDateHour = {};
  const toolUsage = {};
  const userMessageCounts = {};
  let toolErrors = 0;

  chats.forEach((chat) => {
    const messages = Array.isArray(chat?.messages) ? chat.messages : [];
    const sessionId = toStringSafe(chat?.sessionId).trim();
    if (sessionId) {
      userMessageCounts[sessionId] = (userMessageCounts[sessionId] || 0) + messages.length;
    }

    messages.forEach((message) => {
      insights.overview.totalMessages += 1;

      const type = getMessageType(message);
      if (type) {
        insights.messageTypeBreakdown[type] += 1;
      }

      const datetimeValue = getMessageDatetimeValue(message);
      const dateKey = getMessageDateKey(datetimeValue);
      if (dateKey) {
        if (!messagesByDate[dateKey]) {
          messagesByDate[dateKey] = { human: 0, ai: 0, tool: 0 };
        }

        if (type) {
          messagesByDate[dateKey][type] += 1;
        }
      }

      const hour = getMessageHour(message, datetimeValue);
      if (hour !== null) {
        insights.activityByHour[hour].count += 1;
        if (dateKey) {
          const bucketKey = `${dateKey}|${hour}`;
          if (!activityByDateHour[bucketKey]) {
            activityByDateHour[bucketKey] = { date: dateKey, hour, count: 0 };
          }
          activityByDateHour[bucketKey].count += 1;
        }
      }

      if (type === "tool") {
        const hasError = isToolMessageError(message);
        if (hasError) {
          toolErrors += 1;
        }

        const toolName = getMessageToolName(message);
        if (toolName) {
          if (!toolUsage[toolName]) {
            toolUsage[toolName] = { calls: 0, errors: 0 };
          }
          toolUsage[toolName].calls += 1;
          if (hasError) {
            toolUsage[toolName].errors += 1;
          }
        }
      }
    });
  });

  insights.overview.totalUsers = users.length;
  insights.overview.activeSessions = chats.filter((chat) => (chat?.messages?.length || 0) > 0).length;
  const _generateImageData = toolUsage['generate_image'] || { calls: 0, errors: 0 };
  insights.overview.imagesGenerated = _generateImageData.calls - _generateImageData.errors;
  insights.overview.avgMessagesPerUser =
    insights.overview.totalUsers > 0
      ? Math.round(insights.overview.totalMessages / insights.overview.totalUsers)
      : 0;
  insights.overview.toolErrorRate =
    insights.messageTypeBreakdown.tool > 0
      ? Math.round((toolErrors / insights.messageTypeBreakdown.tool) * 100)
      : 0;

  insights.messagesByDate = Object.entries(messagesByDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, counts]) => ({
      date,
      human: counts.human || 0,
      ai: counts.ai || 0,
      tool: counts.tool || 0,
      total: (counts.human || 0) + (counts.ai || 0) + (counts.tool || 0),
    }));
  insights.activityByDateHour = Object.values(activityByDateHour).sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return a.hour - b.hour;
  });

  insights.toolUsage = Object.entries(toolUsage)
    .sort((a, b) => b[1].calls - a[1].calls)
    .map(([name, data]) => ({
      name,
      calls: data.calls,
      errors: data.errors,
      successRate: data.calls > 0 ? Math.round(((data.calls - data.errors) / data.calls) * 100) : 0,
    }));

  insights.topUsers = Object.entries(userMessageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([sessionId, messageCount]) => {
      const matchedUser = users.find((user) => {
        const userId = toStringSafe(user?.user_id).trim();
        const mongoId = toStringSafe(user?._id).trim();
        return sessionId === userId || sessionId === mongoId;
      });

      return {
        sessionId,
        messageCount,
        username: matchedUser?.username || null,
      };
    });

  return insights;
}

// Fetch users from API, with mock-data fallback if request fails.
export async function fetchUsers() {
  try {
    const payload = await fetchJson("plum-dashboard/users");
    const users = Array.isArray(payload) ? payload : [];
    return users.map(normalizeUser);
  } catch (error) {
    if (isDynamicServerUsageError(error)) {
      throw error;
    }
    console.error("[dashboard] fetchUsers fallback:", error.message);
    return mockUsers.map(normalizeUser);
  }
}

// Fetch users with latest-message preview, with layered fallbacks.
export async function fetchUsersWithPreview() {
  const timeoutSignal =
    typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(15000)
      : undefined;

  try {
    const payload = await fetchJson("plum-dashboard/users-with-preview", undefined, {
      cache: "no-store",
      signal: timeoutSignal,
    });
    if (Array.isArray(payload) && payload.length > 0) {
      return payload.map(normalizeUserWithPreview);
    }

    const [users, chats] = await Promise.all([fetchUsers(), fetchChats()]);
    return buildUsersWithPreviewFromUsersAndChats(users, chats);
  } catch (error) {
    if (isDynamicServerUsageError(error)) {
      throw error;
    }
    console.error("[dashboard] fetchUsersWithPreview fallback:", error.message);
    try {
      const [users, chats] = await Promise.all([fetchUsers(), fetchChats()]);
      return buildUsersWithPreviewFromUsersAndChats(users, chats);
    } catch (fallbackError) {
      if (isDynamicServerUsageError(fallbackError)) {
        throw fallbackError;
      }
      console.error("[dashboard] fetchUsersWithPreview secondary fallback:", fallbackError.message);
      return mockUsers.map((user) => normalizeUserWithPreview({ ...user, latest_message: null }));
    }
  }
}

// Fetch chats (optionally by user), normalize them, and fallback to mock data.
export async function fetchChats(userId) {
  try {
    const payload = await fetchJson("plum-dashboard/chats", { userId });
    const chats = Array.isArray(payload) ? payload : [];
    const normalized = chats.map(normalizeChat);
    if (!userId) {
      return normalized;
    }
    return normalized.filter((chat) => chat.sessionId === userId);
  } catch (error) {
    if (isDynamicServerUsageError(error)) {
      throw error;
    }
    console.error("[dashboard] fetchChats fallback:", error.message);
    const normalized = mockChats.map(normalizeChat);
    if (!userId) {
      return normalized;
    }
    return normalized.filter((chat) => chat.sessionId === userId);
  }
}

const READ_RECEIPTS_PATH_CANDIDATES = [
  "plum-dashboard/read-receipts-v2",
  "plum-dashboard/read-receipts",
];

function isNotFoundRequestError(error) {
  const message = toStringSafe(error?.message || error);
  return /\(404\)/.test(message);
}

function extractUpsertSuccess(payload) {
  const successFromObject =
    Boolean(payload?.success) || Boolean(payload?.json?.success);
  const successFromArray =
    Array.isArray(payload) &&
    payload.some((entry) => Boolean(entry?.success) || Boolean(entry?.json?.success));
  const successFromMongoUpdate = Array.isArray(payload)
    ? payload.some((entry) => hasMongoUpdateSuccess(entry))
    : hasMongoUpdateSuccess(payload);

  return successFromObject || successFromArray || successFromMongoUpdate;
}

// Fetch read receipts for one chat user.
export async function fetchReadReceipts(chatUserId) {
  const normalizedChatUserId = toStringSafe(chatUserId).trim();
  if (!normalizedChatUserId) {
    return [];
  }

  let sawEmptyResponse = false;

  for (let index = 0; index < READ_RECEIPTS_PATH_CANDIDATES.length; index += 1) {
    const pathname = READ_RECEIPTS_PATH_CANDIDATES[index];
    const isLastCandidate = index === READ_RECEIPTS_PATH_CANDIDATES.length - 1;

    try {
      const payload = await fetchJson(pathname, { chatUserId: normalizedChatUserId }, {
        cache: "no-store",
      });
      if (payload === null) {
        sawEmptyResponse = true;
        if (isLastCandidate) {
          return [];
        }
        continue;
      }
      const receipts = Array.isArray(payload) ? payload : [];
      return receipts.map(normalizeReadReceipt).filter(Boolean);
    } catch (error) {
      if (isDynamicServerUsageError(error)) {
        throw error;
      }
      if (isLastCandidate && sawEmptyResponse && isNotFoundRequestError(error)) {
        return [];
      }
      if (!isLastCandidate && isNotFoundRequestError(error)) {
        continue;
      }
      console.error("[dashboard] fetchReadReceipts fallback:", error?.message || error);
      return [];
    }
  }

  return [];
}

// Fetch read receipts for multiple chat users in one call.
export async function fetchReadReceiptsBatch(chatUserIds = []) {
  const normalizedChatUserIds = Array.from(
    new Set(
      (Array.isArray(chatUserIds) ? chatUserIds : [])
        .map((chatUserId) => toStringSafe(chatUserId).trim())
        .filter(Boolean)
    )
  );

  if (normalizedChatUserIds.length === 0) {
    return [];
  }

  let sawEmptyResponse = false;

  for (let index = 0; index < READ_RECEIPTS_PATH_CANDIDATES.length; index += 1) {
    const pathname = READ_RECEIPTS_PATH_CANDIDATES[index];
    const isLastCandidate = index === READ_RECEIPTS_PATH_CANDIDATES.length - 1;

    try {
      const payload = await fetchJson(
        pathname,
        { chatUserIds: normalizedChatUserIds.join(",") },
        { cache: "no-store" }
      );
      if (payload === null) {
        sawEmptyResponse = true;
        if (isLastCandidate) {
          return [];
        }
        continue;
      }
      const receipts = Array.isArray(payload) ? payload : [];
      return receipts.map(normalizeReadReceipt).filter(Boolean);
    } catch (error) {
      if (isDynamicServerUsageError(error)) {
        throw error;
      }
      if (isLastCandidate && sawEmptyResponse && isNotFoundRequestError(error)) {
        return [];
      }
      if (!isLastCandidate && isNotFoundRequestError(error)) {
        continue;
      }
      console.error("[dashboard] fetchReadReceiptsBatch fallback:", error?.message || error);
      return [];
    }
  }

  return [];
}

// Insert or update one read receipt document.
export async function upsertReadReceipt({
  chatUserId,
  reviewerName,
  lastReadDatetime,
  markedAt,
}) {
  const normalizedChatUserId = toStringSafe(chatUserId).trim();
  const normalizedReviewerName = toStringSafe(reviewerName).trim().toLowerCase();
  const normalizedLastReadDatetime = normalizeIsoDatetime(lastReadDatetime);
  const normalizedMarkedAt = normalizeIsoDatetime(markedAt) || new Date().toISOString();

  if (!normalizedChatUserId || !normalizedReviewerName || !normalizedLastReadDatetime) {
    throw new Error("chatUserId, reviewerName, and lastReadDatetime are required");
  }

  let lastError = null;
  let fallbackEmptyResult = null;

  for (let index = 0; index < READ_RECEIPTS_PATH_CANDIDATES.length; index += 1) {
    const pathname = READ_RECEIPTS_PATH_CANDIDATES[index];
    const isLastCandidate = index === READ_RECEIPTS_PATH_CANDIDATES.length - 1;

    try {
      const payload = await postJson(pathname, {
        chatUserId: normalizedChatUserId,
        reviewerName: normalizedReviewerName,
        lastReadDatetime: normalizedLastReadDatetime,
        markedAt: normalizedMarkedAt,
      });
      const success = extractUpsertSuccess(payload);
      if (!success && payload === null) {
        fallbackEmptyResult = {
          success: false,
          payload,
          pathname,
        };
        if (isLastCandidate) {
          return fallbackEmptyResult;
        }
        continue;
      }

      return {
        success,
        payload,
        pathname,
      };
    } catch (error) {
      if (!isLastCandidate && isNotFoundRequestError(error)) {
        lastError = error;
        continue;
      }
      if (isLastCandidate && fallbackEmptyResult && isNotFoundRequestError(error)) {
        return fallbackEmptyResult;
      }
      throw error;
    }
  }

  if (fallbackEmptyResult) {
    return fallbackEmptyResult;
  }

  if (lastError) {
    throw lastError;
  }

  return {
    success: false,
    payload: null,
    pathname: READ_RECEIPTS_PATH_CANDIDATES[READ_RECEIPTS_PATH_CANDIDATES.length - 1],
  };
}

// Fetch analytics insights, or compute them locally if API fails.
export async function fetchInsights() {
  try {
    const rawPayload = await fetchJson("plum-dashboard/insights", undefined, {
      next: { revalidate: 0 },
    });
    const payload = Array.isArray(rawPayload) && rawPayload.length > 0 ? rawPayload[0] : rawPayload;
    const normalizedInsights = normalizeInsightsPayload(payload);
    const totalMessages = Number(normalizedInsights?.overview?.totalMessages) || 0;
    const toolMessages = Number(normalizedInsights?.messageTypeBreakdown?.tool) || 0;
    const hasMessagesButNoTrend =
      totalMessages > 0 && (!Array.isArray(normalizedInsights.messagesByDate) || normalizedInsights.messagesByDate.length === 0);
    const hasToolsButNoUsage =
      toolMessages > 0 && (!Array.isArray(normalizedInsights.toolUsage) || normalizedInsights.toolUsage.length === 0);
    const hasMessagesButNoDateHour =
      totalMessages > 0 &&
      (!Array.isArray(normalizedInsights.activityByDateHour) || normalizedInsights.activityByDateHour.length === 0);

    if (hasMessagesButNoTrend || hasToolsButNoUsage || hasMessagesButNoDateHour) {
      try {
        const derivedInsights = await computeInsightsFromExistingData();

        if (hasMessagesButNoTrend && derivedInsights.messagesByDate.length > 0) {
          normalizedInsights.messagesByDate = derivedInsights.messagesByDate;
        }

        if (hasToolsButNoUsage && derivedInsights.toolUsage.length > 0) {
          normalizedInsights.toolUsage = derivedInsights.toolUsage;
        }

        if (hasMessagesButNoDateHour && derivedInsights.activityByDateHour.length > 0) {
          normalizedInsights.activityByDateHour = derivedInsights.activityByDateHour;
          normalizedInsights.activityByHour = aggregateActivityByHour(derivedInsights.activityByDateHour);
        }

        if (getMessageTypeTotal(normalizedInsights.messageTypeBreakdown) === 0) {
          normalizedInsights.messageTypeBreakdown = derivedInsights.messageTypeBreakdown;
        }

        if (normalizedInsights.topUsers.length === 0 && derivedInsights.topUsers.length > 0) {
          normalizedInsights.topUsers = derivedInsights.topUsers;
        }

        if ((Number(normalizedInsights.overview.totalMessages) || 0) === 0) {
          normalizedInsights.overview.totalMessages = Number(derivedInsights.overview.totalMessages) || 0;
        }

        if ((Number(normalizedInsights.overview.imagesGenerated) || 0) === 0) {
          normalizedInsights.overview.imagesGenerated = Number(derivedInsights.overview.imagesGenerated) || 0;
        }

        if ((Number(normalizedInsights.overview.activeSessions) || 0) === 0) {
          normalizedInsights.overview.activeSessions = Number(derivedInsights.overview.activeSessions) || 0;
        }

        if ((Number(normalizedInsights.overview.avgMessagesPerUser) || 0) === 0) {
          const usersCount = Number(normalizedInsights.overview.totalUsers) || 0;
          const messagesCount = Number(normalizedInsights.overview.totalMessages) || 0;
          normalizedInsights.overview.avgMessagesPerUser =
            usersCount > 0 ? Math.round(messagesCount / usersCount) : 0;
        }

        if ((Number(normalizedInsights.overview.toolErrorRate) || 0) === 0 && normalizedInsights.toolUsage.length > 0) {
          const totalToolCalls = normalizedInsights.toolUsage.reduce(
            (sum, entry) => sum + (Number(entry?.calls) || 0),
            0
          );
          const totalToolErrors = normalizedInsights.toolUsage.reduce(
            (sum, entry) => sum + (Number(entry?.errors) || 0),
            0
          );
          normalizedInsights.overview.toolErrorRate =
            totalToolCalls > 0 ? Math.round((totalToolErrors / totalToolCalls) * 100) : 0;
        }
      } catch (backfillError) {
        console.error(
          "[dashboard] failed to backfill incomplete insights payload:",
          backfillError?.message || backfillError
        );
      }
    }

    return normalizedInsights;
  } catch (error) {
    if (isDynamicServerUsageError(error)) {
      throw error;
    }
    console.error("fetchInsights failed, computing from existing data:", error?.message || error);
    try {
      return await computeInsightsFromExistingData();
    } catch (fallbackError) {
      if (isDynamicServerUsageError(fallbackError)) {
        throw fallbackError;
      }
      console.error(
        "[dashboard] computeInsightsFromExistingData failed:",
        fallbackError?.message || fallbackError
      );
      return createEmptyInsights();
    }
  }
}

function normalizeSearchText(value) {
  return toStringSafe(value).replace(/\s+/g, " ").trim();
}

function toSearchTimestamp(value) {
  const timestamp = new Date(toStringSafe(value)).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getSearchableMessageContent(message) {
  const type = toStringSafe(message?.type).trim().toLowerCase();
  if (type === "tool") {
    const toolName = normalizeSearchText(
      message?.data?.tool_call?.name || message?.data?.tool_response?.name || message?.name
    );
    const toolOutput = normalizeSearchText(
      message?.data?.tool_response?.content || message?.data?.content || message?.content
    );
    return `${toolName} ${toolOutput}`.trim();
  }

  return normalizeSearchText(message?.data?.content || message?.content);
}

function getSearchableMessageDatetime(message) {
  const datetimeRaw = normalizeSearchText(message?.datetime);
  return normalizeIsoDatetime(datetimeRaw) || datetimeRaw || null;
}

async function searchMessagesFromChatsFallback(query, limit) {
  const normalizedQuery = normalizeSearchText(query).toLowerCase();
  const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  const chats = await fetchChats();
  const hits = [];

  (Array.isArray(chats) ? chats : []).forEach((chat) => {
    const userId = normalizeSearchText(chat?.sessionId);
    if (!userId) {
      return;
    }

    const messages = Array.isArray(chat?.messages) ? chat.messages : [];
    messages.forEach((message) => {
      const content = getSearchableMessageContent(message);
      if (!content) {
        return;
      }

      if (!content.toLowerCase().includes(normalizedQuery)) {
        return;
      }

      hits.push({
        userId,
        username: null,
        content,
        excerpt: content.length > 140 ? `${content.slice(0, 140).trimEnd()}...` : content,
        datetime: getSearchableMessageDatetime(message),
      });
    });
  });

  hits.sort((a, b) => {
    const aTs = toSearchTimestamp(a?.datetime);
    const bTs = toSearchTimestamp(b?.datetime);
    return bTs - aTs;
  });

  return hits.slice(0, normalizedLimit);
}

// Search chat messages server-side and return lightweight snippets.
export async function searchMessages(query, limit = 20) {
  const normalizedQuery = toStringSafe(query).trim();
  const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  if (!normalizedQuery) {
    return [];
  }

  try {
    const payload = await fetchJson(
      "plum-dashboard/search-messages",
      { q: normalizedQuery, limit: normalizedLimit },
      { cache: "no-store" }
    );

    const source = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.results)
        ? payload.results
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

    return source
      .map((entry) => {
        const node = entry?.json && typeof entry.json === "object" ? entry.json : entry;
        const messageNode =
          node?.message && typeof node.message === "object" ? node.message : {};

        const userId = toStringSafe(
          node?.sessionId || node?.chatUserId || node?.user_id || node?.userId
        ).trim();
        if (!userId) {
          return null;
        }

        const content = toStringSafe(
          messageNode?.content ||
            node?.content ||
            node?.messageContent ||
            node?.snippet ||
            node?.excerpt
        )
          .replace(/\s+/g, " ")
          .trim();

        if (!content) {
          return null;
        }

        const datetimeRaw = toStringSafe(
          messageNode?.datetime || node?.datetime || node?.timestamp || node?.date
        ).trim();
        const normalizedDatetime = normalizeIsoDatetime(datetimeRaw) || datetimeRaw || null;
        const username = toStringSafe(node?.username || node?.name).trim() || null;

        return {
          userId,
          username,
          content,
          excerpt: content.length > 140 ? `${content.slice(0, 140).trimEnd()}...` : content,
          datetime: normalizedDatetime,
        };
      })
      .filter(Boolean)
      .slice(0, normalizedLimit);
  } catch (error) {
    if (isDynamicServerUsageError(error)) {
      throw error;
    }
    console.error("[dashboard] searchMessages primary failed:", error?.message || error);

    try {
      return await searchMessagesFromChatsFallback(normalizedQuery, normalizedLimit);
    } catch (fallbackError) {
      if (isDynamicServerUsageError(fallbackError)) {
        throw fallbackError;
      }
      console.error("[dashboard] searchMessages fallback failed:", fallbackError?.message || fallbackError);
      return [];
    }
  }
}


