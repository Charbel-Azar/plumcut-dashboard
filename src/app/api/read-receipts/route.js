import { NextResponse } from "next/server";
import {
  fetchReadReceipts,
  fetchReadReceiptsBatch,
  upsertReadReceipt,
} from "@/services/api";

const isDevelopment = process.env.NODE_ENV !== "production";
const fallbackStoreKey = "__dashboardReadReceiptsFallbackStore";
const fallbackStore =
  globalThis[fallbackStoreKey] || new Map();
if (!globalThis[fallbackStoreKey]) {
  globalThis[fallbackStoreKey] = fallbackStore;
}

function isLocalHostname(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function shouldUseFallbackForRequest(request) {
  if (isDevelopment) {
    return true;
  }

  try {
    const { hostname } = new URL(request.url);
    return isLocalHostname(hostname);
  } catch {
    return false;
  }
}

function parseChatUserIds(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function toFallbackKey(chatUserId, reviewerName) {
  return `${chatUserId}::${reviewerName}`;
}

function normalizeFallbackReceipt(receipt) {
  const chatUserId = String(receipt?.chatUserId || "").trim();
  const reviewerName = String(receipt?.reviewerName || "")
    .trim()
    .toLowerCase();
  const lastReadDatetime = String(receipt?.lastReadDatetime || "").trim();
  const markedAt =
    String(receipt?.markedAt || "").trim() || new Date().toISOString();

  if (!chatUserId || !reviewerName || !lastReadDatetime) {
    return null;
  }

  return {
    chatUserId,
    reviewerName,
    lastReadDatetime,
    markedAt,
  };
}

function upsertFallbackReceipt(receipt) {
  const normalized = normalizeFallbackReceipt(receipt);
  if (!normalized) {
    return;
  }
  fallbackStore.set(
    toFallbackKey(normalized.chatUserId, normalized.reviewerName),
    normalized
  );
}

function listFallbackReceiptsByUserIds(chatUserIds = []) {
  const allowed = new Set(
    (Array.isArray(chatUserIds) ? chatUserIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );

  if (allowed.size === 0) {
    return [];
  }

  return Array.from(fallbackStore.values()).filter((receipt) =>
    allowed.has(String(receipt?.chatUserId || "").trim())
  );
}

function mergeReceipts(primary, secondary) {
  const merged = new Map();

  [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])]
    .forEach((receipt) => {
      const normalized = normalizeFallbackReceipt(receipt);
      if (!normalized) {
        return;
      }
      merged.set(toFallbackKey(normalized.chatUserId, normalized.reviewerName), normalized);
    });

  return Array.from(merged.values());
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const chatUserId = searchParams.get("chatUserId");
  const chatUserIdsRaw = searchParams.get("chatUserIds");
  const allowFallback = shouldUseFallbackForRequest(request);

  try {
    if (chatUserIdsRaw) {
      const ids = parseChatUserIds(chatUserIdsRaw);
      const receipts = await fetchReadReceiptsBatch(ids);
      if (!allowFallback) {
        return NextResponse.json(Array.isArray(receipts) ? receipts : []);
      }
      const merged = mergeReceipts(receipts, listFallbackReceiptsByUserIds(ids));
      return NextResponse.json(merged);
    }

    if (chatUserId) {
      const receipts = await fetchReadReceipts(chatUserId);
      if (!allowFallback) {
        return NextResponse.json(Array.isArray(receipts) ? receipts : []);
      }
      const merged = mergeReceipts(receipts, listFallbackReceiptsByUserIds([chatUserId]));
      return NextResponse.json(merged);
    }

    return NextResponse.json(
      { error: "Missing required query parameter: chatUserId or chatUserIds" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[dashboard] /api/read-receipts GET error:", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch read receipts." }, { status: 500 });
  }
}

export async function POST(request) {
  const allowFallback = shouldUseFallbackForRequest(request);

  try {
    const body = await request.json();
    const chatUserId = String(body?.chatUserId || "").trim();
    const reviewerName = String(body?.reviewerName || "")
      .trim()
      .toLowerCase();
    const lastReadDatetime = String(body?.lastReadDatetime || "").trim();
    const markedAt = String(body?.markedAt || "").trim() || new Date().toISOString();

    if (process.env.NODE_ENV !== "production") {
      console.log("[dashboard] /api/read-receipts POST lastReadDatetime", {
        rawLastReadDatetime: body?.lastReadDatetime,
        normalizedLastReadDatetime: lastReadDatetime,
        chatUserId,
        reviewerName,
      });
    }

    if (!chatUserId || !reviewerName || !lastReadDatetime) {
      return NextResponse.json(
        { error: "chatUserId, reviewerName, and lastReadDatetime are required." },
        { status: 400 }
      );
    }

    const result = await upsertReadReceipt({
      chatUserId,
      reviewerName,
      lastReadDatetime,
      markedAt,
    });

    // Validate persistence to avoid false-positive success responses.
    const receipts = await fetchReadReceipts(chatUserId);
    const requestedLastReadTimestamp = toTimestamp(lastReadDatetime);
    const persisted = (Array.isArray(receipts) ? receipts : []).some((receipt) => {
      const sameReviewer =
        String(receipt?.reviewerName || "")
          .trim()
          .toLowerCase() === reviewerName;
      if (!sameReviewer) {
        return false;
      }

      const persistedLastReadDatetime = String(receipt?.lastReadDatetime || "").trim();
      if (!persistedLastReadDatetime) {
        return false;
      }

      if (persistedLastReadDatetime === lastReadDatetime) {
        return true;
      }

      const persistedTimestamp = toTimestamp(persistedLastReadDatetime);
      if (!requestedLastReadTimestamp || !persistedTimestamp) {
        return false;
      }

      return Math.abs(persistedTimestamp - requestedLastReadTimestamp) <= 1000;
    });

    if (!persisted) {
      if (!result?.success) {
        console.error(
          "[dashboard] read-receipt upsert unacknowledged payload:",
          result?.payload
        );
      }

      if (allowFallback) {
        upsertFallbackReceipt({
          chatUserId,
          reviewerName,
          lastReadDatetime,
          markedAt,
        });

        return NextResponse.json({
          success: true,
          warning:
            "Stored in local fallback because n8n read-receipts webhook did not return persisted data.",
        });
      }

      return NextResponse.json(
        {
          error:
            "Read receipt was not persisted. Check n8n POST upsert node and ensure it returns JSON (for example {\"success\": true}).",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[dashboard] /api/read-receipts POST error:", error?.message || error);
    return NextResponse.json({ error: "Failed to upsert read receipt." }, { status: 500 });
  }
}
