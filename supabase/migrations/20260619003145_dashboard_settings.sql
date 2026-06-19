CREATE TABLE dashboard_settings (
  id int PRIMARY KEY DEFAULT 1,
  title text NOT NULL DEFAULT 'QA Dashboard',
  updated_at timestamptz DEFAULT now()
);

INSERT INTO dashboard_settings (id, title) VALUES (1, 'QA Dashboard');

ALTER TABLE dashboard_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_dashboard_settings" ON dashboard_settings FOR SELECT
  TO public USING (true);

CREATE POLICY "update_dashboard_settings" ON dashboard_settings FOR UPDATE
  TO public USING (true) WITH CHECK (true);
