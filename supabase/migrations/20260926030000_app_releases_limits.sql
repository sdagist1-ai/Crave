-- Live-update bundles: zips only, at most 50 MB (only the service role uploads anyway).
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['application/zip']
where id = 'app-releases';
