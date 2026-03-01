import { NextResponse } from "next/server";
import { fetchUsers, searchMessages } from "@/services/api";

const MAX_RESULTS = 20;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("q") || "").trim();

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const [results, users] = await Promise.all([
      searchMessages(query, MAX_RESULTS),
      fetchUsers(),
    ]);

    const usernamesByUserId = new Map(
      (Array.isArray(users) ? users : [])
        .map((user) => [String(user?.user_id || "").trim(), String(user?.username || "").trim()])
        .filter(([userId]) => Boolean(userId))
    );

    const normalizedResults = (Array.isArray(results) ? results : [])
      .map((result) => {
        const userId = String(result?.userId || "").trim();
        const content = String(result?.content || "").trim();
        if (!userId || !content) {
          return null;
        }

        const usernameFromResult = String(result?.username || "").trim();
        const usernameFromUserMap = usernamesByUserId.get(userId) || "";

        return {
          userId,
          username: usernameFromResult || usernameFromUserMap || null,
          excerpt: String(result?.excerpt || content).trim(),
          datetime: result?.datetime || null,
        };
      })
      .filter(Boolean)
      .slice(0, MAX_RESULTS);

    return NextResponse.json({ results: normalizedResults });
  } catch (error) {
    console.error("[dashboard] /api/search error:", error?.message || error);
    return NextResponse.json({ error: "Failed to search messages." }, { status: 500 });
  }
}
