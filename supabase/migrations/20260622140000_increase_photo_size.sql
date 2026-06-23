-- Increase player photo max size to 10MB for Wikipedia originals
update storage.buckets set file_size_limit = 10485760 where id = 'player-photos';
