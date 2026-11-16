'use client';

import React, { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Megaphone, Trash2, Send, Globe2, Building2, Clock } from 'lucide-react';
import type { Announcement } from '@/types/cafe';

// Owner / branch-manager announcement board. Posts plain text cards that customers see on
// the home screen (web MarketingHome + mobile CustomerHome). Owner can target all branches or
// one branch; a manager always posts to their own branch (enforced server-side too).

const TAG_OPTIONS: Array<{ value: string; color: string }> = [
  { value: 'ANNOUNCEMENT', color: '#EF4444' },
  { value: 'NOTICE', color: '#2563EB' },
  { value: 'DEAL', color: '#16A34A' },
  { value: 'EVENT', color: '#9333EA' },
  { value: 'TIMINGS', color: '#EA580C' },
];

const colorForTag = (tag?: string, fallback?: string) =>
  TAG_OPTIONS.find((t) => t.value === (tag || '').toUpperCase())?.color || fallback || '#EF4444';

const formatPosted = (iso?: string) => {
  if (!iso) return 'Just now';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

export const AnnouncementsBoardScreen: React.FC = () => {
  const { announcements, addAnnouncement, deleteAnnouncement, branches, currentRole, currentUser, currentBranch } = useApp();

  const isOwner = currentRole === 'platform_owner';
  const managerBranchId = currentUser?.branchId || currentBranch?.id || '';

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [tag, setTag] = useState('ANNOUNCEMENT');
  const [validUntil, setValidUntil] = useState('');
  const [target, setTarget] = useState<string>(isOwner ? 'all' : managerBranchId);
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const branchName = (id?: string | null) =>
    !id ? 'All branches' : branches.find((b) => b.id === id)?.name || id;

  const visible = useMemo(() => {
    const list = isOwner
      ? announcements
      : announcements.filter((a) => !a.branchId || a.branchId === managerBranchId);
    return [...list].sort((a, b) => (new Date(b.createdAt || 0).getTime() || 0) - (new Date(a.createdAt || 0).getTime() || 0));
  }, [announcements, isOwner, managerBranchId]);

  const canDelete = (a: Announcement) => isOwner || (!!a.branchId && a.branchId === managerBranchId);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim() || posting) return;
    setPosting(true);
    const branchId = isOwner ? (target === 'all' ? undefined : target) : managerBranchId;
    const ok = await addAnnouncement({
      title: title.trim(),
      description: message.trim(),
      tag,
      badgeColor: colorForTag(tag),
      validUntil: validUntil.trim() || undefined,
      branchId,
      branchName: branchId ? branchName(branchId) : undefined,
    });
    setPosting(false);
    if (ok) {
      setTitle('');
      setMessage('');
      setValidUntil('');
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    if (typeof window !== 'undefined' && !window.confirm('Remove this announcement?')) return;
    setDeletingId(id);
    await deleteAnnouncement(id);
    setDeletingId(null);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    backgroundColor: '#FFFFFF',
    color: 'var(--text-main)',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    display: 'block',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Megaphone size={22} color="#EF4444" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>Announcements</h2>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {isOwner
              ? 'Post text announcements for all branches or a single branch. Customers see them on the home screen.'
              : `Post text announcements for ${branchName(managerBranchId)}. Customers of this branch see them on the home screen.`}
          </p>
        </div>
      </div>

      <form
        onSubmit={handlePost}
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '18px', display: 'grid', gap: '14px' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input style={inputStyle} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Eid timings" required />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select style={inputStyle} value={tag} onChange={(e) => setTag(e.target.value)}>
              {TAG_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.value.charAt(0) + t.value.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Branch</label>
            {isOwner ? (
              <select style={inputStyle} value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="all">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            ) : (
              <input style={{ ...inputStyle, backgroundColor: '#F8FAFC' }} value={branchName(managerBranchId)} readOnly />
            )}
          </div>
          <div>
            <label style={labelStyle}>Valid until (optional)</label>
            <input style={inputStyle} value={validUntil} maxLength={60} onChange={(e) => setValidUntil(e.target.value)} placeholder="e.g. Till Sunday" />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Message</label>
          <textarea
            style={{ ...inputStyle, minHeight: '96px', resize: 'vertical' }}
            value={message}
            maxLength={1000}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write the announcement text…"
            required
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={posting || !title.trim() || !message.trim()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', border: 'none',
              backgroundColor: posting || !title.trim() || !message.trim() ? '#FCA5A5' : '#EF4444', color: '#FFFFFF', fontWeight: 700,
              fontSize: '14px', cursor: posting ? 'wait' : 'pointer',
            }}
          >
            <Send size={16} /> {posting ? 'Posting…' : 'Post announcement'}
          </button>
        </div>
      </form>

      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', border: '1px dashed var(--border-color)', borderRadius: '16px', fontSize: '14px' }}>
          No announcements yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {visible.map((a) => {
            const color = colorForTag(a.tag, a.badgeColor);
            return (
              <div
                key={a.id}
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderLeft: `4px solid ${color}`, borderRadius: '14px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', color, backgroundColor: `${color}14`, padding: '3px 8px', borderRadius: '999px' }}>
                    {(a.tag || 'ANNOUNCEMENT').toUpperCase()}
                  </span>
                  {canDelete(a) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      title="Remove announcement"
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', padding: 4, display: 'flex' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', wordBreak: 'break-word' }}>{a.title}</div>
                <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{a.description}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {a.branchId ? <Building2 size={13} /> : <Globe2 size={13} />} {a.branchName || branchName(a.branchId)}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={13} /> {formatPosted(a.createdAt)}
                  </span>
                  {a.validUntil && <span>· {a.validUntil}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
