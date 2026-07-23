import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  Mail, 
  ShieldCheck, 
  AlertTriangle, 
  Search, 
  UserPlus, 
  Trash2, 
  RotateCcw, 
  Check, 
  ArrowLeft,
  ChevronRight,
  Globe,
  Crown,
  Shield,
  User,
  Eye,
  Clock,
  Sparkles,
  BarChart2,
  Copy,
  Link,
  CheckCircle2
} from 'lucide-react';
import { useOrganization } from '../context/OrganizationContext';
import { organizationService } from '../lib/organizationService';
import type { OrganizationRole, OrganizationStats } from '../types';
import { toast } from 'sonner';

interface OrganizationSettingsProps {
  onBack: () => void;
  userId?: string;
}

export const OrganizationSettings: React.FC<OrganizationSettingsProps> = ({ onBack, userId }) => {
  const { 
    currentWorkspace, 
    members, 
    invitations, 
    currentRole, 
    permissions,
    updateOrganization, 
    deleteOrganization,
    inviteMember,
    updateMemberRole,
    removeMember,
    cancelInvitation,
    refreshMembersAndInvitations
  } = useOrganization();

  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'invitations' | 'permissions' | 'danger'>('general');
  const org = currentWorkspace.organization;

  // General Form State
  const [name, setName] = useState(org?.name || '');
  const [slug, setSlug] = useState(org?.slug || '');
  const [description, setDescription] = useState(org?.description || '');
  const [logoUrl, setLogoUrl] = useState(org?.logo_url || '');
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  // Members Search State
  const [memberSearch, setMemberSearch] = useState('');

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [createdInviteLink, setCreatedInviteLink] = useState<{ email: string; link: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = (token: string, inviteId?: string) => {
    const link = `${window.location.origin}/?token=${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Invitation link copied to clipboard!');
    if (inviteId) {
      setCopiedId(inviteId);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  // Stats State
  const [stats, setStats] = useState<OrganizationStats | null>(null);

  useEffect(() => {
    if (org) {
      setName(org.name || '');
      setSlug(org.slug || '');
      setDescription(org.description || '');
      setLogoUrl(org.logo_url || '');
      organizationService.getOrganizationStats(org.id).then(setStats);
    }
  }, [org?.id]);

  if (currentWorkspace.type !== 'organization' || !org) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Building2 className="w-12 h-12 text-zinc-400 mb-3" />
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">No Active Organization</h2>
        <p className="text-sm text-zinc-500 mb-4">Select or create an organization workspace to view settings.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-xl"
        >
          Return to App
        </button>
      </div>
    );
  }

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.canManageSettings) {
      toast.error('Only Owners and Admins can manage organization settings');
      return;
    }

    try {
      setIsSavingGeneral(true);
      await updateOrganization({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        logo_url: logoUrl.trim() || undefined
      });
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.canInvite) {
      toast.error('You do not have permission to invite members');
      return;
    }

    if (!inviteEmail.trim()) return;

    try {
      setIsInviting(true);
      const res = await inviteMember(inviteEmail.trim().toLowerCase(), inviteRole);
      if (res) {
        const invToken = typeof res === 'object' && res?.token ? res.token : '';
        if (invToken) {
          const generatedLink = `${window.location.origin}/?token=${invToken}`;
          setCreatedInviteLink({ email: inviteEmail.trim(), link: generatedLink });
          try {
            await navigator.clipboard.writeText(generatedLink);
            toast.success('Invite link created & copied to clipboard!');
          } catch (e) {
            toast.success('Invite link created!');
          }
        }
        setInviteEmail('');
      }
    } finally {
      setIsInviting(false);
    }
  };

  const filteredMembers = members.filter(m => 
    (m.name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
    (m.email || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.role.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const getRoleIcon = (role: OrganizationRole) => {
    switch (role) {
      case 'owner': return <Crown className="w-3.5 h-3.5 text-amber-500" />;
      case 'admin': return <Shield className="w-3.5 h-3.5 text-blue-500" />;
      case 'member': return <User className="w-3.5 h-3.5 text-emerald-500" />;
      case 'viewer': return <Eye className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950 overflow-y-auto">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold flex items-center justify-center text-lg shadow-sm">
              {org.logo_url ? (
                <img src={org.logo_url} alt={org.name} className="w-full h-full rounded-xl object-cover" />
              ) : (
                org.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                {org.name}
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  {currentRole || 'Member'}
                </span>
              </h1>
              <p className="text-xs text-zinc-500 font-mono">trelvix.ai/org/{org.slug}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats Pill */}
        {stats && (
          <div className="hidden md:flex items-center gap-4 px-3.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-xs">
            <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
              <Users className="w-3.5 h-3.5" />
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{stats.memberCount}</span> members
            </div>
            <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700" />
            <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
              <BarChart2 className="w-3.5 h-3.5" />
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{stats.projectCount}</span> projects
            </div>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="max-w-5xl w-full mx-auto p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto pb-1">
          {[
            { id: 'general', label: 'General', icon: Building2 },
            { id: 'members', label: `Members (${members.length})`, icon: Users },
            { id: 'invitations', label: `Invitations (${invitations.length})`, icon: Mail },
            { id: 'permissions', label: 'Permissions', icon: ShieldCheck },
            { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, danger: true },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                  isActive
                    ? tab.danger
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400 font-bold'
                      : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: General */}
        {activeTab === 'general' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">General Information</h2>
              <p className="text-xs text-zinc-500">Update your team branding and organization identifier.</p>
            </div>

            <form onSubmit={handleSaveGeneral} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!permissions.canManageSettings}
                  className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-white disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Organization Slug
                </label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  disabled={!permissions.canManageSettings}
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-white disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!permissions.canManageSettings}
                  placeholder="Team bio or purpose"
                  className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-white resize-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Logo Image URL
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  disabled={!permissions.canManageSettings}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-white disabled:opacity-60"
                />
              </div>

              {permissions.canManageSettings && (
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSavingGeneral}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl shadow-sm transition-all"
                  >
                    {isSavingGeneral ? 'Saving Changes...' : 'Save General Settings'}
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Tab 2: Members */}
        {activeTab === 'members' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Team Members</h2>
                <p className="text-xs text-zinc-500">Manage permissions, roles, and member accounts.</p>
              </div>

              {/* Search input */}
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search members..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
            </div>

            {/* Members List */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
              {filteredMembers.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">No members found</div>
              ) : (
                filteredMembers.map((member) => {
                  const isOwner = member.role === 'owner';
                  const isSelf = member.user_id === userId;

                  return (
                    <div key={member.id} className="p-4 flex items-center justify-between gap-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 font-bold text-xs flex items-center justify-center text-zinc-700 dark:text-zinc-300 uppercase shrink-0">
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt={member.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            (member.name || 'M').charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                              {member.name}
                            </span>
                            {isSelf && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-500 truncate block">{member.email}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Role selector or badge */}
                        {permissions.canManageMembers && !isOwner && !isSelf ? (
                          <select
                            value={member.role}
                            onChange={(e) => updateMemberRole(member.id, e.target.value as OrganizationRole)}
                            className="px-2.5 py-1 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none font-semibold text-zinc-800 dark:text-zinc-200"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 capitalize">
                            {getRoleIcon(member.role)}
                            <span>{member.role}</span>
                          </div>
                        )}

                        {/* Remove button */}
                        {permissions.canManageMembers && !isOwner && !isSelf && (
                          <button
                            onClick={() => removeMember(member.id)}
                            title="Remove Member"
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Invitations */}
        {activeTab === 'invitations' && (
          <div className="space-y-6">
            {/* Newly Created Invite Link Alert Banner */}
            {createdInviteLink && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Invitation Created for {createdInviteLink.email}</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 mt-0.5 font-mono text-[11px] truncate max-w-md">
                    {createdInviteLink.link}
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdInviteLink.link);
                    toast.success('Invite link copied!');
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-sm"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </button>
              </div>
            )}

            {/* Send Invite Form */}
            {permissions.canInvite && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Invite New Team Member</h2>
                  <p className="text-xs text-zinc-500">Create an invitation link to share with teammates or add them to your workspace.</p>
                </div>

                <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row items-center gap-3 max-w-2xl">
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="flex-1 w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-white"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
                    className="w-full sm:w-auto px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/70 rounded-xl font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isInviting || !inviteEmail.trim()}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl shadow-sm transition-all whitespace-nowrap"
                  >
                    {isInviting ? 'Creating...' : 'Create Invitation'}
                  </button>
                </form>
              </div>
            )}

            {/* Pending Invitations List */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Pending Invitations</h2>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
                {invitations.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500">No pending invitations</div>
                ) : (
                  invitations.map((invite) => (
                    <div key={invite.id} className="p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{invite.email}</span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {invite.role}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> Expires {new Date(invite.expires_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleCopyLink(invite.token, invite.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          {copiedId === invite.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === invite.id ? 'Copied!' : 'Copy Link'}</span>
                        </button>

                        {permissions.canInvite && (
                          <button
                            onClick={() => cancelInvitation(invite.id)}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Permissions Matrix */}
        {activeTab === 'permissions' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Role Permissions Overview</h2>
              <p className="text-xs text-zinc-500">Matrix of capabilities assigned to each role within Trelvix AI.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 font-bold">Capability</th>
                    <th className="py-3 px-4 font-bold text-center">Owner</th>
                    <th className="py-3 px-4 font-bold text-center">Admin</th>
                    <th className="py-3 px-4 font-bold text-center">Member</th>
                    <th className="py-3 px-4 font-bold text-center">Viewer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                  {[
                    { name: 'Manage Organization Settings', owner: true, admin: true, member: false, viewer: false },
                    { name: 'Manage & Remove Members', owner: true, admin: true, member: false, viewer: false },
                    { name: 'Invite Teammates', owner: true, admin: true, member: false, viewer: false },
                    { name: 'Create Shared Projects', owner: true, admin: true, member: true, viewer: false },
                    { name: 'Delete Shared Projects', owner: true, admin: true, member: false, viewer: false },
                    { name: 'Create Conversations & AI Prompts', owner: true, admin: true, member: true, viewer: false },
                    { name: 'View Projects & Conversations', owner: true, admin: true, member: true, viewer: true },
                  ].map((item, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="py-3.5 px-4 font-medium">{item.name}</td>
                      <td className="py-3.5 px-4 text-center">{item.owner ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : '—'}</td>
                      <td className="py-3.5 px-4 text-center">{item.admin ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : '—'}</td>
                      <td className="py-3.5 px-4 text-center">{item.member ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : '—'}</td>
                      <td className="py-3.5 px-4 text-center">{item.viewer ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Danger Zone */}
        {activeTab === 'danger' && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-bold text-red-600 dark:text-red-400">Danger Zone</h2>
              <p className="text-xs text-zinc-500">Irreversible actions regarding your organization workspace.</p>
            </div>

            {currentRole === 'owner' ? (
              <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-zinc-900 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Delete Organization</h3>
                  <p className="text-xs text-zinc-500 max-w-md">
                    Permanently delete {org.name} and remove all associated shared projects, conversations, and member access.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete "${org.name}"? This cannot be undone.`)) {
                      deleteOrganization();
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm shrink-0 transition-colors"
                >
                  Delete Organization
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-zinc-900 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Leave Organization</h3>
                  <p className="text-xs text-zinc-500 max-w-md">
                    Remove your account from {org.name}. You will lose access to all shared team projects.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const selfMember = members.find(m => m.user_id === userId);
                    if (selfMember && window.confirm(`Leave ${org.name}?`)) {
                      await removeMember(selfMember.id);
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl shrink-0 transition-colors"
                >
                  Leave Organization
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
