/** Bound decoded response bytes while streaming; never buffer an unbounded provider body. */
export async function boundedText(response: Response, limit: number): Promise<string> {
  const declared = response.headers.get("content-length");
  if (declared && Number(declared) > limit) { await response.body?.cancel(); throw new Error("Provider response too large"); }
  if (!response.body) throw new Error("Missing provider body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("Provider response too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}
