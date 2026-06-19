ALTER TABLE dashboard_settings ADD COLUMN build_name text DEFAULT '';

-- Update existing row to have default build_name
UPDATE dashboard_settings SET build_name = '' WHERE id = 1;
