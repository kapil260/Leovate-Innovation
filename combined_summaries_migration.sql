DROP TABLE IF EXISTS combined_summaries CASCADE;

CREATE TABLE combined_summaries (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic            TEXT NOT NULL,
  combined_summary TEXT NOT NULL,
  platforms        TEXT[] NOT NULL DEFAULT '{}',
  source_ids       BIGINT[] NOT NULL DEFAULT '{}',
  search_count     INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_combined_summaries_user_created
  ON combined_summaries (user_id, created_at DESC);

ALTER TABLE combined_summaries DISABLE ROW LEVEL SECURITY;