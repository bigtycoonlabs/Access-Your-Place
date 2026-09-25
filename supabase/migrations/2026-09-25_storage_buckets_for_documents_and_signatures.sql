-- Two buckets the code has always used but that did not exist in this project, so every
-- write to them failed: landlord document uploads, the landlord corporate-application PDF,
-- seller document uploads (seller-documents), and the signature images saved when an
-- investor signs (signatures).
--
-- Both are private. Nothing in the browser writes to them directly:
--   * seller-documents: seller-document-upload and manage-landlord-portal write with the
--     service key; landlords upload through a one-time signed upload link that
--     manage-landlord-portal issues for a path in their own folder. Reads are signed links.
--   * signatures: written only by sign-agreement and manage-document-signatures.
-- No storage policies are added, so the public (anon) key can neither read nor write them.

insert into storage.buckets (id, name, public, file_size_limit)
values ('seller-documents', 'seller-documents', false, 26214400)   -- 25 MB
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', false, 1048576, array['image/png'])   -- 1 MB
on conflict (id) do nothing;
