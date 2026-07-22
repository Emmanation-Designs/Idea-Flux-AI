import React, { useState, useEffect } from 'react';
import { Building2, CheckCircle2, ShieldCheck, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { useOrganization } from '../context/OrganizationContext';
import { organizationService } from '../lib/organizationService';
import type { OrganizationInvitation } from '../types';
import { toast } from 'sonner';

interface AcceptInvitationViewProps {
  token: string;
  onComplete: () => void;
}

export const AcceptInvitationView: React.FC<AcceptInvitationViewProps> = ({ token, onComplete }) => {
  const { acceptInvitation } = useOrganization();
  const [invite, setInvite] = useState<OrganizationInvitation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadInvite() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/organizations/invitations/${token}`);
        if (res.ok) {
          const data = await res.json();
          if (active && data.invitation) {
            setInvite(data.invitation);
          }
        } else {
          // Fallback direct check
          const data = await organizationService.acceptInvitation(token, '', '');
        }
      } catch (err: any) {
        if (active) setErrorMsg('Invalid or expired invitation token');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadInvite();
    return () => { active = false; };
  }, [token]);

  const handleAccept = async () => {
    try {
      setIsJoining(true);
      const success = await acceptInvitation(token);
      if (success) {
        onComplete();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept invitation');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-6 text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center text-2xl font-black shadow-lg">
          <Building2 className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {invite ? `Join ${invite.organization_name || 'Organization'}` : 'Team Invitation'}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            You've been invited to collaborate as an <span className="font-bold text-zinc-800 dark:text-zinc-200 uppercase">{invite?.role || 'Member'}</span>.
          </p>
        </div>

        {errorMsg ? (
          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium">
            {errorMsg}
          </div>
        ) : (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-left space-y-2 text-xs">
            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
              <span>Invited Email:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{invite?.email || 'Your Email'}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
              <span>Assigned Role:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 capitalize">{invite?.role || 'Member'}</span>
            </div>
          </div>
        )}

        <div className="pt-2 flex items-center gap-3">
          <button
            onClick={onComplete}
            className="flex-1 py-2.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={handleAccept}
            disabled={isJoining || !!errorMsg}
            className="flex-1 py-2.5 text-xs font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isJoining ? 'Joining...' : 'Accept Invitation'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
