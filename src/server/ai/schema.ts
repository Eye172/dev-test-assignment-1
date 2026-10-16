export const aiSchemaSql = `
CREATE TABLE IF NOT EXISTS ai_runs (
 id uuid PRIMARY KEY, startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, parent_run_id uuid, mode text NOT NULL, brief text NOT NULL,
 status text NOT NULL DEFAULT 'queued', input_snapshot jsonb NOT NULL, input_hash text NOT NULL, expected_vector jsonb NOT NULL,
 sources jsonb NOT NULL DEFAULT '[]', error text, lease_token uuid, lease_until timestamptz,
 input_tokens integer NOT NULL DEFAULT 0, output_tokens integer NOT NULL DEFAULT 0,
 estimated_micros bigint NOT NULL DEFAULT 0, reserved_micros bigint NOT NULL DEFAULT 0,
 max_micros bigint NOT NULL, cancel_requested boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(startup_id,request_id)
);
CREATE INDEX IF NOT EXISTS ai_runs_startup_created ON ai_runs(startup_id,created_at DESC);
CREATE TABLE IF NOT EXISTS ai_steps (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
 role text NOT NULL, round integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'queued',
 model text NOT NULL, prompt_version text NOT NULL, prompt_hash text NOT NULL,
 result jsonb, error text, input_tokens integer NOT NULL DEFAULT 0, output_tokens integer NOT NULL DEFAULT 0,
 estimated_micros bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(run_id,role,round)
);
CREATE TABLE IF NOT EXISTS ai_events (
 seq bigserial PRIMARY KEY, run_id uuid NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
 kind text NOT NULL, role text, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ai_steps ADD COLUMN IF NOT EXISTS instructions text;
ALTER TABLE ai_steps ADD COLUMN IF NOT EXISTS execution_config jsonb;
CREATE INDEX IF NOT EXISTS ai_events_run_sequence ON ai_events(run_id,seq);
CREATE TABLE IF NOT EXISTS ai_messages (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
 step_id uuid REFERENCES ai_steps(id), sender text NOT NULL, recipients jsonb NOT NULL,
 kind text NOT NULL, content jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_budget_days (
 day text PRIMARY KEY, charged_micros bigint NOT NULL DEFAULT 0, reserved_micros bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ai_calls (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
 step_id uuid NOT NULL REFERENCES ai_steps(id) ON DELETE CASCADE, budget_day text NOT NULL,
 model text NOT NULL, reserved_micros bigint NOT NULL, charged_micros bigint,
 response_id text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_applications (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES ai_runs(id), step_id uuid NOT NULL REFERENCES ai_steps(id),
 startup_id uuid NOT NULL REFERENCES startups(id), target text NOT NULL, section_revision integer,
 previous_data jsonb NOT NULL, proposed_data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(run_id,step_id,target)
);
CREATE TABLE IF NOT EXISTS ai_evidence (
 id uuid PRIMARY KEY, startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
 task_id uuid REFERENCES roadmap_tasks(id), kind text NOT NULL, observation text NOT NULL,
 interpretation text NOT NULL, sample_size integer, source_url text NOT NULL DEFAULT '',
 method text NOT NULL DEFAULT '', observed_on text NOT NULL DEFAULT '', limitations text NOT NULL DEFAULT '', task_snapshot jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ai_evidence ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS ai_evidence_submission ON ai_evidence(startup_id,request_id);
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_budget_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_evidence ENABLE ROW LEVEL SECURITY;
INSERT INTO schema_migrations(version) VALUES (3) ON CONFLICT DO NOTHING;
ALTER TABLE roadmap_tasks DROP CONSTRAINT IF EXISTS roadmap_tasks_source_check;
ALTER TABLE roadmap_tasks ADD CONSTRAINT roadmap_tasks_source_check CHECK (source IN ('generated','custom','ai'));
`;
