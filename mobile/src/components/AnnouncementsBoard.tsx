import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Megaphone, Trash2, Send, Globe2, Building2 } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { Announcement } from '../types';

// Owner / branch-manager announcement board (mirror of web app/src/staff/AnnouncementsBoard.tsx).
// Posts plain text cards that customers see on the home screen. A manager always posts to their
// own branch (also enforced server-side); the owner can target all branches or one branch.

const TAG_OPTIONS: Array<{ value: string; label: string; color: string }> = [
  { value: 'ANNOUNCEMENT', label: 'Announcement', color: '#EF4444' },
  { value: 'NOTICE', label: 'Notice', color: '#2563EB' },
  { value: 'DEAL', label: 'Deal', color: '#16A34A' },
  { value: 'EVENT', label: 'Event', color: '#9333EA' },
  { value: 'TIMINGS', label: 'Timings', color: '#EA580C' },
];

const colorForTag = (tag?: string, fallback?: string) =>
  TAG_OPTIONS.find((t) => t.value === (tag || '').toUpperCase())?.color || fallback || '#EF4444';

const formatPosted = (iso?: string) => {
  if (!iso) return 'Just now';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString([], { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export function AnnouncementsBoard({ embedded = false }: { embedded?: boolean } = {}) {
  const { announcements, addAnnouncement, deleteAnnouncement, branches, role, staffUser, currentBranch } = useApp();
  const isOwner = role === 'platform_owner';
  const managerBranchId = (staffUser as any)?.branchId || currentBranch?.id || '';

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [tag, setTag] = useState('ANNOUNCEMENT');
  const [validUntil, setValidUntil] = useState('');
  const [target, setTarget] = useState<string>(isOwner ? 'all' : managerBranchId);
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const branchName = (id?: string | null) => (!id ? 'All branches' : branches.find((b) => b.id === id)?.name || id);

  const visible = useMemo(() => {
    const list = isOwner ? announcements : announcements.filter((a) => !a.branchId || a.branchId === managerBranchId);
    return [...list].sort(
      (a, b) => (new Date(b.createdAt || 0).getTime() || 0) - (new Date(a.createdAt || 0).getTime() || 0)
    );
  }, [announcements, isOwner, managerBranchId]);

  const canDelete = (a: Announcement) => isOwner || (!!a.branchId && a.branchId === managerBranchId);
  const canPost = title.trim().length > 0 && message.trim().length > 0 && !posting;

  const handlePost = async () => {
    if (!canPost) return;
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

  const handleDelete = (a: Announcement) => {
    Alert.alert('Remove announcement?', a.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(a.id);
          await deleteAnnouncement(a.id);
          setDeletingId(null);
        },
      },
    ]);
  };

  const branchChoices = [{ id: 'all', name: 'All branches' }, ...branches.map((b) => ({ id: b.id, name: b.name }))];

  const body = (
    <>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Megaphone size={22} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Announcements</Text>
            <Text style={styles.headerSub}>
              {isOwner
                ? 'Post text announcements for all branches or one branch. Customers see them on the home screen.'
                : `Post text announcements for ${branchName(managerBranchId)}.`}
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder="e.g. Eid timings"
            placeholderTextColor={Colors.textLight}
          />

          <Text style={styles.label}>Type</Text>
          <View style={styles.chipRow}>
            {TAG_OPTIONS.map((t) => {
              const active = tag === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setTag(t.value)}
                  style={[styles.chip, active && { backgroundColor: t.color, borderColor: t.color }]}
                >
                  <Text style={[styles.chipText, active && { color: '#FFFFFF' }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Branch</Text>
          {isOwner ? (
            <View style={styles.chipRow}>
              {branchChoices.map((b) => {
                const active = target === b.id;
                return (
                  <TouchableOpacity
                    key={b.id}
                    onPress={() => setTarget(b.id)}
                    style={[styles.chip, active && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                  >
                    <Text style={[styles.chipText, active && { color: '#FFFFFF' }]}>{b.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={[styles.input, { backgroundColor: Colors.bgSubtle, justifyContent: 'center' }]}>
              <Text style={{ color: Colors.textSecondary }}>{branchName(managerBranchId)}</Text>
            </View>
          )}

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, { minHeight: 96, textAlignVertical: 'top' }]}
            value={message}
            onChangeText={setMessage}
            maxLength={1000}
            multiline
            placeholder="Write the announcement text…"
            placeholderTextColor={Colors.textLight}
          />

          <Text style={styles.label}>Valid until (optional)</Text>
          <TextInput
            style={styles.input}
            value={validUntil}
            onChangeText={setValidUntil}
            maxLength={60}
            placeholder="e.g. Till Sunday"
            placeholderTextColor={Colors.textLight}
          />

          <TouchableOpacity
            style={[styles.postBtn, !canPost && { backgroundColor: '#FCA5A5' }]}
            onPress={handlePost}
            disabled={!canPost}
          >
            {posting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Send size={16} color="#FFFFFF" />}
            <Text style={styles.postBtnText}>{posting ? 'Posting…' : 'Post announcement'}</Text>
          </TouchableOpacity>
        </View>

        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No announcements yet.</Text>
          </View>
        ) : (
          visible.map((a) => {
            const color = colorForTag(a.tag, a.badgeColor);
            return (
              <View key={a.id} style={[styles.card, { borderLeftColor: color }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.tagPill, { backgroundColor: `${color}1A` }]}>
                    <Text style={[styles.tagText, { color }]}>{(a.tag || 'ANNOUNCEMENT').toUpperCase()}</Text>
                  </View>
                  {canDelete(a) && (
                    <TouchableOpacity onPress={() => handleDelete(a)} disabled={deletingId === a.id} hitSlop={10}>
                      {deletingId === a.id ? (
                        <ActivityIndicator size="small" color={Colors.textLight} />
                      ) : (
                        <Trash2 size={18} color={Colors.textLight} />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.cardTitle}>{a.title}</Text>
                <Text style={styles.cardBody}>{a.description}</Text>
                <View style={styles.cardMeta}>
                  {a.branchId ? <Building2 size={12} color={Colors.textMuted} /> : <Globe2 size={12} color={Colors.textMuted} />}
                  <Text style={styles.cardMetaText}>
                    {[a.branchName || branchName(a.branchId), formatPosted(a.createdAt), a.validUntil].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>
            );
          })
        )}
    </>
  );

  // Embedded = rendered inside an Overview screen that already scrolls (no nested ScrollView).
  if (embedded) return <View style={styles.embedded}>{body}</View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  content: { padding: 16, paddingBottom: 120, gap: 12 },
  embedded: { gap: 12, marginTop: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textMain },
  headerSub: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  formCard: { backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderColor, padding: 14 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textMain,
    backgroundColor: '#FFFFFF',
    minHeight: 42,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.borderColor, backgroundColor: '#FFFFFF' },
  chipText: { fontSize: 12.5, fontWeight: '700', color: Colors.textSecondary },
  postBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 12,
  },
  postBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  empty: { padding: 32, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderDark, backgroundColor: Colors.bgCard },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  card: { backgroundColor: Colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderColor, borderLeftWidth: 4, padding: 14, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Colors.textMain },
  cardBody: { fontSize: 13.5, color: Colors.textSecondary, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  cardMetaText: { fontSize: 11.5, color: Colors.textMuted, flexShrink: 1 },
});
