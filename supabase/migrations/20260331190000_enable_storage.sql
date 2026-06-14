-- Enable Storage for announcement images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('announcements', 'announcements', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow Public Access to read images
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT
USING (bucket_id = 'announcements');

-- Allow Public Access to upload images (Development relaxed RLS bypass)
CREATE POLICY "Public Upload" ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'announcements');

-- Allow Public Access to update images
CREATE POLICY "Public Update" ON storage.objects
FOR UPDATE
USING (bucket_id = 'announcements');

-- Allow Public Access to delete images
CREATE POLICY "Public Delete" ON storage.objects
FOR DELETE
USING (bucket_id = 'announcements');
