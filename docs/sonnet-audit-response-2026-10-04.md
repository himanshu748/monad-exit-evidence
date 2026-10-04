# Claude Sonnet 5.5 audit response

The user requires Sonnet 5.5 for audits. The signed-in Claude desktop selector showed Sonnet 5.5, and the independent read-only report identified `claude-sonnet-5-5`. The earlier Haiku report is separate historical evidence. This review covered release commit c60e628; subsequent fixes below are independently tested implementation changes, not a completed second Sonnet review.

## Findings and response

- High: the latest 50-event preview covered about one second, so a human's delayed inspection often lost the indexed comparison. Added a targeted read of the actual ExchangeEvent primary key from the existing PostgreSQL window, atomically with the committed chain watermark in a read-only repeatable-read transaction. It retains freshness, chain/ABI/provenance validation and compares the complete genuine entity against an independently fetched canonical receipt. Preview absence no longer limits an available full-window lookup. No entity is reconstructed from the receipt or from client data.
- High: anonymous GitHub was inaccessible/behind at audit time. The current source was fast-forwarded and the named repository made public under explicit user approval; anonymous raw source is verified accessible.
- High: the worker/tunnel is temporary. Still an open sustained-hosting gate; no permanent-hosting claim.
- Medium: funding rate lacked a unit and used percent scaling. API now returns the fractional value with `fundingRateUnit: fraction`; 40 micros is 0.00004, equivalent to 0.004 percent, following [official Perpl types](https://github.com/PerplFoundation/api-docs/blob/main/types.md). The offline precision regression expectation was corrected. The UI/video did not display this field.
- Medium: the tunnel could expose the whole general server. It now runs `ENVIO_BRIDGE_ONLY=1`, serving only the opt-in bounded snapshot/lookup route, with public-mode admission/concurrency limits and sanitized errors. Other routes, frontend and provider proxies return 404. The transport still trusts this configured HTTPS host; it is not signed or trustless.
- Medium: an unknown index comparison looked successful. Only a full match has green success styling; chain-only observations use warning styling and explicitly explain unavailable/missing indexed comparisons.
- Medium: safe user quantity errors were hidden. Allowlisted decimal/precision/range messages remain actionable; provider/SQL/internal errors remain suppressed.
- Low: decoded-key sorting now uses deterministic code-unit ordering; an empty market list is stale; unsuccessful bridge responses are canceled. The build still uses the pinned frontend's esbuild package and records that dependency; no arbitrary upstream or runtime data fallback was added.

## Real delayed-transaction verification

At 10:08 UTC the transactions from the public 09:44 smoke still returned INDEX_AND_CHAIN_MATCH on both networks through the new genuine SQL lookup, although they were long outside the preview. Mainnet: 0x50601c5f0c72131b4836f18b11081ac84b91fbb3b3c9cfd36f776c96b1154414 log 61, watermark 110438562. Testnet: 0xc1c76c011b9a458e26039e9712326d2b36b017d7877dd30dc2e97914b320f7b7 log 38, watermark 68087459. The bridge's same real lookup was fetched separately. This establishes real window lookup and receipt consistency at that time, not full exchange history or future availability.

The review concluded Envio is demonstrated but final entry needs sustained availability, required hosted video links, primary-track selection and participant agreements. It confirmed neither current Perpl bounty is satisfied. No prize entitlement or completed entry is claimed. Current rules are in [the rules record](hackathon-rules-2026-10-04.md).

After these fixes: 72/72 backend checks, 15/15 UI checks, strict root typecheck, frontend/API build and anonymous public browser checks passed. The browser deliberately waits seven seconds before Inspect on each network and still matches genuine indexed SQL to canonical receipts. This responds to the audit's timing reproduction without relying on an immediate automated click.
