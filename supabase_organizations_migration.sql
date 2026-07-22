-- ====================================================================
-- TRELVIX AI: ORGANIZATIONS & TEAM COLLABORATION MIGRATION
-- ====================================================================

-- 1. Create Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Organization Members Table
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- 3. Create Organization Invitations Table
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(organization_id, email)
);

-- 4. Extend Existing Projects Table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 5. Extend Existing Conversations Table
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 6. Future File Architecture: Create Organization Files Table
CREATE TABLE IF NOT EXISTS public.organization_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- INDEXES & PERFORMANCE OPTIMIZATIONS
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_id);

CREATE INDEX IF NOT EXISTS idx_org_members_org_user ON public.organization_members(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON public.organization_members(organization_id, role);

CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON public.organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON public.organization_invitations(organization_id);

CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org_id ON public.conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_files_org_id ON public.organization_files(organization_id);

-- ====================================================================
-- AUTOMATIC TRIGGER FOR UPDATED_AT
-- ====================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_updated_at_organizations ON public.organizations;
CREATE TRIGGER set_updated_at_organizations
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Automatically add owner as active member when an organization is created
CREATE OR REPLACE FUNCTION add_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role, status, joined_at)
  VALUES (NEW.id, NEW.owner_id, 'owner', 'active', now())
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_add_owner_as_member ON public.organizations;
CREATE TRIGGER trigger_add_owner_as_member
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE PROCEDURE add_owner_as_member();

-- ====================================================================
-- SECURITY DEFINER HELPER FUNCTIONS (PREVENTS RECURSIVE RLS)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = _org_id
      AND user_id = _user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = _org_id
      AND user_id = _user_id
      AND role IN ('owner', 'admin')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = _org_id
      AND user_id = _user_id
      AND role = 'owner'
  ) OR EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = _org_id
      AND owner_id = _user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_invitation_recipient(_email TEXT, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = _user_id
      AND email = _email
  );
END;
$$;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES (NON-RECURSIVE)
-- ====================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_files ENABLE ROW LEVEL SECURITY;

-- Clean up legacy policies
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Owners and Admins can update organization settings" ON public.organizations;
DROP POLICY IF EXISTS "Only Owners can delete organizations" ON public.organizations;

DROP POLICY IF EXISTS "Members can view other members of their organization" ON public.organization_members;
DROP POLICY IF EXISTS "Owners and Admins can insert/manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners and Admins can update member roles" ON public.organization_members;
DROP POLICY IF EXISTS "Owners, Admins or self can remove members" ON public.organization_members;

DROP POLICY IF EXISTS "Members can view invitations of their organization" ON public.organization_invitations;
DROP POLICY IF EXISTS "Owners and Admins can create invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Owners and Admins can delete invitations" ON public.organization_invitations;

DROP POLICY IF EXISTS "Members can view org files" ON public.organization_files;
DROP POLICY IF EXISTS "Members can upload org files" ON public.organization_files;
DROP POLICY IF EXISTS "Owners and Admins or uploader can update org files" ON public.organization_files;
DROP POLICY IF EXISTS "Owners and Admins or uploader can delete org files" ON public.organization_files;

-- 1. Organizations Policies
CREATE POLICY "Users can view organizations they belong to"
ON public.organizations FOR SELECT
USING (
  public.is_org_member(auth.uid(), id) OR owner_id = auth.uid()
);

CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
WITH CHECK (
  auth.uid() = owner_id
);

CREATE POLICY "Owners and Admins can update organization settings"
ON public.organizations FOR UPDATE
USING (
  public.is_org_admin(auth.uid(), id)
);

CREATE POLICY "Only Owners can delete organizations"
ON public.organizations FOR DELETE
USING (
  public.is_org_owner(auth.uid(), id) OR owner_id = auth.uid()
);

-- 2. Organization Members Policies (Non-Recursive)
CREATE POLICY "Members can view other members of their organization"
ON public.organization_members FOR SELECT
USING (
  public.is_org_member(auth.uid(), organization_id)
);

CREATE POLICY "Owners and Admins can insert/manage members"
ON public.organization_members FOR INSERT
WITH CHECK (
  public.is_org_admin(auth.uid(), organization_id) OR user_id = auth.uid()
);

CREATE POLICY "Owners and Admins can update member roles"
ON public.organization_members FOR UPDATE
USING (
  public.is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Owners, Admins or self can remove members"
ON public.organization_members FOR DELETE
USING (
  public.is_org_admin(auth.uid(), organization_id) OR user_id = auth.uid()
);

-- 3. Organization Invitations Policies
CREATE POLICY "Members can view invitations of their organization"
ON public.organization_invitations FOR SELECT
USING (
  public.is_org_member(auth.uid(), organization_id) OR public.is_invitation_recipient(email, auth.uid())
);

CREATE POLICY "Owners and Admins can create invitations"
ON public.organization_invitations FOR INSERT
WITH CHECK (
  public.is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Owners and Admins can delete invitations"
ON public.organization_invitations FOR DELETE
USING (
  public.is_org_admin(auth.uid(), organization_id)
);

-- 4. Organization Files Policies
CREATE POLICY "Members can view org files"
ON public.organization_files FOR SELECT
USING (
  public.is_org_member(auth.uid(), organization_id)
);

CREATE POLICY "Members can upload org files"
ON public.organization_files FOR INSERT
WITH CHECK (
  public.is_org_member(auth.uid(), organization_id) AND uploaded_by = auth.uid()
);

CREATE POLICY "Owners and Admins or uploader can update org files"
ON public.organization_files FOR UPDATE
USING (
  public.is_org_admin(auth.uid(), organization_id) OR uploaded_by = auth.uid()
);

CREATE POLICY "Owners and Admins or uploader can delete org files"
ON public.organization_files FOR DELETE
USING (
  public.is_org_admin(auth.uid(), organization_id) OR uploaded_by = auth.uid()
);

-- ====================================================================
-- RLS POLICIES FOR SHARED PROJECTS & CONVERSATIONS
-- ====================================================================

-- Ensure project RLS accounts for organization membership
DROP POLICY IF EXISTS "Users can view org projects" ON public.projects;
CREATE POLICY "Users can view org projects"
ON public.projects FOR SELECT
USING (
  user_id = auth.uid() OR
  (
    organization_id IS NOT NULL AND
    public.is_org_member(auth.uid(), organization_id)
  )
);

DROP POLICY IF EXISTS "Users can create org projects if admin or owner or member" ON public.projects;
CREATE POLICY "Users can create org projects if admin or owner or member"
ON public.projects FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND (
    organization_id IS NULL OR
    public.is_org_member(auth.uid(), organization_id)
  )
);

-- Ensure conversations RLS accounts for organization membership
DROP POLICY IF EXISTS "Users can view org conversations" ON public.conversations;
CREATE POLICY "Users can view org conversations"
ON public.conversations FOR SELECT
USING (
  user_id = auth.uid() OR
  (
    organization_id IS NOT NULL AND
    public.is_org_member(auth.uid(), organization_id)
  )
);
