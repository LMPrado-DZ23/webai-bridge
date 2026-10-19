const base = "http://127.0.0.1:8788";

async function turn(model, content, stream) {
  const response = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, stream, messages: [{ role: "user", content }] }),
  });
  if (!stream) {
    const body = await response.json();
    return { status: response.status, content: body?.choices?.[0]?.message?.content, error: body?.error ?? null };
  }
  const text = await response.text();
  const deltas = [...text.matchAll(/"content":"((?:[^"\\]|\\.)*)"/g)].map(match => match[1]).join("");
  return { status: response.status, deltas, hasDone: text.includes("[DONE]") };
}

const models = await (await fetch(`${base}/v1/models`)).json();
console.log("models:", models.data.map(model => model.id));
console.log("grok non-stream", JSON.stringify(await turn("grok/grok-web", "Reply with exactly: GROK-OK", false)));
console.log("grok stream", JSON.stringify(await turn("grok/grok-web", "Reply with exactly: GROK-STREAM", true)));
