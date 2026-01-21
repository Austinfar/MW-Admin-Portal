
-- Initialize Supabase Storage Schema (Missing from base schema)
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text NOT NULL PRIMARY KEY,
  name text NOT NULL,
  owner uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  public boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket_id text,
  name text,
  owner uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now(),
  metadata jsonb,
  path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
  version text,
  owner_id text
);

-- Indexes
CREATE INDEX IF NOT EXISTS bname ON storage.buckets USING btree (name);
CREATE INDEX IF NOT EXISTS bucketid_objname ON storage.objects USING btree (bucket_id, name);
CREATE INDEX IF NOT EXISTS name_prefix_search ON storage.objects USING btree (name text_pattern_ops);

-- RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
