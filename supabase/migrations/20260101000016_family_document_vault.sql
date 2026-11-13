-- ==============================================================================
-- WealthNest VAULT-DOC-01: Family Document Vault & Storage RLS Policies
-- ==============================================================================
-- 1. public.family_documents metadata table
-- 2. Household-aware RLS policies using is_same_household & can_edit_household_record
-- 3. Private Supabase Storage bucket 'family-vault' (20MB max, strict MIME types)
-- 4. Storage object RLS policies scoped to <owner_user_id>/<document_id>/<file_name>
-- ==============================================================================

-- 1. Family Documents Metadata Table
CREATE TABLE IF NOT EXISTS public.family_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL,
  title text NOT NULL,
  category text NOT NULL CHECK (
    category IN (
      'identity_pan',
      'property_deed',
      'cas_statement',
      'insurance_policy',
      'huf_deed',
      'tax_itr',
      'loan_agreement',
      'other'
    )
  ),
  file_name text NOT NULL,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 20971520),
  mime_type text NOT NULL,
  storage_path text NOT NULL,
  document_date date,
  expiry_date date,
  notes text,
  is_encrypted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_documents_user_cat
  ON public.family_documents (user_id, category);

CREATE INDEX IF NOT EXISTS idx_family_documents_member
  ON public.family_documents (user_id, member_id);

-- 2. Enable RLS & Grant Table Privileges
ALTER TABLE public.family_documents ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.family_documents TO authenticated;
GRANT ALL ON TABLE public.family_documents TO service_role;

DROP POLICY IF EXISTS "Users and household members can view family documents" ON public.family_documents;
CREATE POLICY "Users and household members can view family documents"
  ON public.family_documents FOR SELECT
  USING (public.is_same_household(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users and household editors can insert family documents" ON public.family_documents;
CREATE POLICY "Users and household editors can insert family documents"
  ON public.family_documents FOR INSERT
  WITH CHECK (public.can_edit_household_record(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users and household editors can update family documents" ON public.family_documents;
CREATE POLICY "Users and household editors can update family documents"
  ON public.family_documents FOR UPDATE
  USING (public.can_edit_household_record(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users and household editors can delete family documents" ON public.family_documents;
CREATE POLICY "Users and household editors can delete family documents"
  ON public.family_documents FOR DELETE
  USING (public.can_edit_household_record(auth.uid(), user_id));

-- 3. Private Supabase Storage Bucket: 'family-vault'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'family-vault',
  'family-vault',
  false,
  20971520, -- 20 MB limit
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage Object RLS Policies for 'family-vault'
-- Object path convention: <owner_user_id>/<document_id>/<sanitized_file_name>
DROP POLICY IF EXISTS "Household members can read family-vault objects" ON storage.objects;
CREATE POLICY "Household members can read family-vault objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'family-vault'
    AND public.is_same_household(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Household editors can upload family-vault objects" ON storage.objects;
CREATE POLICY "Household editors can upload family-vault objects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'family-vault'
    AND public.can_edit_household_record(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Household editors can update family-vault objects" ON storage.objects;
CREATE POLICY "Household editors can update family-vault objects"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'family-vault'
    AND public.can_edit_household_record(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Household editors can delete family-vault objects" ON storage.objects;
CREATE POLICY "Household editors can delete family-vault objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'family-vault'
    AND public.can_edit_household_record(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

