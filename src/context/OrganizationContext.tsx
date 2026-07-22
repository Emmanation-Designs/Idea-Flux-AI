import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { 
  Organization, 
  OrganizationMember, 
  OrganizationInvitation, 
  OrganizationRole,
  OrganizationPermissions,
  Workspace,
  WorkspaceType
} from '../types';
import { organizationService, getPermissionsForRole } from '../lib/organizationService';
import { toast } from 'sonner';

interface OrganizationContextType {
  currentWorkspace: Workspace;
  userOrganizations: Organization[];
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
  currentRole: OrganizationRole | null;
  permissions: OrganizationPermissions;
  isLoading: boolean;
  switchWorkspace: (workspace: Workspace) => void;
  refreshOrganizations: () => Promise<void>;
  refreshMembersAndInvitations: () => Promise<void>;
  createOrganization: (name: string, description?: string, logoUrl?: string) => Promise<Organization | null>;
  updateOrganization: (updates: { name?: string; slug?: string; description?: string; logo_url?: string }) => Promise<void>;
  deleteOrganization: () => Promise<void>;
  inviteMember: (email: string, role: OrganizationRole) => Promise<boolean>;
  updateMemberRole: (memberId: string, role: OrganizationRole) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  cancelInvitation: (invitationId: string) => Promise<void>;
  acceptInvitation: (token: string) => Promise<boolean>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{
  userId: string | undefined;
  userEmail?: string;
  children: React.ReactNode;
}> = ({ userId, userEmail, children }) => {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace>({
    type: 'personal',
    organization: null
  });
  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [currentRole, setCurrentRole] = useState<OrganizationRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load user organizations
  const refreshOrganizations = useCallback(async () => {
    if (!userId) {
      setUserOrganizations([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const orgs = await organizationService.getUserOrganizations(userId);
      setUserOrganizations(orgs);

      // If user is in an org workspace, verify org still exists or update reference
      if (currentWorkspace.type === 'organization' && currentWorkspace.organization) {
        const found = orgs.find(o => o.id === currentWorkspace.organization?.id);
        if (found) {
          setCurrentWorkspace({ type: 'organization', organization: found });
        } else {
          // Fall back to personal workspace if org no longer accessible
          setCurrentWorkspace({ type: 'personal', organization: null });
        }
      }
    } catch (error) {
      console.error('[OrganizationProvider] Error loading organizations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, currentWorkspace.type, currentWorkspace.organization?.id]);

  // Load members & invitations for active organization
  const refreshMembersAndInvitations = useCallback(async () => {
    if (currentWorkspace.type !== 'organization' || !currentWorkspace.organization) {
      setMembers([]);
      setInvitations([]);
      setCurrentRole(null);
      return;
    }

    const orgId = currentWorkspace.organization.id;

    try {
      const [mList, iList] = await Promise.all([
        organizationService.getMembers(orgId),
        organizationService.getInvitations(orgId)
      ]);

      setMembers(mList);
      setInvitations(iList);

      // Determine user's role in active org
      if (userId) {
        const userMem = mList.find(m => m.user_id === userId);
        if (userMem) {
          setCurrentRole(userMem.role);
        } else if (currentWorkspace.organization.owner_id === userId) {
          setCurrentRole('owner');
        } else {
          setCurrentRole('member');
        }
      }
    } catch (error) {
      console.error('[OrganizationProvider] Error refreshing org members:', error);
    }
  }, [currentWorkspace, userId]);

  useEffect(() => {
    refreshOrganizations();
  }, [userId]);

  useEffect(() => {
    refreshMembersAndInvitations();
  }, [currentWorkspace.type, currentWorkspace.organization?.id, refreshMembersAndInvitations]);

  // Switch workspace instantly without page refresh
  const switchWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    if (workspace.type === 'personal') {
      setCurrentRole(null);
      toast.success('Switched to Personal Workspace');
    } else if (workspace.organization) {
      toast.success(`Switched to ${workspace.organization.name}`);
    }
  };

  // Create organization
  const createOrganization = async (name: string, description?: string, logoUrl?: string) => {
    if (!userId) {
      toast.error('You must be logged in to create an organization');
      return null;
    }

    try {
      const newOrg = await organizationService.createOrganization(userId, name, description, logoUrl);
      toast.success(`Organization "${name}" created successfully!`);
      
      await refreshOrganizations();
      
      // Auto-switch to newly created organization
      switchWorkspace({
        type: 'organization',
        organization: newOrg
      });

      return newOrg;
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast.error(error.message || 'Failed to create organization');
      return null;
    }
  };

  // Update organization
  const updateOrganization = async (updates: { name?: string; slug?: string; description?: string; logo_url?: string }) => {
    if (currentWorkspace.type !== 'organization' || !currentWorkspace.organization) return;

    try {
      const updatedOrg = await organizationService.updateOrganization(currentWorkspace.organization.id, updates);
      setCurrentWorkspace({
        type: 'organization',
        organization: updatedOrg
      });
      toast.success('Organization settings updated');
      await refreshOrganizations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update organization');
    }
  };

  // Delete organization
  const deleteOrganization = async () => {
    if (currentWorkspace.type !== 'organization' || !currentWorkspace.organization) return;

    const orgName = currentWorkspace.organization.name;
    const orgId = currentWorkspace.organization.id;

    try {
      await organizationService.deleteOrganization(orgId);
      toast.success(`Organization "${orgName}" deleted`);

      // Switch back to personal workspace
      switchWorkspace({ type: 'personal', organization: null });
      await refreshOrganizations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete organization');
    }
  };

  // Invite member
  const inviteMember = async (email: string, role: OrganizationRole) => {
    if (currentWorkspace.type !== 'organization' || !currentWorkspace.organization || !userId) return false;

    try {
      await organizationService.inviteMember(currentWorkspace.organization.id, email, role, userId);
      toast.success(`Invitation sent to ${email}`);
      await refreshMembersAndInvitations();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
      return false;
    }
  };

  // Update member role
  const updateMemberRole = async (memberId: string, role: OrganizationRole) => {
    if (currentWorkspace.type !== 'organization' || !currentWorkspace.organization) return;

    try {
      await organizationService.updateMemberRole(currentWorkspace.organization.id, memberId, role);
      toast.success('Member role updated');
      await refreshMembersAndInvitations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update member role');
    }
  };

  // Remove member
  const removeMember = async (memberId: string) => {
    if (currentWorkspace.type !== 'organization' || !currentWorkspace.organization) return;

    try {
      await organizationService.removeMember(currentWorkspace.organization.id, memberId);
      toast.success('Member removed');
      await refreshMembersAndInvitations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member');
    }
  };

  // Cancel invitation
  const cancelInvitation = async (invitationId: string) => {
    try {
      await organizationService.cancelInvitation(invitationId);
      toast.success('Invitation canceled');
      await refreshMembersAndInvitations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel invitation');
    }
  };

  // Accept invitation
  const acceptInvitation = async (token: string) => {
    if (!userId || !userEmail) {
      toast.error('You must be signed in to accept an invitation');
      return false;
    }

    try {
      const { organization_id } = await organizationService.acceptInvitation(token, userId, userEmail);
      toast.success('You have joined the organization!');
      await refreshOrganizations();
      
      const joinedOrg = await organizationService.getOrganization(organization_id);
      if (joinedOrg) {
        switchWorkspace({ type: 'organization', organization: joinedOrg });
      }

      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept invitation');
      return false;
    }
  };

  // Computed permissions
  const permissions = getPermissionsForRole(currentRole);

  return (
    <OrganizationContext.Provider
      value={{
        currentWorkspace,
        userOrganizations,
        members,
        invitations,
        currentRole,
        permissions,
        isLoading,
        switchWorkspace,
        refreshOrganizations,
        refreshMembersAndInvitations,
        createOrganization,
        updateOrganization,
        deleteOrganization,
        inviteMember,
        updateMemberRole,
        removeMember,
        cancelInvitation,
        acceptInvitation
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
