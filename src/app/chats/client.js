"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar/Sidebar";
import UserList from "@/components/UserList/UserList";
import ChatView from "@/components/ChatView/ChatView";
import UserInfo from "@/components/UserInfo/UserInfo";
import MessageSkeleton from "@/components/Skeletons/MessageSkeleton";
import GlobalSearch from "@/components/GlobalSearch/GlobalSearch";
import { useRefresh } from "@/context/RefreshContext";
import { useToast } from "@/context/ToastContext";
import styles from "./chats.module.css";

const isDevelopment = process.env.NODE_ENV !== "production";

function getValidDateParam(value) {
  if (!value) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function toTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function toIsoDay(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const timestamp = new Date(normalized).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

function buildUserFromSearchResult(result, userId) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedUsername = String(result?.username || "").trim();
  const normalizedDatetime = String(result?.datetime || "").trim();
  const normalizedExcerpt = String(result?.excerpt || "").trim();

  return {
    _id: normalizedUserId,
    user_id: normalizedUserId,
    username: normalizedUsername,
    active_image_url: "",
    image_activated_at: null,
    latest_message: normalizedDatetime
      ? {
          type: "ai",
          content: normalizedExcerpt || "Search match",
          datetime: normalizedDatetime,
        }
      : null,
  };
}

function getLatestReceiptForUser(receipts) {
  if (!Array.isArray(receipts) || receipts.length === 0) {
    return null;
  }

  return receipts
    .filter((receipt) => {
      const chatUserId = String(receipt?.chatUserId || "").trim();
      const reviewerName = String(receipt?.reviewerName || "").trim().toLowerCase();
      return Boolean(chatUserId && reviewerName);
    })
    .sort((a, b) => {
      const aRead = toTimestamp(a?.lastReadDatetime) || toTimestamp(a?.markedAt);
      const bRead = toTimestamp(b?.lastReadDatetime) || toTimestamp(b?.markedAt);
      return bRead - aRead;
    })[0];
}

function isUserFullyReviewed(user, allReadReceipts) {
  const receiptsForUser = allReadReceipts?.[user?.user_id] || [];
  const latestReceipt = getLatestReceiptForUser(receiptsForUser);
  const latestReadTimestamp = toTimestamp(latestReceipt?.lastReadDatetime);
  const latestMessageTimestamp = toTimestamp(user?.latest_message?.datetime);

  return (
    latestReadTimestamp > 0 &&
    latestMessageTimestamp > 0 &&
    latestReadTimestamp >= latestMessageTimestamp
  );
}

function formatLastUpdatedLabel(lastRefreshedAt, now) {
  if (!lastRefreshedAt) {
    return "Updated -";
  }

  const timestamp = new Date(lastRefreshedAt).getTime();
  if (Number.isNaN(timestamp)) {
    return "Updated -";
  }

  const diffMs = Math.max(0, now - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes <= 0) {
    return "Updated just now";
  }

  if (diffMinutes < 60) {
    return `Updated ${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  return `Updated ${diffHours} hr ago`;
}

function resolveLatestMessageDatetime(messages) {
  const list = Array.isArray(messages) ? messages : [];
  let latestByTimestamp = null;
  let latestTimestamp = 0;
  let latestRaw = null;

  list.forEach((message) => {
    const datetime = String(message?.datetime || "").trim();
    if (!datetime) {
      return;
    }

    latestRaw = datetime;
    const timestamp = toTimestamp(datetime);
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latestByTimestamp = datetime;
    }
  });

  return latestByTimestamp || latestRaw || null;
}

function normalizeReadReceipt(receipt) {
  const chatUserId = String(receipt?.chatUserId || "").trim();
  const reviewerName = String(receipt?.reviewerName || "")
    .trim()
    .toLowerCase();
  const lastReadDatetime = String(receipt?.lastReadDatetime || "").trim();
  const markedAt = String(receipt?.markedAt || "").trim();

  if (!chatUserId || !reviewerName) {
    return null;
  }

  return {
    chatUserId,
    reviewerName,
    lastReadDatetime: lastReadDatetime || null,
    markedAt: markedAt || null,
  };
}

function normalizeReadReceipts(payload) {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((receipt) => normalizeReadReceipt(receipt)).filter(Boolean);
}

function groupByChatUserId(receipts) {
  return receipts.reduce((groups, receipt) => {
    const chatUserId = receipt.chatUserId;
    if (!groups[chatUserId]) {
      groups[chatUserId] = [];
    }
    groups[chatUserId].push(receipt);
    return groups;
  }, {});
}

export default function ChatsClient({ users: initialUsers, initialSelectedUserId }) {
  const router = useRouter();
  const { isRefreshing } = useRefresh();
  const toast = useToast();
  const [selectedUserId, setSelectedUserId] = useState(initialSelectedUserId);
  const [initialDateRange, setInitialDateRange] = useState(null);
  const [chatCache, setChatCache] = useState({});
  const [loadingChatId, setLoadingChatId] = useState(null);
  const [focusedChatDay, setFocusedChatDay] = useState(null);
  const [focusedSearchQuery, setFocusedSearchQuery] = useState("");
  const [focusedMessageDatetime, setFocusedMessageDatetime] = useState(null);
  const [mobilePanel, setMobilePanel] = useState("list");
  const [users, setUsers] = useState(initialUsers);
  const [listStats, setListStats] = useState({
    filteredCount: initialUsers.length,
    totalCount: initialUsers.length,
    isFiltered: false,
  });
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date());
  const [now, setNow] = useState(() => Date.now());
  const [currentReviewer, setCurrentReviewer] = useState(null);
  const [chatReadReceipts, setChatReadReceipts] = useState([]);
  const [allReadReceipts, setAllReadReceipts] = useState({});
  const pendingRequestsRef = useRef(new Set());
  const chatCacheRef = useRef(chatCache);
  const prevIsRefreshingRef = useRef(false);
  chatCacheRef.current = chatCache;

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const selectedUser = useMemo(
    () => users.find((user) => user.user_id === selectedUserId) || null,
    [users, selectedUserId]
  );

  const selectedChat = selectedUserId ? chatCache[selectedUserId] || null : null;
  const selectedChatLatestMessageDatetime = useMemo(() => {
    return resolveLatestMessageDatetime(selectedChat?.messages);
  }, [selectedChat?.messages]);

  const selectedLatestMessageDatetime = useMemo(() => {
    if (selectedChatLatestMessageDatetime) {
      return selectedChatLatestMessageDatetime;
    }

    const previewDatetime = String(selectedUser?.latest_message?.datetime || "").trim();
    return previewDatetime || null;
  }, [selectedChatLatestMessageDatetime, selectedUser?.latest_message?.datetime]);

  const unreviewedCount = useMemo(() => {
    return users.reduce((count, user) => {
      return count + (isUserFullyReviewed(user, allReadReceipts) ? 0 : 1);
    }, 0);
  }, [allReadReceipts, users]);

  const listCountLabel = useMemo(() => {
    const filteredCount = Number(listStats?.filteredCount) || 0;
    const totalCount = Number(listStats?.totalCount) || users.length;

    if (listStats?.isFiltered) {
      return `Showing ${filteredCount} of ${totalCount}`;
    }

    return `${totalCount} conversations`;
  }, [listStats, users.length]);

  const lastUpdatedLabel = useMemo(() => {
    return formatLastUpdatedLabel(lastRefreshedAt, now);
  }, [lastRefreshedAt, now]);

  const showMessageSkeleton = Boolean(
    selectedUser && loadingChatId === selectedUser.user_id && !selectedChat
  );

  useEffect(() => {
    if (!isDevelopment || !selectedUserId) {
      return;
    }

    console.log("[ChatsClient] latestMessageDatetime for mark-as-read", {
      selectedUserId,
      latestMessageDatetime: selectedLatestMessageDatetime,
      chatLatestMessageDatetime: selectedChatLatestMessageDatetime,
      previewLatestMessageDatetime: selectedUser?.latest_message?.datetime || null,
    });
  }, [
    selectedUser?.latest_message?.datetime,
    selectedChatLatestMessageDatetime,
    selectedLatestMessageDatetime,
    selectedUserId,
  ]);

  const loadReadReceiptsForUser = useCallback(async (chatUserId) => {
    if (!chatUserId) {
      setChatReadReceipts([]);
      return [];
    }

    try {
      const response = await fetch(
        `/api/read-receipts?chatUserId=${encodeURIComponent(chatUserId)}`
      );
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const payload = await response.json();
      const normalizedReceipts = normalizeReadReceipts(payload);

      setChatReadReceipts(normalizedReceipts);
      setAllReadReceipts((previous) => ({
        ...previous,
        [chatUserId]: normalizedReceipts,
      }));

      return normalizedReceipts;
    } catch (error) {
      console.error("[dashboard] read receipts fetch failed:", error?.message || error);
      setChatReadReceipts([]);
      return [];
    }
  }, []);

  const loadReadReceiptsBatch = useCallback(async (chatUserIds) => {
    const ids = Array.from(
      new Set(
        (Array.isArray(chatUserIds) ? chatUserIds : [])
          .map((chatUserId) => String(chatUserId || "").trim())
          .filter(Boolean)
      )
    );

    if (ids.length === 0) {
      setAllReadReceipts({});
      return {};
    }

    try {
      const response = await fetch(
        `/api/read-receipts?chatUserIds=${encodeURIComponent(ids.join(","))}`
      );
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const payload = await response.json();
      const normalizedReceipts = normalizeReadReceipts(payload);
      const grouped = groupByChatUserId(normalizedReceipts);
      setAllReadReceipts(grouped);
      return grouped;
    } catch (error) {
      console.error("[dashboard] read receipts batch fetch failed:", error?.message || error);
      setAllReadReceipts({});
      return {};
    }
  }, []);

  const loadChatIfNeeded = useCallback(async (userId) => {
    if (!userId || chatCacheRef.current[userId] || pendingRequestsRef.current.has(userId)) {
      return;
    }

    pendingRequestsRef.current.add(userId);
    setLoadingChatId(userId);

    try {
      const response = await fetch(`/api/chats?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const chat = await response.json();
      setChatCache((previous) => ({
        ...previous,
        [userId]: chat || { sessionId: userId, messages: [] },
      }));
    } catch (error) {
      console.error("[dashboard] lazy chat fetch failed:", error?.message || error);
      setChatCache((previous) => {
        if (previous[userId]) {
          return previous;
        }
        return { ...previous, [userId]: { sessionId: userId, messages: [] } };
      });
    } finally {
      pendingRequestsRef.current.delete(userId);
      setLoadingChatId((current) => (current === userId ? null : current));
    }
  }, []);

  const handleSelectUser = useCallback(
    (userId) => {
      setFocusedChatDay(null);
      setFocusedSearchQuery("");
      setFocusedMessageDatetime(null);
      setSelectedUserId(userId);
      setMobilePanel("chat");
    },
    []
  );

  const handleSelectSearchResult = useCallback(
    (result, searchQuery) => {
      const userId = String(result?.userId || result || "").trim();
      if (!userId) {
        return;
      }

      setUsers((previousUsers) => {
        if (previousUsers.some((user) => user?.user_id === userId)) {
          return previousUsers;
        }

        return [buildUserFromSearchResult(result, userId), ...previousUsers];
      });

      const day = toIsoDay(result?.datetime);
      setFocusedChatDay(day);
      setFocusedSearchQuery(String(searchQuery || "").trim());
      setFocusedMessageDatetime(String(result?.datetime || "").trim() || null);
      setSelectedUserId(userId);
      setMobilePanel("chat");
      void loadChatIfNeeded(userId);
    },
    [loadChatIfNeeded]
  );

  useEffect(() => {
    if (!selectedUserId) {
      setChatReadReceipts([]);
      return;
    }
    void loadChatIfNeeded(selectedUserId);
    void loadReadReceiptsForUser(selectedUserId);
  }, [selectedUserId, loadChatIfNeeded, loadReadReceiptsForUser]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userIdParam = params.get("userId");
    const dateFrom = getValidDateParam(params.get("dateFrom"));
    const dateTo = getValidDateParam(params.get("dateTo"));
    const messageDatetime = String(params.get("messageDatetime") || "").trim();

    if (userIdParam) {
      setSelectedUserId(userIdParam);
      setMobilePanel("chat");
    }

    if (dateFrom && dateTo) {
      setInitialDateRange(
        dateFrom <= dateTo ? { start: dateFrom, end: dateTo } : { start: dateTo, end: dateFrom }
      );
    }

    if (messageDatetime) {
      setFocusedMessageDatetime(messageDatetime);
      const day = getValidDateParam(messageDatetime.slice(0, 10));
      if (day) {
        setFocusedChatDay(day);
      }
    }
  }, []);

  useEffect(() => {
    const reviewerName = localStorage.getItem("reviewerName");
    if (!reviewerName) {
      setCurrentReviewer(null);
      router.replace("/");
      return;
    }

    setCurrentReviewer(reviewerName.trim().toLowerCase());
  }, [router]);

  useEffect(() => {
    const ids = users.map((user) => user?.user_id).filter(Boolean);
    void loadReadReceiptsBatch(ids);
  }, [users, loadReadReceiptsBatch]);

  const handleManualRefresh = useCallback(async () => {
    const normalizedSelectedUserId = String(selectedUserId || "").trim();
    let refreshedUsers = null;
    let didRefresh = false;

    try {
      const [usersResponse, chatResponse] = await Promise.all([
        fetch("/api/users"),
        normalizedSelectedUserId
          ? fetch(`/api/chats?userId=${encodeURIComponent(normalizedSelectedUserId)}`)
          : Promise.resolve(null),
      ]);

      if (usersResponse?.ok) {
        const usersPayload = await usersResponse.json();
        if (Array.isArray(usersPayload)) {
          refreshedUsers = usersPayload;
          setUsers(usersPayload);
          didRefresh = true;
        }
      }

      if (normalizedSelectedUserId && chatResponse?.ok) {
        const chat = await chatResponse.json();
        setChatCache((previous) => ({
          ...previous,
          [normalizedSelectedUserId]: chat || { sessionId: normalizedSelectedUserId, messages: [] },
        }));
        didRefresh = true;
      }
    } catch {
      // silent - keep showing stale data
    }

    const ids = (Array.isArray(refreshedUsers) ? refreshedUsers : users)
      .map((user) => user?.user_id)
      .filter(Boolean);
    const groupedReceipts = await loadReadReceiptsBatch(ids);

    if (normalizedSelectedUserId) {
      setChatReadReceipts(
        Array.isArray(groupedReceipts?.[normalizedSelectedUserId])
          ? groupedReceipts[normalizedSelectedUserId]
          : []
      );
    }

    if (didRefresh) {
      setLastRefreshedAt(new Date());
      setNow(Date.now());
    }
  }, [loadReadReceiptsBatch, selectedUserId, users]);

  useEffect(() => {
    if (prevIsRefreshingRef.current && !isRefreshing) {
      void handleManualRefresh();
    }
    prevIsRefreshingRef.current = isRefreshing;
  }, [handleManualRefresh, isRefreshing]);

  const handleMarkAsRead = useCallback(
    async (chatUserId, latestMessageDatetime) => {
      const normalizedReviewer = String(currentReviewer || "")
        .trim()
        .toLowerCase();
      const normalizedChatUserId = String(chatUserId || "").trim();
      const normalizedLastRead = String(latestMessageDatetime || "").trim();

      if (!normalizedReviewer || !normalizedChatUserId || !normalizedLastRead) {
        return false;
      }

      if (isDevelopment) {
        console.log("[ChatsClient] mark-as-read payload", {
          chatUserId: normalizedChatUserId,
          reviewerName: normalizedReviewer,
          latestMessageDatetime,
          normalizedLastRead,
        });
      }

      try {
        const response = await fetch("/api/read-receipts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatUserId: normalizedChatUserId,
            reviewerName: normalizedReviewer,
            lastReadDatetime: normalizedLastRead,
            markedAt: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }

        await loadReadReceiptsForUser(normalizedChatUserId);
        toast.success("Marked as read");
        return true;
      } catch (error) {
        console.error("[dashboard] mark as read failed:", error?.message || error);
        toast.error("Failed to mark");
        return false;
      }
    },
    [currentReviewer, loadReadReceiptsForUser, toast]
  );

  return (
    <div className={styles.page}>
      <Sidebar onChatsNavClick={() => setMobilePanel("list")} unreviewedCount={unreviewedCount} />

      <main className={`${styles.content} ${isRefreshing ? styles.contentRefreshing : ""}`}>
        {isRefreshing && <div className={styles.refreshBar} aria-hidden="true" />}
        <section
          className={`${styles.column} ${styles.listColumn} ${mobilePanel === "list" ? styles.panelVisible : styles.panelHidden}`}
        >
          <div className={styles.listHeader}>
            <div className={styles.listHeaderMeta}>
              <h1 className={styles.listHeaderTitle}>Chats</h1>
              <p className={styles.listHeaderCount}>{listCountLabel}</p>
              <p className={styles.listHeaderUpdated} suppressHydrationWarning>
                {lastUpdatedLabel}
              </p>
            </div>
            <GlobalSearch onSelectUser={handleSelectSearchResult} />
          </div>
          <UserList
            users={users}
            selectedUserId={selectedUserId}
            onSelectUser={handleSelectUser}
            initialDateRange={initialDateRange}
            allReadReceipts={allReadReceipts}
            isLoading={users.length === 0}
            onListStatsChange={setListStats}
          />
        </section>

        <section
          className={`${styles.column} ${styles.chatColumn} ${mobilePanel === "chat" ? styles.panelVisible : styles.panelHidden}`}
        >
          {showMessageSkeleton ? (
            <MessageSkeleton />
          ) : (
            <ChatView
              user={selectedUser}
              chat={selectedChat}
              loadingChatId={loadingChatId}
              onBack={() => setMobilePanel("list")}
              onInfoOpen={() => setMobilePanel("info")}
              readReceipts={chatReadReceipts}
              focusedDay={focusedChatDay}
              initialSearchQuery={focusedSearchQuery}
              focusedMessageDatetime={focusedMessageDatetime}
            />
          )}
        </section>

        <section
          className={`${styles.column} ${styles.infoColumn} ${mobilePanel === "info" ? styles.panelVisible : styles.panelHidden}`}
        >
          <UserInfo
            user={selectedUser}
            chat={selectedChat}
            onClose={() => setMobilePanel("chat")}
            readReceipts={chatReadReceipts}
            currentReviewer={currentReviewer}
            latestMessageDatetime={selectedLatestMessageDatetime}
            onMarkAsRead={handleMarkAsRead}
          />
        </section>
      </main>
    </div>
  );
}
