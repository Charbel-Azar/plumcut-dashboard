import { NextResponse } from "next/server";

function toDisplayName(username) {
  if (!username) {
    return "";
  }
  return `${username.charAt(0).toUpperCase()}${username.slice(1).toLowerCase()}`;
}

function parseCredentials(rawCredentials) {
  const credentialsMap = new Map();
  const entries = String(rawCredentials || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  entries.forEach((entry) => {
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex < 1) {
      return;
    }

    const username = entry.slice(0, separatorIndex).trim().toLowerCase();
    const password = entry.slice(separatorIndex + 1).trim();
    if (!username || !password) {
      return;
    }

    credentialsMap.set(username, {
      password,
      displayName: toDisplayName(username),
    });
  });

  return credentialsMap;
}

export async function POST(request) {
  try {
    const productionCredentials = parseCredentials(process.env.REVIEWER_CREDENTIALS);
    const testCredentials = parseCredentials(process.env.TEST_REVIEWER_CREDENTIALS);

    if (productionCredentials.size === 0 && testCredentials.size === 0) {
      return NextResponse.json({ error: "Server credentials are not configured." }, { status: 500 });
    }

    const body = await request.json();
    const username = String(body?.username || "")
      .trim()
      .toLowerCase();
    const password = String(body?.password || "").trim();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    let reviewer = productionCredentials.get(username);
    let environment = "production";

    if (!reviewer || reviewer.password !== password) {
      reviewer = testCredentials.get(username);
      environment = "test";
    }

    if (!reviewer || reviewer.password !== password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const response = NextResponse.json({
      name: reviewer.displayName,
      reviewerName: username,
      environment,
    });

    response.cookies.set("__env", environment, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[dashboard] /api/auth/login error:", error?.message || error);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
