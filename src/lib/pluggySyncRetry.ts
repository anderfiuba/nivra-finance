export const PLUGGY_SYNC_RETRY_DELAYS_MS = [0, 15_000, 45_000, 90_000] as const;

const RECENT_CONNECTION_WINDOW_MS = 15 * 60 * 1000;

export interface PluggyAutoResyncItem {
  pluggyItemId?: string | null;
  createdAt?: string | null;
  status?: string | null;
  executionStatus?: string | null;
  accountCount?: number | null;
}

const BLOCKED_ITEM_STATUSES = new Set(["LOGIN_ERROR", "WAITING_USER_INPUT", "USER_INPUT_TIMEOUT"]);
const BLOCKED_EXECUTION_STATUSES = new Set(["ERROR", "USER_INPUT_TIMEOUT"]);

export function shouldAutoResyncPluggyItem(
  item: PluggyAutoResyncItem,
  now: number = Date.now(),
): boolean {
  if (!item.pluggyItemId) return false;
  if ((item.accountCount ?? 0) > 0) return false;

  const createdAtMs = item.createdAt ? Date.parse(item.createdAt) : Number.NaN;
  if (!Number.isFinite(createdAtMs)) return false;

  const age = now - createdAtMs;
  if (age < -60_000 || age > RECENT_CONNECTION_WINDOW_MS) return false;

  const status = (item.status ?? "").toUpperCase();
  const executionStatus = (item.executionStatus ?? "").toUpperCase();
  if (BLOCKED_ITEM_STATUSES.has(status)) return false;
  if (BLOCKED_EXECUTION_STATUSES.has(executionStatus)) return false;

  return true;
}

export interface PluggySyncResult {
  accounts?: number;
  transactions?: number;
  bills?: number;
  investments?: number;
}

export function hasPluggySyncData(result: PluggySyncResult | null | undefined): boolean {
  if (!result) return false;
  return [result.accounts, result.transactions, result.bills, result.investments].some(
    (value) => typeof value === "number" && value > 0,
  );
}