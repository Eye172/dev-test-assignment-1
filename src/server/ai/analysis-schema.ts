export const analysisSchemaSql = `
CREATE TABLE IF NOT EXISTS ai_source_pages (
 id uuid PRIMARY KEY, startup_id uuid NOT NULL REFERENCES startups(id), run_id uuid NOT NULL REFERENCES ai_runs(id),
 step_id uuid NOT NULL REFERENCES ai_steps(id), url text NOT NULL, title text NOT NULL,
 accessed_at timestamptz NOT NULL, content_hash text NOT NULL, status text NOT NULL,
 limitation text NOT NULL, passages jsonb NOT NULL, UNIQUE(run_id,url)
);
CREATE TABLE IF NOT EXISTS ai_memory (
 id uuid PRIMARY KEY, startup_id uuid NOT NULL REFERENCES startups(id), kind text NOT NULL CHECK(kind IN ('hypothesis','decision')),
 status text NOT NULL CHECK(status IN ('proposed','active','accepted','rejected','deferred','superseded')),
 data jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
 origin_step_id uuid REFERENCES ai_steps(id), reason text NOT NULL,
 reviewed_evidence jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_findings (
 id uuid PRIMARY KEY, startup_id uuid NOT NULL REFERENCES startups(id), run_id uuid NOT NULL REFERENCES ai_runs(id),
 step_id uuid NOT NULL REFERENCES ai_steps(id), data jsonb NOT NULL, support text NOT NULL DEFAULT 'unchecked', active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS ai_memory_startup ON ai_memory(startup_id,status);
CREATE TABLE IF NOT EXISTS ai_memory_history (
 id uuid PRIMARY KEY, item_id uuid NOT NULL REFERENCES ai_memory(id), startup_id uuid NOT NULL REFERENCES startups(id),
 revision integer NOT NULL, status text NOT NULL, data jsonb NOT NULL, reason text NOT NULL,
 reviewed_evidence jsonb NOT NULL, request_id uuid, request_hash text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(item_id,revision), UNIQUE(startup_id,request_id)
);
CREATE TABLE IF NOT EXISTS ai_quality_issues (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES ai_runs(id), step_id uuid NOT NULL REFERENCES ai_steps(id),
 severity text NOT NULL, target text NOT NULL, topic text NOT NULL, reason text NOT NULL, correction text NOT NULL,
 deterministic boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'open', resolution text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_analysis_layouts (
 startup_id uuid PRIMARY KEY REFERENCES startups(id), layout jsonb NOT NULL, revision integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS ai_plans (
 id uuid PRIMARY KEY, startup_id uuid NOT NULL REFERENCES startups(id), run_id uuid NOT NULL REFERENCES ai_runs(id),
 step_id uuid NOT NULL REFERENCES ai_steps(id), status text NOT NULL, selection jsonb NOT NULL,
 preview jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_one_active_plan ON ai_plans(startup_id) WHERE status='active';
CREATE TABLE IF NOT EXISTS ai_experiments (
 task_id uuid PRIMARY KEY REFERENCES roadmap_tasks(id), plan_id uuid NOT NULL REFERENCES ai_plans(id),
 proposal_key text NOT NULL, contract jsonb NOT NULL, UNIQUE(plan_id,proposal_key)
);
ALTER TABLE ai_evidence ADD COLUMN IF NOT EXISTS hypothesis_ids jsonb NOT NULL DEFAULT '[]';
ALTER TABLE ai_evidence ADD COLUMN IF NOT EXISTS experiment_snapshot jsonb;
ALTER TABLE ai_steps ADD COLUMN IF NOT EXISTS input_payload jsonb;
ALTER TABLE roadmap_tasks ADD COLUMN IF NOT EXISTS superseded_by_plan uuid;
ALTER TABLE ai_source_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_quality_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_experiments ENABLE ROW LEVEL SECURITY;
INSERT INTO schema_migrations(version) VALUES (4) ON CONFLICT DO NOTHING;
`;
