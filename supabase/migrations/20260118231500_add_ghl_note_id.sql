alter table "public"."client_notes" add column "ghl_note_id" text;

alter table "public"."client_notes" add column "last_synced_at" timestamp with time zone;

CREATE UNIQUE INDEX idx_client_notes_ghl_note_id ON public.client_notes USING btree (ghl_note_id);
