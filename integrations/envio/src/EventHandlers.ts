import { indexer } from 'envio';
import { EVENT_NAMES, normalizeExchangeEvent } from './normalize.ts';

for (const eventName of EVENT_NAMES) {
  indexer.onEvent(
    { contract: 'Exchange', event: eventName, fields: { transaction: ['hash'], block: ['hash', 'timestamp'] } },
    async ({ event, context }) => {
      const normalized = normalizeExchangeEvent(event);
      // Stable chain + transaction + log primary key makes replay/preload writes idempotent.
      // No external side effects: Envio commits this entity with its block progress and reorg handling.
      context.ExchangeEvent.set({ ...normalized, marketId: normalized.marketId ?? undefined,
        accountId: normalized.accountId ?? undefined, quantity: normalized.quantity ?? undefined });
    },
  );
}
