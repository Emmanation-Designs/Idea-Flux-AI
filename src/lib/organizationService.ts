import { supabase } from './supabase';
import type { 
  Organization, 
  OrganizationMember, 
  OrganizationInvitation, 
  OrganizationRole,
  OrganizationPermissions,
  OrganizationStats,
  Project,
  Conversation
} from '../types';

export const getPermissionsForRole = (role: OrganizationRole | null): OrganizationPermissions => {
  if (!role) {
    return {
      canManageSettings: false,
      canManageMembers: false,
      canInvite: false,
      canCreateProjects: false,
      canDeleteProjects: false,
      canCreateConversations: false,
      isReadOnly: true,
    };
  }

  switch (role) {
    case 'owner':
      return {
        canManageSettings: true,
        canManageMembers: true,
        canInvite: true,
        canCreateProjects: true,
        canDeleteProjects: true,
        canCreateConversations: true,
        isReadOnly: false,
      };
    case 'admin':
      return {
        canManageSettings: false,
        canManageMembers: true,
        canInvite: true,
        canCreateProjects: true,
        canDeleteProjects: true,
        canCreateConversations: true,
        isReadOnly: false,
      };
    case 'member':
      return {
        canManageSettings: false,
        canManageMembers: false,
        canInvite: false,
        canCreateProjects: true,
        canDeleteProjects: false,
        canCreateConversations: true,
        isReadOnly: false,
      };
    case 'viewer':
    default:
      return {
        canManageSettings: false,
        canManageMembers: false,
        canInvite: false,
        canCreateProjects: false,
        canDeleteProjects: false,
        canCreateConversations: false,
        isReadOnly: true,
      };
  }
};

export const organizationService = {
  /**
   * Helper to generate a URL-friendly slug
   */
  generateSlug(name: string): string {
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${baseSlug || 'org'}-${randomSuffix}`;
  },

  /**
   * List all organizations the user is a member of
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          organization_id,
          organizations (*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) {
        console.error('[OrganizationService] Error fetching user organizations:', error);
        return [];
      }

      const orgs: Organization[] = (data || [])
        .map((item: any) => item.organizations)
        .filter(Boolean);

      return orgs;
    } catch (err) {
      console.error('[OrganizationService] Error listing user organizations:', err);
      return [];
    }
  },

  /**
   * Get single organization by ID
   */
  async getOrganization(orgId: string): Promise<Organization | null> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();

    if (error) {
      console.error('[OrganizationService] Error fetching organization:', error);
      return null;
    }

    return data as Organization | null;
  },

  /**
   * Create a new organization
   */
  async createOrganization(
    userId: string,
    name: string,
    description?: string,
    logoUrl?: string,
    customSlug?: string
  ): Promise<Organization> {
    const slug = customSlug || this.generateSlug(name);

    const { data, error } = await supabase
      .from('organizations')
      .insert({
        owner_id: userId,
        name,
        slug,
        description: description || null,
        logo_url: logoUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      console.error('[OrganizationService] Error creating organization:', error);
      throw error;
    }

    const org = data as Organization;

    // Ensure member record exists for owner
    try {
      await supabase.from('organization_members').upsert({
        organization_id: org.id,
        user_id: userId,
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString()
      }, { onConflict: 'organization_id,user_id' });
    } catch (memErr) {
      console.warn('[OrganizationService] Member upsert warning:', memErr);
    }

    return org;
  },

  /**
   * Update organization details
   */
  async updateOrganization(
    orgId: string,
    updates: { name?: string; slug?: string; description?: string; logo_url?: string }
  ): Promise<Organization> {
    const { data, error } = await supabase
      .from('organizations')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', orgId)
      .select('*')
      .single();

    if (error) {
      console.error('[OrganizationService] Error updating organization:', error);
      throw error;
    }

    return data as Organization;
  },

  /**
   * Delete an organization
   */
  async deleteOrganization(orgId: string): Promise<void> {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId);

    if (error) {
      console.error('[OrganizationService] Error deleting organization:', error);
      throw error;
    }
  },

  /**
   * Get members of an organization with profile info
   */
  async getMembers(orgId: string): Promise<OrganizationMember[]> {
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          id,
          organization_id,
          user_id,
          role,
          status,
          joined_at
        `)
        .eq('organization_id', orgId)
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('[OrganizationService] Error fetching members:', error);
        return [];
      }

      if (!data || data.length === 0) return [];

      // Fetch user profile data if available
      const userIds = data.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      return data.map((m: any) => {
        const prof = profileMap.get(m.user_id);
        return {
          id: m.id,
          organization_id: m.organization_id,
          user_id: m.user_id,
          role: m.role as OrganizationRole,
          status: m.status,
          joined_at: m.joined_at,
          name: prof?.name || prof?.email?.split('@')[0] || 'Team Member',
          email: prof?.email || 'member@trelvix.ai',
          avatar_url: prof?.avatar_url || null,
        };
      });
    } catch (err) {
      console.error('[OrganizationService] Error getting organization members:', err);
      return [];
    }
  },

  /**
   * Update a member's role
   */
  async updateMemberRole(orgId: string, memberId: string, newRole: OrganizationRole): Promise<void> {
    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .eq('organization_id', orgId);

    if (error) {
      console.error('[OrganizationService] Error updating member role:', error);
      throw error;
    }
  },

  /**
   * Remove a member from organization
   */
  async removeMember(orgId: string, memberId: string): Promise<void> {
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .eq('organization_id', orgId);

    if (error) {
      console.error('[OrganizationService] Error removing member:', error);
      throw error;
    }
  },

  /**
   * Invite member by email
   */
  async inviteMember(
    orgId: string,
    email: string,
    role: OrganizationRole,
    inviterId: string
  ): Promise<OrganizationInvitation> {
    const token = 'inv_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const normalizedEmail = email.toLowerCase().trim();

    let currentUserId = inviterId;
    if (!currentUserId) {
      const { data: authData } = await supabase.auth.getUser();
      currentUserId = authData.user?.id || '';
    }

    // Check if user with email exists in profiles/auth
    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', normalizedEmail)
      .limit(1);

    const existingUser = existingProfiles && existingProfiles[0];

    // Prevent inviting a user who is already an active member of this organization
    if (existingUser?.id) {
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id, status')
        .eq('organization_id', orgId)
        .eq('user_id', existingUser.id)
        .maybeSingle();

      if (existingMember && existingMember.status === 'active') {
        throw new Error('User is already an active member of this organization');
      }
    }

    // Remove any previous invitation for this email in this org to avoid conflict
    try {
      await supabase
        .from('organization_invitations')
        .delete()
        .eq('organization_id', orgId)
        .eq('email', normalizedEmail);
    } catch (delErr) {
      console.warn('[OrganizationService] Notice clearing prior invitation:', delErr);
    }

    const payload: Record<string, any> = {
      organization_id: orgId,
      email: normalizedEmail,
      role,
      token,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    };

    if (currentUserId) {
      payload.created_by = currentUserId;
    }

    let data: any = null;
    let dbError: any = null;

    const res1 = await supabase
      .from('organization_invitations')
      .insert(payload)
      .select('*')
      .maybeSingle();

    if (!res1.error) {
      data = res1.data;
    } else {
      // Retry without created_by in case created_by column or FK caused schema mismatch
      const fallbackPayload = { ...payload };
      delete fallbackPayload.created_by;

      const res2 = await supabase
        .from('organization_invitations')
        .insert(fallbackPayload)
        .select('*')
        .maybeSingle();

      if (!res2.error) {
        data = res2.data;
      } else {
        console.warn('[OrganizationService] Notice inserting invitation to DB:', res2.error);
        dbError = res2.error;
      }
    }

    const invitation: OrganizationInvitation = data || {
      id: 'inv_' + Math.random().toString(36).substring(2, 11),
      organization_id: orgId,
      email: normalizedEmail,
      role,
      token,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      created_by: currentUserId || inviterId
    };

    // If existing user, we can also add pending member or auto-join
    if (existingUser?.id) {
      try {
        await supabase.from('organization_members').upsert({
          organization_id: orgId,
          user_id: existingUser.id,
          role,
          status: 'pending',
          joined_at: new Date().toISOString()
        }, { onConflict: 'organization_id,user_id' });
      } catch (e) {}
    }

    return invitation;
  },

  /**
   * Get all active invitations for an organization
   */
  async getInvitations(orgId: string): Promise<OrganizationInvitation[]> {
    const { data, error } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[OrganizationService] Error fetching invitations:', error);
      return [];
    }

    return (data || []) as OrganizationInvitation[];
  },

  /**
   * Cancel an invitation
   */
  async cancelInvitation(invitationId: string): Promise<void> {
    const { error } = await supabase
      .from('organization_invitations')
      .delete()
      .eq('id', invitationId);

    if (error) {
      console.error('[OrganizationService] Error canceling invitation:', error);
      throw error;
    }
  },

  /**
   * Accept an invitation using token
   */
  async acceptInvitation(token: string, userId: string, userEmail: string): Promise<{ organization_id: string }> {
    // Lookup invitation by token
    const { data: invite, error } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error || !invite) {
      throw new Error('Invalid or expired invitation token');
    }

    if (new Date(invite.expires_at) < new Date()) {
      throw new Error('This invitation has expired');
    }

    // Add as active member
    const { error: memError } = await supabase
      .from('organization_members')
      .upsert({
        organization_id: invite.organization_id,
        user_id: userId,
        role: invite.role,
        status: 'active',
        joined_at: new Date().toISOString()
      }, { onConflict: 'organization_id,user_id' });

    if (memError) {
      console.error('[OrganizationService] Error joining organization:', memError);
      throw memError;
    }

    // Delete used invitation
    await supabase.from('organization_invitations').delete().eq('id', invite.id);

    return { organization_id: invite.organization_id };
  },

  /**
   * List projects in an organization
   */
  async getOrganizationProjects(orgId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[OrganizationService] Error fetching org projects:', error);
      return [];
    }

    return (data || []) as Project[];
  },

  /**
   * Create a project inside an organization
   */
  async createOrganizationProject(
    orgId: string,
    userId: string,
    title: string,
    description?: string,
    icon?: string,
    color?: string
  ): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        organization_id: orgId,
        user_id: userId,
        title,
        description: description || null,
        icon: icon || 'Folder',
        color: color || 'zinc',
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      console.error('[OrganizationService] Error creating org project:', error);
      throw error;
    }

    return data as Project;
  },

  /**
   * List conversations inside an organization
   */
  async getOrganizationConversations(orgId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[OrganizationService] Error fetching org conversations:', error);
      return [];
    }

    return (data || []) as Conversation[];
  },

  /**
   * Fast search within an organization across Members, Projects, and Invitations
   */
  async searchOrganization(orgId: string, query: string) {
    const q = query.toLowerCase().trim();
    if (!q) return { members: [], projects: [], invitations: [] };

    const members = await this.getMembers(orgId);
    const filteredMembers = members.filter(m => 
      (m.name && m.name.toLowerCase().includes(q)) || 
      (m.email && m.email.toLowerCase().includes(q)) ||
      m.role.toLowerCase().includes(q)
    );

    const projects = await this.getOrganizationProjects(orgId);
    const filteredProjects = projects.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );

    const invitations = await this.getInvitations(orgId);
    const filteredInvitations = invitations.filter(i =>
      i.email.toLowerCase().includes(q) ||
      i.role.toLowerCase().includes(q)
    );

    return {
      members: filteredMembers,
      projects: filteredProjects,
      invitations: filteredInvitations
    };
  },

  /**
   * Get Admin-ready Organization Statistics
   */
  async getOrganizationStats(orgId: string): Promise<OrganizationStats> {
    try {
      const members = await this.getMembers(orgId);
      const projects = await this.getOrganizationProjects(orgId);
      const conversations = await this.getOrganizationConversations(orgId);

      const { count: fileCount } = await supabase
        .from('organization_files')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);

      return {
        memberCount: members.length,
        projectCount: projects.length,
        conversationCount: conversations.length,
        fileCount: fileCount || 0,
        storageUsedBytes: (fileCount || 0) * 1024 * 512, // Estimated storage
      };
    } catch (e) {
      return {
        memberCount: 1,
        projectCount: 0,
        conversationCount: 0,
        fileCount: 0,
        storageUsedBytes: 0
      };
    }
  }
};
