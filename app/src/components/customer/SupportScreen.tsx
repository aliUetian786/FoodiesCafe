'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Complaint } from '@/types/cafe';
import {
  MessageSquare,
  Send,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

export const SupportScreen: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  const { complaints, submitComplaint, sendComplaintReply, orders, currentUser } = useApp();

  const [activeTicketId, setActiveTicketId] = useState<string>(complaints[0]?.id || '');
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [replyText, setReplyText] = useState('');

  const activeTicket = complaints.find((c) => c.id === activeTicketId) || complaints[0];

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    submitComplaint(subject, message, selectedOrderId);
    setSubject('');
    setMessage('');
    setShowNewForm(false);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTicket) return;
    sendComplaintReply(activeTicket.id, replyText);
    setReplyText('');
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '24px auto 80px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Customer Support & Queries
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Direct private conversation with your branch representative.
          </p>
        </div>

        <button
          onClick={() => setShowNewForm(!showNewForm)}
          style={{
            padding: '10px 18px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: showNewForm ? 'var(--bg-card-subtle)' : 'var(--primary)',
            color: showNewForm ? 'var(--text-main)' : '#FFFFFF',
            border: showNewForm ? '1px solid var(--border-color)' : 'none',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: showNewForm ? 'none' : '0 4px 12px var(--primary-glow)',
          }}
        >
          <PlusCircle size={17} />
          <span>{showNewForm ? 'Close Form' : 'New Ticket / Inquiry'}</span>
        </button>
      </div>

      {/* NEW TICKET FORM */}
      {showNewForm && (
        <form
          onSubmit={handleCreateTicket}
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '2px solid var(--primary)',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Submit Query or Report Problem</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Related Order (Optional)
              </label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              >
                <option value="">General Inquiry (No Order)</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    Order #{o.orderNumber} ({o.createdAt} - Rs. {o.total})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Subject / Topic *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Missing sauce, table change request, spice feedback..."
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  outline: 'none',
                }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
              Your Message to Branch Representative *
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your request in detail..."
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '13px',
                outline: 'none',
                fontFamily: 'inherit',
              }}
              required
            />
          </div>

          <button
            type="submit"
            style={{
              alignSelf: 'flex-start',
              padding: '11px 22px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Submit to Branch Representative
          </button>
        </form>
      )}

      {/* TICKETS LIST & CHAT THREAD */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'flex-start' }}>
        {/* Ticket List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 4px', color: 'var(--text-secondary)' }}>
            Your Open & Resolved Tickets
          </h3>

          {complaints.map((c) => {
            const isSelected = activeTicket?.id === c.id;
            return (
              <div
                key={c.id}
                onClick={() => setActiveTicketId(c.id)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: isSelected ? '0 4px 14px var(--primary-glow)' : 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '14px' }}>Ticket #{c.ticketNumber}</span>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: c.status === 'resolved' ? 'var(--status-ready-bg)' : 'var(--status-preparing-bg)',
                      color: c.status === 'resolved' ? 'var(--status-ready-text)' : 'var(--status-preparing-text)',
                    }}
                  >
                    {c.status.replace('_', ' ')}
                  </span>
                </div>

                <div style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-main)' }}>
                  {c.subject}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {c.createdAt} {c.orderNumber ? `· Order #${c.orderNumber}` : ''}
                </div>
              </div>
            );
          })}
        </div>

        {/* Chat Thread with Branch Representative */}
        {activeTicket ? (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              height: '520px',
              overflow: 'hidden',
            }}
          >
            {/* Chat Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Ticket #{activeTicket.ticketNumber}: {activeTicket.subject}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Assigned Representative: <strong>{activeTicket.assignedTo || 'Branch Support Desk'}</strong>
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                {activeTicket.status.toUpperCase()}
              </span>
            </div>

            {/* Chat Messages */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {activeTicket.messages.map((m) => {
                const isCustomer = m.sender === 'customer';
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: isCustomer ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: isCustomer ? 'right' : 'left' }}>
                      {m.senderName} · {m.timestamp}
                    </div>
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: isCustomer ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        backgroundColor: isCustomer ? 'var(--primary)' : 'var(--bg-card-subtle)',
                        color: isCustomer ? '#FFFFFF' : 'var(--text-main)',
                        border: isCustomer ? 'none' : '1px solid var(--border-color)',
                        fontSize: '13.5px',
                        lineHeight: 1.45,
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chat Reply Box */}
            <form onSubmit={handleSendReply} style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write your response to branch representative..."
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '13.5px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Send size={15} />
                <span>Send</span>
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
};
