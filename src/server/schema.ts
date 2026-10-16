export const schemaSql = `
CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS startups (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description text NOT NULL,
  business_model text NOT NULL CHECK (business_model IN ('B2B','B2C','B2G')),
  stage text NOT NULL CHECK (stage IN ('Idea','MVP','Early Traction')),
  target_market text NOT NULL,
  customer_segment text NOT NULL,
  website_url text NOT NULL DEFAULT '',
  context text NOT NULL DEFAULT '',
  custom_fields jsonb NOT NULL DEFAULT '{}',
  preferences jsonb NOT NULL DEFAULT '{}',
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS strategy_sections (
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key IN ('icp','value','channels','pricing','assumptions')),
  data jsonb NOT NULL DEFAULT '{}', notes text NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (startup_id,key)
);
CREATE TABLE IF NOT EXISTS roadmap_tasks (
  id uuid PRIMARY KEY, startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  rule_key text, title text NOT NULL, deliverable text NOT NULL, rationale text NOT NULL,
  week integer NOT NULL CHECK (week BETWEEN 1 AND 4),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done','skipped')),
  notes text NOT NULL DEFAULT '', source text NOT NULL CHECK (source IN ('generated','custom')),
  archived boolean NOT NULL DEFAULT false, edited boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (startup_id,rule_key)
);
CREATE INDEX IF NOT EXISTS roadmap_tasks_startup_week_idx ON roadmap_tasks(startup_id,archived,week);
CREATE TABLE IF NOT EXISTS request_limits (
  key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL
);
INSERT INTO schema_migrations(version) VALUES (1) ON CONFLICT DO NOTHING;
-- Browser clients never connect directly. On Supabase, deny anonymous direct table access.
ALTER TABLE startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_limits ENABLE ROW LEVEL SECURITY;
`;
