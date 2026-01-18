-- Create the 'sales-reports' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('sales-reports', 'sales-reports', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'sales-reports' );

-- Policy to allow anyone to read files (since it's public)
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'sales-reports' );

-- Policy to allow authenticated users to update/delete their own files (optional, good practice)
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'sales-reports' )
WITH CHECK ( bucket_id = 'sales-reports' );
