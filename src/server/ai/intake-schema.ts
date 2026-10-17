export const intakeSchemaSql = `
CREATE TABLE IF NOT EXISTS ai_intakes (
 id uuid PRIMARY KEY, request_id uuid UNIQUE NOT NULL, input_hash text NOT NULL, input jsonb NOT NULL,
 status text NOT NULL DEFAULT 'queued', result jsonb, error text,
 instructions text NOT NULL, prompt_version text NOT NULL, model text NOT NULL,
 input_tokens integer NOT NULL DEFAULT 0, output_tokens integer NOT NULL DEFAULT 0,
 estimated_micros bigint NOT NULL DEFAULT 0, startup_id uuid REFERENCES startups(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_intake_calls (
 id uuid PRIMARY KEY, intake_id uuid UNIQUE NOT NULL REFERENCES ai_intakes(id), budget_day text NOT NULL,
 reserved_micros bigint NOT NULL, charged_micros bigint, receipt jsonb
);
CREATE TABLE IF NOT EXISTS startup_creation_requests (
 request_id uuid PRIMARY KEY, input_hash text NOT NULL, startup_id uuid REFERENCES startups(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ai_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_intake_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_creation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS intake_id uuid REFERENCES ai_intakes(id);
ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS request_payload jsonb;
INSERT INTO schema_migrations(version) VALUES (5) ON CONFLICT DO NOTHING;
`;
