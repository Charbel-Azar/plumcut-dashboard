import { NextResponse } from "next/server";
import { fetchUsersWithPreview } from "@/services/api";

function getLatestMessageTime(user) {
  const datetime = user?.latest_message?.datetime;
  if (!datetime) return 0;
  const ts = new Date(datetime).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

export async function GET() {
  try {
    const users = await fetchUsersWithPreview();
    const sorted = [...users].sort(
      (a, b) => getLatestMessageTime(b) - getLatestMessageTime(a)
    );
    return NextResponse.json(sorted);
  } catch (error) {
    console.error("[dashboard] /api/users error:", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch users." }, { status: 500 });
  }
}
