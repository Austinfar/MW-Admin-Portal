-- Add event_type_id to cal_user_links
ALTER TABLE "public"."cal_user_links" ADD COLUMN "event_type_id" bigint;
