import { NextResponse } from "next/server";
import { fetchChats } from "@/services/api";

// Handle GET /api/chats and optional /api/chats?userId=... for one user's thread.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  try {
    if (!userId) {
      const chats = await fetchChats();
      return NextResponse.json(Array.isArray(chats) ? chats : []);
    }

    const chats = await fetchChats(userId);
    return NextResponse.json(chats[0] || { sessionId: userId, messages: [] });
  } catch (error) {
    console.error("[dashboard] /api/chats error:", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch chat(s)." }, { status: 500 });
  }
}

