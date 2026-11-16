'use client';

import React, { useMemo, useState } from 'react';
import { Clock, Save } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { Branch } from '@/types/cafe';
import { normalizeBranchId } from '@/types/cafe';
import {
  formatOpeningHours,
  minutesToHHMM,
  nextScheduledTransition,
  parseOpeningHours,
} from '@/lib/branchHours';

/**
 * Opening-hours setter shown in the staff profile.
 * - Branch manager: their own branch.  - Owner: every branch.
 * With "Open & close automatically" on, the server opens/closes the branch at these times
 * (Asia/Karachi) and notifies the manager + owner.
 */
export function BranchScheduleEditor() {
  const { branches, currentRole, currentUser, currentBranch, updateBranchSettings } = useApp();

  const editable = useMemo<Branch[]>(() => {
    if (currentRole === 'platform_owner') return branches;
    if (currentRole === 'branch_manager') {
      const own = normalizeBranchId((currentUser as { branchId?: string })?.branchId || currentBranch.id);
      return branches.filter((b) => normalizeBranchId(b.id) === own);
    }
    return [];
  }, [branches, currentRole, currentUser, currentBranch.id]);

  if (editable.length === 0) return null;

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxHeight: '46vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Clock size={16} color="var(--primary)" />
        <span style={{ fontSize: '13.5px', fontWeight: 850, color: 'var(--text-main)' }}>
          Branch Opening Schedule
        </span>
      </div>
      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Times are Pakistan time. With automatic mode on, the branch opens and closes by itself and you get a
        notification. A manual close stays in effect until the next scheduled opening.
      </p>
      {editable.map((b) => (
        <BranchScheduleRow key={b.id} branch={b} onSave={updateBranchSettings} />
      ))}
    </div>
  );
}

function BranchScheduleRow({
  branch,
  onSave,
}: {
  branch: Branch;
  onSave: (branchId: string, settings: Partial<Branch>) => void;
}) {
  const parsed = parseOpeningHours(branch.openingHours);
  const [openTime, setOpenTime] = useState(parsed ? minutesToHHMM(parsed.openMin) : '11:00');
  const [closeTime, setCloseTime] = useState(parsed ? minutesToHHMM(parsed.closeMin) : '23:00');
  const [auto, setAuto] = useState(Boolean(branch.autoScheduleEnabled));

  const newHours = formatOpeningHours(openTime, closeTime);
  const dirty = newHours !== branch.openingHours || auto !== Boolean(branch.autoScheduleEnabled);
  const next = auto ? nextScheduledTransition(parseOpeningHours(newHours)!) : null;
  const nextLabel = next
    ? `${next.isOpen ? 'Opens' : 'Closes'} ${new Intl.DateTimeFormat('en-PK', {
        timeZone: 'Asia/Karachi',
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }).format(next.at)}`
    : 'Automatic mode off';

  const inputStyle: React.CSSProperties = {
    padding: '7px 8px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--text-main)',
    backgroundColor: 'var(--bg-input)',
    minHeight: '36px',
    width: '100%',
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card-subtle)',
        borderRadius: '12px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 850, color: 'var(--text-main)' }}>{branch.name}</span>
        <span
          style={{
            fontSize: '10.5px',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '999px',
            backgroundColor: branch.isOpen ? '#DCFCE7' : '#FEE2E2',
            color: branch.isOpen ? '#15803D' : '#B91C1C',
            whiteSpace: 'nowrap',
          }}
        >
          {branch.isOpen ? 'OPEN NOW' : 'CLOSED NOW'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          Opens at
          <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          Closes at
          <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} style={inputStyle} />
        </label>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} />
        Open &amp; close automatically
      </label>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{nextLabel}</span>
        <button
          type="button"
          disabled={!dirty || openTime === closeTime}
          onClick={() => onSave(branch.id, { openingHours: newHours, autoScheduleEnabled: auto })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            minHeight: '34px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: dirty && openTime !== closeTime ? 'var(--primary)' : 'var(--border-color)',
            color: dirty && openTime !== closeTime ? '#FFFFFF' : 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: 800,
            cursor: dirty && openTime !== closeTime ? 'pointer' : 'default',
          }}
        >
          <Save size={13} />
          Save
        </button>
      </div>
    </div>
  );
}
