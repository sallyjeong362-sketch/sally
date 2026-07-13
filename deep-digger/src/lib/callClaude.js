export async function callClaude(system, userMsg, maxTokens = 600) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMsg }]
    })
  });
  const d = await res.json();
  if (d.type === "exceeded_limit" || (d.error && d.error.type === "exceeded_limit")) throw new Error("RATE_LIMIT");
  if (d.error) throw new Error(d.error.message);
  const t = (d.content?.[0]?.text || "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("No JSON: " + t.slice(0, 60));
  try {
    return JSON.parse(t.slice(s, e + 1).replace(/:\s*"([^"]*)"/g, (_, v) => ': "' + v.replace(/[\r\n\t]/g, " ") + '"'));
  } catch {
    const g = k => { const m = t.match(new RegExp('"' + k + '"\\s*:\\s*"([^"]*)"')); return m ? m[1] : ""; };
    return { _g: g };
  }
}
