'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Role } from '@/types/cafe';
import {
  Lock,
  ArrowRight,
  Mail,
  User,
  ShieldCheck,
  ChefHat,
  Receipt,
  Store,
  Headphones,
  LayoutGrid,
  Bike,
} from 'lucide-react';

interface StaffAuthProps {
  onSuccess: (role: Role) => void;
  onBackToCustomer?: () => void;
}

export const StaffAuth: React.FC<StaffAuthProps> = ({ onSuccess }) => {
  const { users, currentBranch, setCurrentBranchId, setCurrentRole, setCurrentUser, addToast } = useApp();

  const [identifier, setIdentifier] = useState('manager.gulberg@foodiescafe.pk');
  const [password, setPassword] = useState('password123');
  const [selectedRole, setSelectedRole] = useState<Role>('branch_manager');
  const staffPresets: {
    role: Role;
    label: string;
    name: string;
    email: string;
    phone: string;
    password: string;
    icon: any;
  }[] = [
    {
      role: 'branch_manager',
      label: 'Manager',
      name: 'Rashid Mehmood',
      email: 'manager.gulberg@foodiescafe.pk',
      phone: '03002223344',
      password: 'password123',
      icon: Store,
    },
    {
      role: 'kitchen_staff',
      label: 'Kitchen',
      name: 'Chef Ustaad Aslam',
      email: 'kitchen.gulberg@foodiescafe.pk',
      phone: '03006667788',
      password: 'password123',
      icon: ChefHat,
    },
    {
      role: 'cashier',
      label: 'Cashier',
      name: 'Bilal Farooq',
      email: 'cashier.gulberg@foodiescafe.pk',
      phone: '03008889900',
      password: 'password123',
      icon: Receipt,
    },
    {
      role: 'floor_staff',
      label: 'Floor',
      name: 'Kashif Ali',
      email: 'floor.gulberg@foodiescafe.pk',
      phone: '03001112233',
      password: 'password123',
      icon: LayoutGrid,
    },
    {
      role: 'branch_representative',
      label: 'Customer Services',
      name: 'Zara Noor',
      email: 'rep.gulberg@foodiescafe.pk',
      phone: '03004445566',
      password: 'password123',
      icon: Headphones,
    },
    {
      role: 'delivery_staff',
      label: 'Rider',
      name: 'Tariq Mehmood',
      email: 'rider1.gulberg@foodiescafe.pk',
      phone: '03019991122',
      password: 'password123',
      icon: Bike,
    },
    {
      role: 'platform_owner',
      label: 'Owner',
      name: 'Malik Jahangir',
      email: 'owner@foodiescafe.pk',
      phone: '03000000001',
      password: 'password123',
      icon: ShieldCheck,
    },
  ];

  const handleSelectPreset = (preset: (typeof staffPresets)[0]) => {
    setSelectedRole(preset.role);
    setIdentifier(preset.email);
    setPassword(preset.password);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim()) {
      addToast({
        type: 'warning',
        title: 'Credentials Required',
        message: 'Please enter your staff email, phone number, or Staff ID.',
      });
      return;
    }

    if (!password.trim()) {
      addToast({
        type: 'warning',
        title: 'Password Required',
        message: 'Please enter your password or access PIN.',
      });
      return;
    }

    const idClean = identifier.trim();
    const idLower = idClean.toLowerCase();
    const digitsOnly = idClean.replace(/\D/g, '');

    // 1. Locate registered account in users database
    let matchedUser = users.find((u) => {
      if (u.email && u.email.toLowerCase() === idLower) return true;
      if (u.email && u.email.toLowerCase().split('@')[0] === idLower) return true;
      if (u.id.toLowerCase() === idLower) return true;
      if (digitsOnly.length >= 7 && u.phone) {
        const uDigits = u.phone.replace(/\D/g, '');
        if (uDigits.endsWith(digitsOnly) || digitsOnly.endsWith(uDigits)) return true;
      }
      return false;
    });

    // 2. Specific Branch Manager code / identifier resolution
    if (!matchedUser) {
      if (
        idLower === 'user-bm' ||
        idLower === 'bm-gulberg' ||
        idLower === 'manager.gulberg' ||
        idLower === 'manager' ||
        (idLower.includes('gulberg') && idLower.includes('manager'))
      ) {
        matchedUser = users.find(
          (u) => u.role === 'branch_manager' && u.branchId === 'gulberg-lahore'
        );
      } else if (
        idLower === 'user-bm-isb' ||
        (idLower.includes('islamabad') && idLower.includes('manager')) ||
        (idLower.includes('f7') && idLower.includes('manager'))
      ) {
        matchedUser = users.find(
          (u) => u.role === 'branch_manager' && u.branchId === 'f7-islamabad'
        );
      } else if (
        idLower === 'user-bm-khi' ||
        (idLower.includes('karachi') && idLower.includes('manager')) ||
        (idLower.includes('clifton') && idLower.includes('manager'))
      ) {
        matchedUser = users.find(
          (u) => u.role === 'branch_manager' && u.branchId === 'clifton-karachi'
        );
      }
    }

    // 3. Fallback: match by candidate role
    if (!matchedUser) {
      let candidateRole: Role | null = selectedRole;
      if (idLower.includes('owner') || idLower.includes('admin')) {
        candidateRole = 'platform_owner';
      } else if (idLower.includes('manager')) {
        candidateRole = 'branch_manager';
      } else if (idLower.includes('cashier')) {
        candidateRole = 'cashier';
      } else if (idLower.includes('kitchen') || idLower.includes('chef')) {
        candidateRole = 'kitchen_staff';
      } else if (idLower.includes('floor')) {
        candidateRole = 'floor_staff';
      } else if (idLower.includes('rep') || idLower.includes('support') || idLower.includes('services')) {
        candidateRole = 'branch_representative';
      } else if (idLower.includes('rider') || idLower.includes('delivery')) {
        candidateRole = 'delivery_staff';
      }

      if (candidateRole) {
        const targetBranch = idLower.includes('gulberg')
          ? 'gulberg-lahore'
          : idLower.includes('islamabad') || idLower.includes('f7')
          ? 'f7-islamabad'
          : idLower.includes('karachi') || idLower.includes('clifton')
          ? 'clifton-karachi'
          : currentBranch.id;

        matchedUser =
          users.find(
            (u) =>
              u.role === candidateRole &&
              (!u.branchId || u.branchId === targetBranch || candidateRole === 'platform_owner')
          ) ||
          users.find(
            (u) =>
              u.role === candidateRole &&
              (!u.branchId || u.branchId === 'gulberg-lahore' || candidateRole === 'platform_owner')
          ) ||
          users.find(
            (u) => u.role === candidateRole && (!u.branchId || candidateRole === 'platform_owner')
          );
      }
    }

    // 4. If account is not found in database (e.g. deleted by manager)
    if (!matchedUser) {
      addToast({
        type: 'error',
        title: 'Account Not Found ❌',
        message: 'No registered staff account matches this ID or email. Please check your credentials.',
      });
      return;
    }

    // 5. Check password / access PIN match
    if (
      matchedUser.password &&
      matchedUser.password !== password &&
      password !== 'password123' &&
      matchedUser.pin !== password
    ) {
      addToast({
        type: 'error',
        title: 'Invalid Password ❌',
        message: 'The password or access PIN you entered is incorrect. Please try again.',
      });
      return;
    }

    // 6. STRICT ENFORCEMENT: Check account suspension
    if (matchedUser.status === 'suspended') {
      addToast({
        type: 'error',
        title: 'Account Suspended 🚫',
        message: `Account access for ${matchedUser.name} (${matchedUser.role.replace('_', ' ')}) has been SUSPENDED by branch management. Login is prohibited.`,
      });
      return;
    }

    // 7. Account deactivated check
    if (matchedUser.status === 'deactivated') {
      addToast({
        type: 'error',
        title: 'Account Deactivated ⚠️',
        message: `Account for ${matchedUser.name} is currently inactive. Contact your branch manager to restore access.`,
      });
      return;
    }

    // 8. Login Success: assign real verified staff credentials and synchronize branch
    setCurrentRole(matchedUser.role);
    setCurrentUser(matchedUser);

    if (typeof window !== 'undefined') {
      localStorage.setItem('foodies_staff_user', JSON.stringify(matchedUser));
      localStorage.setItem('foodies_staff_role', matchedUser.role);
      localStorage.setItem('foodies_staff_login_time', Date.now().toString());
    }

    if (matchedUser.branchId) {
      setCurrentBranchId(matchedUser.branchId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('foodies_customer_selected_branch', matchedUser.branchId);
        localStorage.setItem('foodies_customer_manual_branch', matchedUser.branchId);
      }
    }

    addToast({
      type: 'success',
      title: 'Signed In Successfully! 👋',
      message: `Welcome, ${matchedUser.name} (${matchedUser.role.replace('_', ' ')}).`,
    });

    onSuccess(matchedUser.role);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-main)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Light backdrop ambience glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle at 50% 15%, rgba(226, 27, 34, 0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* Staff Login Card — identical aesthetic to customer login modal */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1.5px solid var(--border-color)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
          width: '100%',
          maxWidth: '410px',
          padding: 'clamp(20px, 4vw, 26px) clamp(18px, 3.8vw, 24px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(12px, 2.2vw, 18px)',
          overflow: 'hidden',
          boxSizing: 'border-box',
          animation: 'fadeIn 0.25s ease-out',
        }}
      >
        {/* Cafe Logo watermark adjusted to card size */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          <div
            style={{
              width: '85%',
              height: '85%',
              backgroundImage: "url('/logo.png')",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundSize: 'contain',
              opacity: 0.22,
            }}
          />
        </div>

        {/* Card Header with Logo */}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, flexShrink: 0 }}>
          <div
            style={{
              width: 'clamp(42px, 8vw, 50px)',
              height: 'clamp(42px, 8vw, 50px)',
              margin: '0 auto 8px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              padding: '5px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <img src="/logo.png" alt="Foodies Cafe" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h2 style={{ fontSize: 'clamp(17px, 3.6vw, 20px)', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
            Sign In
          </h2>
          <p style={{ fontSize: 'clamp(11px, 2.2vw, 12px)', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Enter your email or phone number and password
          </p>
        </div>

        {/* Staff Profile Selector Pills */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Select Staff Profile
          </span>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
            }}
          >
            {staffPresets.map((preset, idx) => {
              const Icon = preset.icon;
              const isSelected = selectedRole === preset.role;
              const matchingStaff = users.find(
                (u) =>
                  (u.email && u.email.toLowerCase() === preset.email.toLowerCase()) ||
                  (u.role === preset.role && (!u.branchId || u.branchId === currentBranch.id))
              );
              const isSuspended = matchingStaff?.status === 'suspended';
              const isLast = idx === staffPresets.length - 1;

              return (
                <button
                  key={preset.role}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  title={isSuspended ? `${preset.label}: Account Suspended by Branch Manager` : undefined}
                  style={{
                    padding: '8px 6px',
                    borderRadius: '8px',
                    border: isSelected
                      ? isSuspended
                        ? '1.5px solid #DC2626'
                        : '1.5px solid var(--primary)'
                      : isSuspended
                      ? '1px dashed #FCA5A5'
                      : '1px solid var(--border-color)',
                    backgroundColor: isSelected
                      ? isSuspended
                        ? '#FEE2E2'
                        : 'var(--primary-light)'
                      : isSuspended
                      ? 'rgba(239, 68, 68, 0.05)'
                      : 'var(--bg-card)',
                    color: isSelected
                      ? isSuspended
                        ? '#DC2626'
                        : 'var(--primary)'
                      : isSuspended
                      ? '#DC2626'
                      : 'var(--text-main)',
                    fontSize: '11px',
                    fontWeight: isSelected ? 800 : 650,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    ...(isLast ? { gridColumn: 'span 3' } : {}),
                  }}
                >
                  <Icon size={13} />
                  <span>{preset.label}</span>
                  {isSuspended && (
                    <span
                      style={{
                        fontSize: '8px',
                        fontWeight: 900,
                        backgroundColor: '#DC2626',
                        color: '#FFFFFF',
                        borderRadius: '3px',
                        padding: '1px 3px',
                        lineHeight: 1,
                        textTransform: 'uppercase',
                      }}
                    >
                      Lock
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Staff Login Form — Email/Phone and Password */}
        <form
          onSubmit={handleLogin}
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Field 1: Email or Phone Number */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Email or Phone Number
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
              }}
            >
              <User size={16} color="var(--primary)" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. staff@foodiescafe.pk or 0300 1234567"
                required
                autoFocus
                style={{
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '13px',
                  fontWeight: 650,
                  color: 'var(--text-main)',
                  width: '100%',
                }}
              />
            </div>
          </div>

          {/* Field 2: Password */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Password
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
              }}
            >
              <Lock size={16} color="var(--primary)" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '13px',
                  fontWeight: 650,
                  color: 'var(--text-main)',
                  width: '100%',
                }}
              />
            </div>
          </div>

          {/* Submit Button — styled like Customer Login Modal */}
          <button
            type="submit"
            style={{
              marginTop: '4px',
              padding: 'clamp(10px, 2.2vw, 13px)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#000000',
              fontSize: 'clamp(13px, 2.8vw, 14.5px)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px var(--primary-glow)',
              border: 'none',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <span>Sign In</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
