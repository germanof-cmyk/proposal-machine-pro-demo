-- Torna o bucket orcamentos público (URLs permanentes, sem expiração)
UPDATE storage.buckets SET public = true WHERE id = 'orcamentos';
