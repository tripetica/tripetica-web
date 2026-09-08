export const PRODUCTION_BASELINE_TABLES = [
  "reservation_searches",
  "reservation_searches_passengers",
  "reservations",
  "reservations_passengers",
  "transfer_pricing_rules",
  "fx_rates",
  "fx_rate_fetch_attempts",
  "fx_quote_cache",
  "ops_users",
  "ops_user_permissions",
  "ops_sessions",
  "ops_login_attempts",
  "reservation_code_daily_seq",
  "reservation_code_minute_seq",
  "ops_record_audits",
  "customer_users",
  "customer_sessions",
  "customer_auth_tokens",
  "customer_login_attempts",
  "customer_companies",
  "reservation_payment_transactions",
  "reservation_refund_batches",
  "reservation_refund_allocations",
  "reservation_edit_settlements",
  "customer_auth_requests",
] as const;

export const PRODUCTION_BASELINE_COLUMNS = [
  ["reservations", "id"],
  ["reservations", "status"],
  ["reservations", "deleted_at"],
  ["reservations", "customer_user_id"],
  ["reservations", "reservation_confirmation_email_sent_at"],
  ["reservations", "reservation_confirmation_email_queued_at"],
  ["reservations", "operation_notification_email_queued_at"],
  ["reservations", "paid_at"],
  ["reservations", "confirmed_at"],
  ["reservations", "payment_status"],
  ["reservations", "payment_method"],
  ["reservation_searches", "id"],
  ["reservation_searches", "browser_session_id"],
  ["reservation_searches", "selected_tour_code"],
  ["customer_users", "id"],
  ["customer_users", "email"],
  ["customer_users", "email_verified_at"],
  ["customer_users", "nationality_code"],
  ["ops_users", "id"],
  ["ops_users", "email"],
  ["ops_users", "role"],
  ["fx_quote_cache", "provider_next_update_at"],
  ["reservation_payment_transactions", "reservation_id"],
  ["reservation_payment_transactions", "status"],
] as const;

export const PRODUCTION_BASELINE_INDEXES = [
  "reservation_searches_one_active_draft_per_browser_session",
  "customer_users_email_lower_uidx",
  "ops_users_email_lower_uidx",
  "transfer_pricing_rules_one_active_per_service",
  "fx_quote_cache_one_active",
  "reservations_confirmation_email_pending_idx",
  "reservations_operation_notification_email_pending_idx",
] as const;

export const PRODUCTION_BASELINE_CONSTRAINTS = [
  "ops_users_role_chk",
  "customer_users_email_chk",
  "customer_users_nationality_code_chk",
] as const;

export const CUTOVER_FORBIDDEN_TABLES = [
  "reservation_completion_attempts",
  "schema_migrations",
] as const;

export type SchemaCompatIssue = {
  kind: "missing_table" | "missing_column" | "missing_index" | "missing_constraint" | "unexpected_table";
  name: string;
};

export function summarizeSchemaCompatIssues(issues: SchemaCompatIssue[]) {
  if (issues.length === 0) {
    return null;
  }
  return issues.map((issue) => `${issue.kind}:${issue.name}`).join("; ");
}

type Queryable = {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
};

export async function inspectBaselineSchemaCompat(
  client: Queryable,
  options: { ignoreMissingTables?: readonly string[] } = {},
) {
  const issues: SchemaCompatIssue[] = [];
  const tables = await client.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'`,
  );
  const presentTables = new Set(tables.rows.map((row) => row.table_name));
  const ignoredMissingTables = new Set(options.ignoreMissingTables ?? []);
  for (const name of PRODUCTION_BASELINE_TABLES) {
    if (!presentTables.has(name) && !ignoredMissingTables.has(name)) {
      issues.push({ kind: "missing_table", name });
    }
  }
  for (const name of CUTOVER_FORBIDDEN_TABLES) {
    if (presentTables.has(name)) {
      issues.push({ kind: "unexpected_table", name });
    }
  }

  const columns = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'`,
  );
  const presentColumns = new Set(
    columns.rows.map((row) => `${row.table_name}.${row.column_name}`),
  );
  for (const [table, column] of PRODUCTION_BASELINE_COLUMNS) {
    if (!presentColumns.has(`${table}.${column}`)) {
      issues.push({ kind: "missing_column", name: `${table}.${column}` });
    }
  }

  const indexes = await client.query<{ indexname: string }>(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = 'public'`,
  );
  const presentIndexes = new Set(indexes.rows.map((row) => row.indexname));
  for (const name of PRODUCTION_BASELINE_INDEXES) {
    if (!presentIndexes.has(name)) {
      issues.push({ kind: "missing_index", name });
    }
  }

  const constraints = await client.query<{ conname: string }>(
    `SELECT conname
     FROM pg_constraint`,
  );
  const presentConstraints = new Set(constraints.rows.map((row) => row.conname));
  for (const name of PRODUCTION_BASELINE_CONSTRAINTS) {
    if (!presentConstraints.has(name)) {
      issues.push({ kind: "missing_constraint", name });
    }
  }

  return issues;
}
