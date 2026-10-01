import { DatabaseSync } from "node:sqlite";
import type { Receipt, RehearsalInput } from "./types.ts";
import { runRehearsal, validateInput } from "./rehearsal.ts";
import { digest } from "./receipt.ts";
export class IdempotencyConflict extends Error {}
export class RehearsalLedger {
  private db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS rehearsals (request_key TEXT PRIMARY KEY, input_hash TEXT NOT NULL, receipt TEXT NOT NULL, created_at TEXT NOT NULL)",
    );
  }
  run(key: string, input: RehearsalInput, now = Date.now()): Receipt {
    if (typeof key !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(key))
      throw new Error(
        "A valid Idempotency-Key of 8–128 safe characters is required",
      );
    validateInput(input);
    const hash = digest(input);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const old = this.db
        .prepare(
          "SELECT input_hash, receipt FROM rehearsals WHERE request_key=?",
        )
        .get(key) as { input_hash: string; receipt: string } | undefined;
      if (old) {
        if (old.input_hash !== hash)
          throw new IdempotencyConflict(
            "Idempotency key already belongs to a different reviewed request",
          );
        this.db.exec("COMMIT");
        return JSON.parse(old.receipt) as Receipt;
      }
      const receipt = runRehearsal(input, now);
      this.db
        .prepare("INSERT INTO rehearsals VALUES (?,?,?,?)")
        .run(key, hash, JSON.stringify(receipt), new Date(now).toISOString());
      this.db.exec("COMMIT");
      return receipt;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  lookup(key: string, input: RehearsalInput): Receipt | undefined {
    const row = this.db
      .prepare("SELECT input_hash,receipt FROM rehearsals WHERE request_key=?")
      .get(key) as { input_hash: string; receipt: string } | undefined;
    if (!row) return;
    if (row.input_hash !== digest(input))
      throw new IdempotencyConflict(
        "Idempotency key already belongs to a different reviewed request",
      );
    return JSON.parse(row.receipt) as Receipt;
  }
  close() {
    this.db.close();
  }
}
