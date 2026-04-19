CREATE UNIQUE INDEX IF NOT EXISTS crawled_pages_search_hash_key ON public.crawled_pages (search_hash);
ALTER TABLE public.crawled_pages ADD CONSTRAINT crawled_pages_search_hash_key UNIQUE USING INDEX crawled_pages_search_hash_key;
