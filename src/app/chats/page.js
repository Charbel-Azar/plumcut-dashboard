import ChatsClient from "./client";
import { fetchUsersWithPreview } from "@/services/api";

export const revalidate = 60;

function getLatestMessageTime(user) {
  const datetime = user?.latest_message?.datetime;
  if (!datetime) {
    return 0;
  }

  const timestamp = new Date(datetime).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeUserIdParam(value) {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (Array.isArray(value) && value.length > 0) {
    const first = String(value[0] || "").trim();
    return first || null;
  }

  return null;
}

export default async function ChatsPage({ searchParams }) {
  const users = await fetchUsersWithPreview();
  const sortedUsers = [...users].sort(
    (a, b) => getLatestMessageTime(b) - getLatestMessageTime(a)
  );
  const requestedUserId = normalizeUserIdParam(searchParams?.userId);
  const hasRequestedUser = requestedUserId
    ? sortedUsers.some((user) => user?.user_id === requestedUserId)
    : false;
  const initialSelectedUserId = hasRequestedUser ? requestedUserId : sortedUsers[0]?.user_id || null;

  return (
    <ChatsClient users={sortedUsers} initialSelectedUserId={initialSelectedUserId} />
  );
}
