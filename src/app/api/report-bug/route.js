import { NextResponse } from "next/server";

const NOTION_API_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const PRODUCTION_REPORTERS = new Set(["charbel", "nour", "michael"]);
const N8N_PRODUCTION_EXECUTION_BASE_URL = "https://n8n.plumcut.com/workflow/OCYvieDL6GMoxbYuM06ml/executions";

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
    return splitRichText("-");
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

function formatTitle(clientName, timestamp) {
  const client = toSafeString(clientName).trim() || "Unknown client";
  const label = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));

  return `${client} - ${label}`.slice(0, 180);
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

async function resolveDashboardUrlProperty(notionToken, notionDatabaseId) {
  const response = await fetch(`${NOTION_API_BASE_URL}/databases/${notionDatabaseId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": NOTION_VERSION,
    },
  });

  if (!response.ok) {
    return { name: null, urlPropertyNames: [] };
  }

  const payload = await response.json().catch(() => ({}));
  const properties = payload?.properties && typeof payload.properties === "object" ? payload.properties : {};
  const entries = Object.entries(properties).filter(([, property]) => property?.type === "url");
  const urlPropertyNames = entries.map(([name]) => name);

  if (entries.length === 0) {
    return { name: null, urlPropertyNames };
  }

  const exactCandidates = new Set(["dashboard", "dashboardlink"]);
  const exactMatch = entries.find(([name]) => exactCandidates.has(normalizePropertyName(name)));
  if (exactMatch) {
    return { name: exactMatch[0], urlPropertyNames };
  }

  const containsMatch = entries.find(([name]) => normalizePropertyName(name).includes("dashboard"));
  if (containsMatch) {
    return { name: containsMatch[0], urlPropertyNames };
  }

  return { name: null, urlPropertyNames };
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
    const timestamp = normalizeTimestamp(body?.timestamp);
    const date = String(timestamp || "").slice(0, 10);
    const executionId = toSafeString(body?.executionId).trim();
    const userId = toSafeString(
      body?.userId || body?.clientUserId || body?.clientIdentifier || body?.client
    ).trim();
    const clientName = toSafeString(
      body?.clientName || body?.clientIdentifier || body?.client || userId
    ).trim();
    const dashboardUrl = toSafeString(process.env.DASHBOARD_BASE_URL).trim().replace(/\/+$/, "");
    const deepLink =
      dashboardUrl && userId && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? `${dashboardUrl}/chats?userId=${encodeURIComponent(userId)}&dateFrom=${date}&dateTo=${date}&messageDatetime=${encodeURIComponent(timestamp)}`
        : "";

    if (isRuntimeProduction && !PRODUCTION_REPORTERS.has(reporterName)) {
      return NextResponse.json({ error: "You are not allowed to report bugs from this account." }, { status: 403 });
    }

    if (!messageContent) {
      return NextResponse.json({ error: "messageContent is required." }, { status: 400 });
    }

    const { name: schemaDashboardPropertyName, urlPropertyNames } = await resolveDashboardUrlProperty(
      notionToken,
      notionDatabaseId
    );
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
    const notionBaseProperties = {
      Name: {
        title: splitRichText(formatTitle(clientName, timestamp), 200, 1),
      },
      Message: {
        rich_text: splitRichText(messageContent),
      },
      Timestamp: {
        date: {
          start: timestamp,
        },
      },
      "Execution ID": {
        rich_text: buildExecutionIdRichText(executionId),
      },
      Status: {
        select: {
          name: "Open",
        },
      },
    };
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

    let notionResponse = null;

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

    return NextResponse.json({
      success: true,
      notionDatabaseUrl: getDatabaseUrl(notionDatabaseId),
    });
  } catch (error) {
    console.error("[dashboard] /api/report-bug error:", error?.message || error);
    return NextResponse.json({ error: "Failed to create bug report." }, { status: 500 });
  }
}
