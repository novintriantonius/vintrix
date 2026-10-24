import { useState, useRef, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  Crown,
  Link,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Modal } from '../common';

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
  const [isInviteRoleOpen, setIsInviteRoleOpen] = useState(false);
  const [openMemberRoleId, setOpenMemberRoleId] = useState<string | null>(null);
  const inviteRoleRef = useRef<HTMLDivElement>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (inviteRoleRef.current && !inviteRoleRef.current.contains(e.target as Node)) {
        setIsInviteRoleOpen(false);
      }
      if (!((e.target as HTMLElement).closest?.('.member-role-dropdown'))) {
        setOpenMemberRoleId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    onInviteMember(inviteEmail.trim(), inviteRole);
    setInviteEmail('');
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(
      `https://app.vintrix.dev/invite?ws=${encodeURIComponent(workspaceName)}`,
    );
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(filterQuery.toLowerCase()) ||
      m.roleName.toLowerCase().includes(filterQuery.toLowerCase()),
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      icon={<Users size={18} />}
      title="Workspace Team & Collaboration"
      subtitle={
        <span>
          Manage collaborators and role permissions for{' '}
          <span className="text-slate-200 font-medium">{workspaceName}</span>
        </span>
      }
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
            <Shield size={14} className="text-sky-400 shrink-0" />
            <span>RBAC permissions enforced</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 transition-colors"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[60vh] overflow-y-auto">
        {/* Invite Form */}
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
              {/* Custom Invite Role Selector */}
              <div className="relative" ref={inviteRoleRef}>
                <button
                  type="button"
                  onClick={() => setIsInviteRoleOpen((prev) => !prev)}
                  className="h-full flex items-center gap-1.5 bg-[#080d16] border border-white/[0.08] hover:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none capitalize transition-colors"
                >
                  <span>{inviteRole}</span>
                  <ChevronDown size={13} className={`text-slate-400 transition-transform ${isInviteRoleOpen ? 'rotate-180' : ''}`} />
                </button>

                {isInviteRoleOpen && (
                  <div className="absolute left-0 top-full mt-1 w-32 bg-[#080d16] border border-white/[0.1] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5">
                    {(['admin', 'member', 'viewer'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setInviteRole(r);
                          setIsInviteRoleOpen(false);
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                          inviteRole === r
                            ? 'bg-sky-500/15 text-sky-300 font-semibold'
                            : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                        }`}
                      >
                        <span>{r}</span>
                        {inviteRole === r && <Check size={12} className="text-sky-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors shrink-0"
              >
                Send Invite
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">Or invite via a secure one-time link:</span>
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="text-[11px] text-sky-400 hover:text-sky-300 font-mono flex items-center gap-1 transition-colors"
            >
              {inviteCopied ? <Check size={12} /> : <Link size={12} />}
              <span>{inviteCopied ? 'Link Copied!' : 'Copy Invite Link'}</span>
            </button>
          </div>
        </form>

        {/* Member Directory */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Users size={14} className="text-slate-400" />
              <span>Workspace Members ({members.length})</span>
            </div>
            <input
              type="text"
              placeholder="Search members..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="bg-[#050912] border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs text-slate-300 placeholder-slate-500 outline-none w-44"
            />
          </div>

          <div className="space-y-2">
            {filteredMembers.map((member) => {
              const isOwner = member.roleName === 'owner';
              const roleBadgeClass = ROLE_COLORS[member.roleName] ?? ROLE_COLORS.viewer;

              return (
                <div
                  key={member.userId}
                  className="p-3 bg-[#050912] border border-white/[0.06] hover:border-white/[0.1] rounded-xl flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/[0.08] flex items-center justify-center text-xs font-medium text-slate-200 shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5 truncate">
                        <span className="truncate">{member.name}</span>
                        {isOwner && <Crown size={12} className="text-amber-400 shrink-0" />}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">
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
                      <div className="relative member-role-dropdown">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMemberRoleId((prev) =>
                              prev === member.userId ? null : member.userId,
                            )
                          }
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase bg-[#080d16] border border-white/[0.08] hover:border-sky-500/50 outline-none transition-colors ${roleBadgeClass}`}
                        >
                          <span>{member.roleName}</span>
                          <ChevronDown
                            size={10}
                            className={`transition-transform ${
                              openMemberRoleId === member.userId ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {openMemberRoleId === member.userId && (
                          <div className="absolute right-0 top-full mt-1 w-28 bg-[#080d16] border border-white/[0.1] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5">
                            {(['admin', 'member', 'viewer'] as const).map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => {
                                  onUpdateRole(member.userId, r);
                                  setOpenMemberRoleId(null);
                                }}
                                className={`flex items-center justify-between px-2 py-1 rounded text-[10px] font-mono uppercase transition-colors ${
                                  member.roleName === r
                                    ? 'bg-sky-500/15 text-sky-300 font-semibold'
                                    : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                                }`}
                              >
                                <span>{r}</span>
                                {member.roleName === r && <Check size={11} className="text-sky-400" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
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
    </Modal>
  );
}
