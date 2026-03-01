function toStringSafe(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

export function formatPhoneNumber(userId) {
  const rawId = toStringSafe(userId);
  const numberOnly = rawId.replace("whatsapp:+", "");
  if (numberOnly.startsWith("961") && numberOnly.length === 11) {
    const local = numberOnly.slice(3);
    return `+961 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 8)}`;
  }
  return rawId.replace("whatsapp:", "");
}

export function getAvatarLabel(userId, username) {
  const normalizedUsername = toStringSafe(username).trim();
  if (normalizedUsername) {
    const initials = normalizedUsername
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();

    if (initials) {
      return initials;
    }
  }

  const digits = toStringSafe(userId).replace(/\D/g, "");
  return digits.slice(-2) || "U";
}

export function getUserDisplayLabel(user) {
  const username = typeof user?.username === "string" ? user.username.trim() : "";
  return username || formatPhoneNumber(user?.user_id);
}
