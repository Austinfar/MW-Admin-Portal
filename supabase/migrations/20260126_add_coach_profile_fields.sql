ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialties text[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_role text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_on_female_landing boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_on_male_landing boolean DEFAULT false;
