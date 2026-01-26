-- Add slug to users table
ALTER TABLE "public"."users" ADD COLUMN "slug" text;
CREATE UNIQUE INDEX users_slug_idx ON public.users (slug) WHERE slug IS NOT NULL;
