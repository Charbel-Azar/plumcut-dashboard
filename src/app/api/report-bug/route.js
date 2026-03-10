import { NextResponse } from "next/server";

const NOTION_API_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const PRODUCTION_REPORTERS = new Set(["charbel", "nour", "michael"]);
const N8N_PRODUCTION_EXECUTION_BASE_URL = "https://n8n.plumcut.com/workflow/OCYvieDL6GMoxbYuM06ml/executions";
const DASHBOARD_CLIENT_TIA = "TiaDib";
const DASHBOARD_CLIENT_PLUM = "plum";

function toSafeString(value) {
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

function normalizeTimestamp(value) {
  const raw = toSafeString(value).trim();
  if (!raw) {
    return new Date().toISOString();
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function extractIsoDay(value) {
  const raw = toSafeString(value).trim();
  if (!raw) {
    return "";
  }

  const directMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch?.[1]) {
    return directMatch[1];
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function splitRichText(value, maxChunkLength = 1900, maxChunks = 30) {
  const text = toSafeString(value);
  if (!text.trim()) {
    return [];
  }

  const chunks = [];
  for (let start = 0; start < text.length && chunks.length < maxChunks; start += maxChunkLength) {
    chunks.push({
      type: "text",
      text: {
        content: text.slice(start, start + maxChunkLength),
      },
    });
  }

  return chunks;
}

function buildExecutionIdRichText(executionId) {
  const normalizedExecutionId = toSafeString(executionId).trim();
  if (!normalizedExecutionId) {
    return [];
  }

  const executionUrl = `${N8N_PRODUCTION_EXECUTION_BASE_URL}/${encodeURIComponent(normalizedExecutionId)}`;
  return [
    {
      type: "text",
      text: {
        content: normalizedExecutionId,
        link: {
          url: executionUrl,
        },
      },
    },
  ];
}

function getDatabaseUrl(databaseId) {
  const normalized = toSafeString(databaseId).replace(/-/g, "").trim();
  return `https://www.notion.so/${normalized}`;
}

function normalizePropertyName(name) {
  return toSafeString(name)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function normalizeHostCandidate(value) {
  const raw = toSafeString(value).trim();
  if (!raw) {
    return "";
  }

  try {
    const withProtocol = raw.includes("://") ? raw : `https://${raw}`;
    return new URL(withProtocol).hostname.trim().toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function resolveClientLabel({ explicitClient, requestHost, dashboardBaseUrl }) {
  const explicit = toSafeString(explicitClient).trim();
  if (explicit) {
    return explicit;
  }

  const candidates = [requestHost, dashboardBaseUrl]
    .map((value) => normalizeHostCandidate(value))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes("tiadib")) {
      return DASHBOARD_CLIENT_TIA;
    }
    if (candidate.includes("plum")) {
      return DASHBOARD_CLIENT_PLUM;
    }
  }

  return "";
}

function findPropertyName(entries, normalizedCandidates, allowedTypes = []) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return "";
  }

  const normalizedSet = new Set(
    (Array.isArray(normalizedCandidates) ? normalizedCandidates : [])
      .map((candidate) => normalizePropertyName(candidate))
      .filter(Boolean)
  );
  if (normalizedSet.size === 0) {
    return "";
  }

  const allowedTypeSet = new Set(
    (Array.isArray(allowedTypes) ? allowedTypes : [])
      .map((type) => toSafeString(type).trim())
      .filter(Boolean)
  );

  const match = entries.find(([name, property]) => {
    const normalizedName = normalizePropertyName(name);
    const propertyType = toSafeString(property?.type).trim();
    if (!normalizedSet.has(normalizedName)) {
      return false;
    }
    if (allowedTypeSet.size > 0 && !allowedTypeSet.has(propertyType)) {
      return false;
    }
    return true;
  });

  return match ? match[0] : "";
}

function findPropertyNameIncluding(entries, normalizedFragment, allowedTypes = []) {
  const fragment = normalizePropertyName(normalizedFragment);
  if (!fragment || !Array.isArray(entries) || entries.length === 0) {
    return "";
  }

  const allowedTypeSet = new Set(
    (Array.isArray(allowedTypes) ? allowedTypes : [])
      .map((type) => toSafeString(type).trim())
      .filter(Boolean)
  );

  const match = entries.find(([name, property]) => {
    const normalizedName = normalizePropertyName(name);
    const propertyType = toSafeString(property?.type).trim();
    if (!normalizedName.includes(fragment)) {
      return false;
    }
    if (allowedTypeSet.size > 0 && !allowedTypeSet.has(propertyType)) {
      return false;
    }
    return true;
  });

  return match ? match[0] : "";
}

function getPropertyType(propertyMap, propertyName) {
  if (!propertyName || !propertyMap || typeof propertyMap !== "object") {
    return "";
  }
  return toSafeString(propertyMap[propertyName]?.type).trim();
}

function setTextLikeProperty(properties, propertyName, propertyType, textValue) {
  if (!propertyName || !propertyType || !properties || typeof properties !== "object") {
    return;
  }

  const chunks = splitRichText(textValue);
  if (propertyType === "title") {
    properties[propertyName] = { title: chunks };
    return;
  }

  if (propertyType === "rich_text") {
    properties[propertyName] = { rich_text: chunks };
  }
}

async function resolveNotionSchema(notionToken, notionDatabaseId) {
  const response = await fetch(`${NOTION_API_BASE_URL}/databases/${notionDatabaseId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": NOTION_VERSION,
    },
  });

  if (!response.ok) {
    if (process.env.NODE_ENV !== "production") {
      const payload = await response.json().catch(() => ({}));
      console.log("[dashboard] notion database schema read failed", {
        status: response.status,
        message: toSafeString(payload?.message).trim() || null,
      });
    }
    return {
      properties: {},
      urlPropertyNames: [],
      titlePropertyName: "",
      clientPropertyName: "",
      messagePropertyName: "",
      timestampPropertyName: "",
      executionIdPropertyName: "",
      statusPropertyName: "",
      dashboardUrlPropertyName: "",
    };
  }

  const payload = await response.json().catch(() => ({}));
  const properties = payload?.properties && typeof payload.properties === "object" ? payload.properties : {};
  const entries = Object.entries(properties);
  const urlEntries = entries.filter(([, property]) => property?.type === "url");
  const urlPropertyNames = urlEntries.map(([name]) => name);
  const titlePropertyName =
    entries.find(([, property]) => toSafeString(property?.type).trim() === "title")?.[0] || "";

  const dashboardUrlPropertyName =
    findPropertyName(urlEntries, ["Dashboard Link", "Dashboard"]) ||
    findPropertyNameIncluding(urlEntries, "dashboard");

  const executionIdPropertyName =
    findPropertyName(entries, ["Execution ID"], ["rich_text", "number", "title"]) ||
    findPropertyNameIncluding(entries, "execution", ["rich_text", "number", "title"]);

  return {
    properties,
    urlPropertyNames,
    titlePropertyName,
    clientPropertyName: findPropertyName(entries, ["Client"], ["select", "multi_select", "rich_text", "title"]),
    messagePropertyName: findPropertyName(entries, ["Message"], ["rich_text", "title"]),
    timestampPropertyName: findPropertyName(entries, ["Timestamp"], ["date"]),
    executionIdPropertyName,
    statusPropertyName: findPropertyName(entries, ["Status"], ["status", "select"]),
    dashboardUrlPropertyName,
  };
}

export async function POST(request) {
  try {
    const isRuntimeProduction = process.env.NODE_ENV === "production";
    const dashboardEnv = request.cookies.get("__env")?.value;
    if (isRuntimeProduction && dashboardEnv !== "production") {
      return NextResponse.json({ error: "Bug reporting is only available in production." }, { status: 403 });
    }

    const notionToken = toSafeString(process.env.NOTION_TOKEN).trim();
    const notionDatabaseId = toSafeString(process.env.NOTION_DATABASE_ID).trim();
    const configuredDashboardProperty = toSafeString(process.env.NOTION_DASHBOARD_URL_PROPERTY).trim();

    if (!notionToken || !notionDatabaseId) {
      return NextResponse.json({ error: "Notion is not configured." }, { status: 500 });
    }

    const body = await request.json();
    const reporterName = toSafeString(body?.reporterName)
      .trim()
      .toLowerCase();
    const messageContent = toSafeString(body?.messageContent).trim();
    const rawMessageDatetime = toSafeString(body?.timestamp).trim();
    const timestamp = normalizeTimestamp(rawMessageDatetime);
    const deepLinkMessageDatetime = rawMessageDatetime || timestamp;
    const date = extractIsoDay(deepLinkMessageDatetime) || String(timestamp || "").slice(0, 10);
    const executionId = toSafeString(body?.executionId).trim();
    const userId = toSafeString(
      body?.userId || body?.clientUserId || body?.clientIdentifier || body?.client
    ).trim();
    const dashboardUrl = toSafeString(process.env.DASHBOARD_BASE_URL).trim().replace(/\/+$/, "");
    const requestHost = toSafeString(
      body?.dashboardHost || request.headers.get("x-forwarded-host") || request.headers.get("host")
    ).trim();
    const clientLabel = resolveClientLabel({
      explicitClient: body?.dashboardClient,
      requestHost,
      dashboardBaseUrl: dashboardUrl,
    });
    const deepLink =
      dashboardUrl && userId && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? `${dashboardUrl}/chats?userId=${encodeURIComponent(userId)}&dateFrom=${date}&dateTo=${date}&messageDatetime=${encodeURIComponent(deepLinkMessageDatetime)}`
        : "";

    if (isRuntimeProduction && !PRODUCTION_REPORTERS.has(reporterName)) {
      return NextResponse.json({ error: "You are not allowed to report bugs from this account." }, { status: 403 });
    }

    if (!messageContent) {
      return NextResponse.json({ error: "messageContent is required." }, { status: 400 });
    }

    const notionSchema = await resolveNotionSchema(notionToken, notionDatabaseId);
    const {
      properties: schemaProperties,
      urlPropertyNames,
      titlePropertyName,
      clientPropertyName: schemaClientPropertyName,
      messagePropertyName: schemaMessagePropertyName,
      timestampPropertyName: schemaTimestampPropertyName,
      executionIdPropertyName: schemaExecutionIdPropertyName,
      statusPropertyName: schemaStatusPropertyName,
      dashboardUrlPropertyName: schemaDashboardPropertyName,
    } = notionSchema;

    const messagePropertyName = schemaMessagePropertyName || "Message";
    const timestampPropertyName = schemaTimestampPropertyName || "Timestamp";
    const executionIdPropertyName = schemaExecutionIdPropertyName || "Execution ID";
    const clientPropertyName = schemaClientPropertyName || "Client";
    const statusPropertyName = schemaStatusPropertyName || "Status";

    const dashboardPropertyCandidates = Array.from(
      new Set(
        [
          configuredDashboardProperty,
          schemaDashboardPropertyName,
          "dashboard",
          "Dashboard",
          "Dashboard Link",
          "dashboard link",
          "Dashboard link",
        ]
          .map((name) => toSafeString(name).trim())
          .filter(Boolean)
      )
    );
    const notionBaseProperties = {};

    // "Issue Reported" should stay empty; if that's the title column, create with an empty title.
    if (titlePropertyName && getPropertyType(schemaProperties, titlePropertyName) === "title") {
      notionBaseProperties[titlePropertyName] = { title: [] };
    }

    const messagePropertyType =
      getPropertyType(schemaProperties, messagePropertyName) ||
      (messagePropertyName === "Message" ? "rich_text" : "");
    if (messagePropertyType === "title" || messagePropertyType === "rich_text") {
      setTextLikeProperty(notionBaseProperties, messagePropertyName, messagePropertyType, messageContent);
    }

    const timestampPropertyType =
      getPropertyType(schemaProperties, timestampPropertyName) ||
      (timestampPropertyName === "Timestamp" ? "date" : "");
    if (timestampPropertyType === "date") {
      notionBaseProperties[timestampPropertyName] = {
        date: {
          start: timestamp,
        },
      };
    }

    const executionPropertyType =
      getPropertyType(schemaProperties, executionIdPropertyName) ||
      (executionIdPropertyName === "Execution ID" ? "rich_text" : "");
    if (executionPropertyType === "number") {
      const executionNumber = Number(executionId);
      if (Number.isFinite(executionNumber)) {
        notionBaseProperties[executionIdPropertyName] = { number: executionNumber };
      }
    } else if (executionPropertyType === "title" || executionPropertyType === "rich_text") {
      const executionChunks = buildExecutionIdRichText(executionId);
      notionBaseProperties[executionIdPropertyName] =
        executionPropertyType === "title"
          ? { title: executionChunks }
          : { rich_text: executionChunks };
    }

    const clientPropertyType =
      getPropertyType(schemaProperties, clientPropertyName) || (clientPropertyName === "Client" ? "select" : "");
    if (clientLabel) {
      if (clientPropertyType === "select") {
        notionBaseProperties[clientPropertyName] = { select: { name: clientLabel } };
      } else if (clientPropertyType === "multi_select") {
        notionBaseProperties[clientPropertyName] = { multi_select: [{ name: clientLabel }] };
      } else if (clientPropertyType === "title" || clientPropertyType === "rich_text") {
        setTextLikeProperty(notionBaseProperties, clientPropertyName, clientPropertyType, clientLabel);
      }
    }

    const statusPropertyType =
      getPropertyType(schemaProperties, statusPropertyName) || (statusPropertyName === "Status" ? "select" : "");
    if (statusPropertyType === "status") {
      notionBaseProperties[statusPropertyName] = {
        status: {
          name: "Open",
        },
      };
    } else if (statusPropertyType === "select") {
      notionBaseProperties[statusPropertyName] = {
        select: {
          name: "Open",
        },
      };
    }

    const createNotionPage = async (properties) => {
      return fetch(`${NOTION_API_BASE_URL}/pages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${notionToken}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION,
        },
        body: JSON.stringify({
          parent: { database_id: notionDatabaseId },
          properties,
        }),
      });
    };

    if (process.env.NODE_ENV !== "production") {
      console.log("[dashboard] report-bug deep-link", {
        titlePropertyName,
        clientPropertyName,
        messagePropertyName,
        timestampPropertyName,
        executionIdPropertyName,
        statusPropertyName,
        schemaDashboardPropertyName,
        urlPropertyNames,
        configuredDashboardProperty,
        dashboardPropertyCandidates,
        clientLabel,
        requestHost,
        hasDeepLink: Boolean(deepLink),
        deepLink,
        userId,
      });
    }

    let notionResponse = null;
    let resolvedDashboardPropertyName = "";

    if (!deepLink) {
      notionResponse = await createNotionPage(notionBaseProperties);
    } else {
      for (const propertyName of dashboardPropertyCandidates) {
        const propertiesWithLink = {
          ...notionBaseProperties,
          [propertyName]: {
            url: deepLink,
          },
        };

        const response = await createNotionPage(propertiesWithLink);
        if (response.ok) {
          notionResponse = response;
          resolvedDashboardPropertyName = propertyName;
          break;
        }

        const errorPayload = await response.json().catch(() => ({}));
        const errorMessage =
          toSafeString(errorPayload?.message).trim() || `Notion request failed (${response.status})`;
        const isMissingPropertyError = /is not a property that exists/i.test(errorMessage);

        if (!isMissingPropertyError) {
          return NextResponse.json({ error: errorMessage }, { status: 500 });
        }
      }
    }

    if (!notionResponse || !notionResponse.ok) {
      const availableUrlColumns = urlPropertyNames.length > 0 ? urlPropertyNames.join(", ") : "(none)";
      return NextResponse.json(
        {
          error: `Dashboard URL property not found. Available URL columns in Notion: ${availableUrlColumns}. Set NOTION_DASHBOARD_URL_PROPERTY to an exact column name.`,
        },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV !== "production" && deepLink) {
      console.log("[dashboard] report-bug dashboard column resolved", resolvedDashboardPropertyName || "(none)");
    }

    return NextResponse.json({
      success: true,
      notionDatabaseUrl: getDatabaseUrl(notionDatabaseId),
    });
  } catch (error) {
    console.error("[dashboard] /api/report-bug error:", error?.message || error);
    return NextResponse.json({ error: "Failed to create bug report." }, { status: 500 });
  }
}
