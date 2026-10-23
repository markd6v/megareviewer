-- ACC-310: every account records the region its data lives in.
ALTER TABLE accounts ADD COLUMN region text NOT NULL DEFAULT 'us-east-1';

CREATE INDEX accounts_region_idx ON accounts (region);
