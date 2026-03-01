// Splits AI message content into tool info and actual message.
// Input: "[Used tools: Tool: search_products, Input: {}, Result: [...]] The actual message"
// Output: { toolInfo: "Tool: search_products, Input: {}, Result: [...]", message: "The actual message" }
// If no tool used, returns { toolInfo: null, message: originalContent }.
export function parseAIMessage(content) {
  if (typeof content !== "string") {
    return { toolInfo: null, message: "" };
  }

  const trimmed = content.trim();
  const prefix = "[Used tools:";
  if (!trimmed.startsWith(prefix)) {
    return { toolInfo: null, message: content };
  }

  const separator = "]]";
  const separatorIndex = trimmed.indexOf(separator);
  if (separatorIndex === -1) {
    return { toolInfo: null, message: content };
  }

  const toolInfo = trimmed.slice(prefix.length, separatorIndex).trim();
  const message = trimmed.slice(separatorIndex + separator.length).trim();

  return {
    toolInfo: toolInfo || null,
    message: message || "",
  };
}
