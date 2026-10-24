'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Complaint } from '@/types/cafe';
import {
  MessageSquare,
  Send,
  User,
  Phone,
  AlertCircle,
  CheckCircle,
  CornerUpRight,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

export const RepresentativeScreen: React.FC = () => {
  const { complaints, sendComplaintReply, updateComplaintStatus, orders, requestRefund, addToast } = useApp();

  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string>(complaints[0]?.id || '');
  const [replyInput, setReplyInput] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  const filteredTickets = complaints.filter((c) => {
    if (statusFilter === 'all') return true;
    return c.status === statusFilter;
  });

  const activeTicket = complaints.find((c) => c.id === selectedTicketId) || complaints[0];
  const relatedOrder = orders.find((o) => o.id === activeTicket?.orderId);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !activeTicket) return;
    sendComplaintReply(activeTicket.id, replyInput);
    setReplyInput('');
  };

  const handleEscalate = () => {
    addToast({
      type: 'warning',
      title: 'Ticket Escalated',
      message: `Ticket #${activeTicket?.ticketNumber} escalated to Branch Manager Rashid Mehmood.`,
    });
  };

  const handleCloseTicket = () => {
    if (!activeTicket) return;
    updateComplaintStatus(activeTicket.id, 'closed');
    addToast({
      type: 'success',
      title: 'Ticket Closed',
      message: `Ticket #${activeTicket.ticketNumber} marked closed with resolution note.`,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
          Representative Inbox — Queries & Recovery
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Role: <strong>branch_representative</strong> · Direct customer recovery & complaint resolution
        </p>
      </div>

      {/* 3-PANEL INBOX LAYOUT (PRD Requirement) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr 300px',
          gap: '16px',
          height: '680px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}
      >
        {/* PANEL 1: Left List of Complaints with Filter */}
        <div style={{ borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Status Filter */}
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '12.5px',
                fontWeight: 700,
                outline: 'none',
              }}
            >
              <option value="all">All Complaints ({complaints.length})</option>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredTickets.map((c) => {
              const isSelected = activeTicket?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedTicketId(c.id)}
                  style={{
                    padding: '14px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: isSelected ? 'var(--primary-light)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '13px', color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                      #{c.ticketNumber}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)' }}>
                      {c.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.subject}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    From: {c.customerName}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL 2: Center Conversation Thread */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {activeTicket ? (
            <>
              {/* Thread Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
                    {activeTicket.subject}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Ticket #{activeTicket.ticketNumber} · Status: {activeTicket.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Messages Feed */}
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeTicket.messages.map((m) => {
                  const isRep = m.sender !== 'customer';
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isRep ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: isRep ? 'right' : 'left' }}>
                        {m.senderName} ({m.sender}) · {m.timestamp}
                      </span>
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '12px',
                          backgroundColor: isRep ? 'var(--primary)' : 'var(--bg-card-subtle)',
                          color: isRep ? '#FFFFFF' : 'var(--text-main)',
                          fontSize: '13px',
                          lineHeight: 1.45,
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} style={{ padding: '14px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  placeholder="Type official reply to customer..."
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
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
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Send size={15} />
                  <span>Reply</span>
                </button>
              </form>
            </>
          ) : (
            <div style={{ margin: 'auto', color: 'var(--text-muted)' }}>Select a complaint to view conversation</div>
          )}
        </div>

        {/* PANEL 3: Right Panel with Order Info & Actions (PRD Requirement) */}
        <div style={{ borderLeft: '1px solid var(--border-color)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Customer & Order Context
          </h4>

          {activeTicket && (
            <>
              {/* Customer Info */}
              <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12.5px' }}>
                <div><strong>Customer:</strong> {activeTicket.customerName}</div>
                <div><strong>Phone:</strong> {activeTicket.customerPhone}</div>
                <div><strong>Branch:</strong> Gulberg Lahore</div>
              </div>

              {/* Related Order Info */}
              {relatedOrder ? (
                <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12.5px' }}>
                  <div><strong>Order:</strong> #{relatedOrder.orderNumber}</div>
                  <div><strong>Status:</strong> {relatedOrder.status.toUpperCase()}</div>
                  <div><strong>Total:</strong> Rs. {relatedOrder.total.toLocaleString()} (Cash)</div>
                  <div><strong>Table:</strong> {relatedOrder.tableNumber || 'Takeaway'}</div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No specific order linked</div>
              )}

              {/* Recovery Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Recovery Actions
                </span>

                <button
                  onClick={handleEscalate}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ShieldAlert size={14} color="#EA580C" />
                  <span>Escalate to Manager / Owner</span>
                </button>

                <button
                  onClick={() => {
                    if (relatedOrder) {
                      requestRefund(relatedOrder.id, 250, 'Partial recovery refund granted by Representative');
                    }
                  }}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid #DC2626',
                    color: '#DC2626',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Request Refund (Within Limit)
                </button>

                <button
                  onClick={handleCloseTicket}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Close with Resolution Note ✓
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
