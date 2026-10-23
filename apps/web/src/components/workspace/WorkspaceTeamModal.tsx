import { useState } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  Check,
  X,
  Crown,
  Link,
} from 'lucide-react';

export interface WorkspaceMember {
  userId: string;
  name: string;
  email: string;
  roleName: 'owner' | 'admin' | 'member' | 'viewer';
  avatar?: string;
  invitedAt: string;
}

export const INITIAL_WORKSPACE_MEMBERS: WorkspaceMember[] = [
  {
    userId: 'user-1',
    name: 'Novin Tri Antonius',
    email: 'novin@vintrix.io',
    roleName: 'owner',
    invitedAt: '3 days ago',
  },
  {
    userId: 'user-2',
    name: 'Sarah Connor',
    email: 'sarah.c@cyberdyne.dev',
    roleName: 'admin',
    invitedAt: 'Yesterday',
  },
  {
    userId: 'user-3',
    name: 'Alex Rivera',
    email: 'alex@distributed.systems',
    roleName: 'member',
    invitedAt: '4 hours ago',
  },
];

interface WorkspaceTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
  members: WorkspaceMember[];
  onInviteMember: (email: string, roleName: 'admin' | 'member' | 'viewer') => void;
  onUpdateRole: (userId: string, newRole: 'admin' | 'member' | 'viewer') => void;
  onRemoveMember: (userId: string) => void;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Full workspace ownership, billing & destructive actions',
  admin: 'Manage sources, team invites, and AI models',
  member: 'Query knowledge graph and chat with AI copilot',
  viewer: 'Read-only access to knowledge graph visualization',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  admin: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  member: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  viewer: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
};

export function WorkspaceTeamModal({
  isOpen,
  onClose,
  workspaceName,
  members,
  onInviteMember,
  onUpdateRole,
  onRemoveMember,
}: WorkspaceTeamModalProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [copiedLink, setCopiedLink] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  if (!isOpen) return null;

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/join?ws=${encodeURIComponent(workspaceName)}&token=inv_${Date.now()}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    onInviteMember(inviteEmail.trim(), inviteRole);
    setInviteEmail('');
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(filterQuery.toLowerCase()) ||
      m.roleName.toLowerCase().includes(filterQuery.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#080d16] border border-white/[0.08] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Users size={18} className="text-sky-400" />
              Workspace Team & Collaboration
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage collaborators and role permissions for <span className="text-slate-200 font-medium">{workspaceName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Invite Input Box */}
          <form
            onSubmit={handleSendInvite}
            className="p-4 bg-[#050912] border border-white/[0.06] rounded-xl space-y-3"
          >
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <UserPlus size={14} className="text-sky-400" />
              <span>Invite New Collaborator</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Mail
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="collaborator@company.com"
                  className="w-full bg-[#080d16] border border-white/[0.08] focus:border-sky-500/50 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition-colors"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')
                  }
                  className="bg-[#080d16] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none capitalize"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors shrink-0"
                >
                  Send Invite
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                {ROLE_DESCRIPTIONS[inviteRole]}
              </span>
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="flex items-center gap-1 text-[11px] font-mono text-sky-400 hover:text-sky-300 transition-colors"
              >
                {copiedLink ? <Check size={12} /> : <Link size={12} />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
              </button>
            </div>
          </form>

          {/* Members List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="font-semibold text-slate-200 flex items-center gap-2">
                <span>Active Collaborators</span>
                <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] font-mono text-slate-400">
                  {members.length}
                </span>
              </div>
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter members..."
                className="bg-[#050912] border border-white/[0.06] rounded-md px-2.5 py-1 text-[11px] text-slate-300 placeholder-slate-500 outline-none w-36"
              />
            </div>

            <div className="space-y-2">
              {filteredMembers.map((member) => {
                const isOwner = member.roleName === 'owner';
                const roleBadgeClass = ROLE_COLORS[member.roleName] || ROLE_COLORS.viewer;

                return (
                  <div
                    key={member.userId}
                    className="p-3 bg-[#050912] border border-white/[0.06] hover:border-white/[0.1] rounded-xl flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600/40 to-purple-600/40 border border-white/10 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0">
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-200 truncate">
                            {member.name}
                          </span>
                          {isOwner && (
                            <Crown size={12} className="text-amber-400 shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 truncate">
                          {member.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOwner ? (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${roleBadgeClass}`}
                        >
                          Owner
                        </span>
                      ) : (
                        <select
                          value={member.roleName}
                          onChange={(e) =>
                            onUpdateRole(
                              member.userId,
                              e.target.value as 'admin' | 'member' | 'viewer',
                            )
                          }
                          className={`px-2 py-1 rounded text-[10px] font-mono uppercase bg-[#080d16] border border-white/[0.08] focus:border-sky-500/50 outline-none cursor-pointer ${roleBadgeClass}`}
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}

                      {!isOwner && (
                        <button
                          type="button"
                          onClick={() => onRemoveMember(member.userId)}
                          title="Remove collaborator from workspace"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.08] bg-[#050912]/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <Shield size={14} className="text-sky-400" />
            <span>Role-Based Access Control (RBAC) enforced</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
