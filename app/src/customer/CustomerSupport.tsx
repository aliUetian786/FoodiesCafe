'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Complaint, Order } from '@/types/cafe';
import {
  MessageSquare,
  Send,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';

const formatMessageTime = (timestamp?: string): string => {
  if (!timestamp) return 'Just now';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) {
    const timeMatch = timestamp.match(/\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/);
    return timeMatch ? timeMatch[0] : timestamp;
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const getNormalizedDate = (timestamp?: string): Date => {
  if (!timestamp) return new Date();
  const d = new Date(timestamp);
  if (!isNaN(d.getTime())) return d;
  if (timestamp.toLowerCase().includes('yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
  return new Date();
};

const getDayKey = (timestamp?: string): string => {
  const d = getNormalizedDate(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const getDayDividerLabel = (timestamp?: string): string => {
  const d = getNormalizedDate(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfTarget) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const parseTimestampMs = (ts?: string): number => {
  if (!ts) return 0;
  const t = new Date(ts).getTime();
  return isNaN(t) ? 0 : t;
};

export const SupportScreen: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  const { complaints, submitComplaint, sendComplaintReply, orders, currentUser, currentBranch } = useApp();

  const [activeTicketId, setActiveTicketId] = useState<string>('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [replyText, setReplyText] = useState('');
  const [readTicketIds, setReadTicketIds] = useState<Set<string>>(new Set());
  const [readTicketTimestamps, setReadTicketTimestamps] = useState<Record<string, number>>({});
  const [targetScrollMessageId, setTargetScrollMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const normalizePhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);
  const userPhoneClean = normalizePhone(currentUser.phone);

  // Customer's orders (strictly filtered by phone/ID, never fallback to all orders)
  const customerOrders = useMemo(() => {
    if (!userPhoneClean && (!currentUser.id || currentUser.id === 'user-guest')) return [];
    return orders.filter((o) => {
      if (currentUser.id && currentUser.id !== 'user-guest' && o.customerId === currentUser.id) return true;
      if (userPhoneClean && normalizePhone(o.customerPhone) === userPhoneClean) return true;
      return false;
    });
  }, [orders, currentUser, userPhoneClean]);

  // Customer's tickets (strictly filtered by phone/ID, never fallback to all complaints)
  const customerTickets = useMemo(() => {
    if (!userPhoneClean && (!currentUser.id || currentUser.id === 'user-guest')) return [];
    const matched = complaints.filter((c) => {
      if (currentUser.id && currentUser.id !== 'user-guest' && c.customerId === currentUser.id) return true;
      if (userPhoneClean && normalizePhone(c.customerPhone) === userPhoneClean) return true;
      return false;
    });

    return [...matched].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [complaints, currentUser, userPhoneClean]);

  // Active selected ticket (defaults to latest)
  const activeTicket = useMemo(() => {
    if (activeTicketId) {
      const found = complaints.find((c) => c.id === activeTicketId);
      if (found) return found;
    }
    return customerTickets[customerTickets.length - 1] || null;
  }, [activeTicketId, complaints, customerTickets]);

  // Check if a ticket has unread reply from support staff
  const ticketHasUnreadReply = (ticket: Complaint): boolean => {
    if (!ticket.messages || ticket.messages.length === 0) return false;
    if (ticket.status === 'resolved' || ticket.status === 'closed') return false;

    const lastReadTime = readTicketTimestamps[ticket.id] || 0;
    const isExplicitlyRead = readTicketIds.has(ticket.id);

    let lastStaffTime = 0;
    let hasStaffReply = false;
    for (let i = ticket.messages.length - 1; i >= 0; i--) {
      if (ticket.messages[i].sender !== 'customer') {
        hasStaffReply = true;
        const t = parseTimestampMs(ticket.messages[i].timestamp);
        if (t > lastStaffTime) lastStaffTime = t;
        break;
      }
    }

    if (!hasStaffReply) return false;
    if (isExplicitlyRead && lastReadTime >= lastStaffTime) return false;
    return !isExplicitlyRead || lastReadTime < lastStaffTime;
  };

  // Find the first unread message from support staff in a ticket
  const findFirstUnreadStaffMsgId = (ticket: Complaint): string | null => {
    if (!ticket.messages || ticket.messages.length === 0) return null;

    let lastCustIdx = -1;
    for (let i = ticket.messages.length - 1; i >= 0; i--) {
      if (ticket.messages[i].sender === 'customer') {
        lastCustIdx = i;
        break;
      }
    }
    const firstStaffIdx = lastCustIdx + 1;
    if (firstStaffIdx < ticket.messages.length && ticket.messages[firstStaffIdx].sender !== 'customer') {
      return ticket.messages[firstStaffIdx].id;
    }
    const firstStaff = ticket.messages.find((m) => m.sender !== 'customer');
    return firstStaff ? firstStaff.id : null;
  };

  // Select ticket and scroll to unseen staff message
  const handleSelectTicket = (ticket: Complaint) => {
    setActiveTicketId(ticket.id);

    const hasUnread = ticketHasUnreadReply(ticket);
    const unreadStaffId = hasUnread ? findFirstUnreadStaffMsgId(ticket) : null;

    setReadTicketIds((prev) => {
      const next = new Set(prev);
      next.add(ticket.id);
      return next;
    });
    setReadTicketTimestamps((prev) => ({
      ...prev,
      [ticket.id]: Date.now(),
    }));

    if (unreadStaffId) {
      setTargetScrollMessageId(unreadStaffId);
      setTimeout(() => {
        const el = document.getElementById(`cust-msg-${unreadStaffId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 80);
    } else {
      setTargetScrollMessageId(null);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
  };

  // Auto-scroll chat: directly to unseen message if set, or to bottom
  useEffect(() => {
    if (targetScrollMessageId) {
      const el = document.getElementById(`cust-msg-${targetScrollMessageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [customerTickets, targetScrollMessageId]);

  // Flattened continuous chat items across customer tickets
  const chatFeedItems = useMemo(() => {
    const items: Array<{
      type: 'date_divider' | 'ticket_topic' | 'message' | 'resolved_marker';
      id: string;
      label?: string;
      ticket?: Complaint;
      msg?: Complaint['messages'][0];
    }> = [];

    let lastDayKey = '';

    customerTickets.forEach((ticket) => {
      const firstMsg = ticket.messages[0];
      const ticketTimestamp = firstMsg?.timestamp || ticket.createdAt;
      const ticketDayKey = getDayKey(ticketTimestamp);

      // Date divider (e.g. Today) is written ABOVE the inquiry line
      if (ticketDayKey !== lastDayKey) {
        items.push({
          type: 'date_divider',
          id: `day-ticket-${ticket.id}`,
          label: getDayDividerLabel(ticketTimestamp),
        });
        lastDayKey = ticketDayKey;
      }

      // Render inquiry topic line (e.g. Inquiry #TKT-2556 · Inquiry on Order #FC-8225)
      items.push({
        type: 'ticket_topic',
        id: `topic-${ticket.id}`,
        label: `Inquiry #${ticket.ticketNumber} · ${ticket.subject}`,
        ticket,
      });

      // Add messages (date divider only triggers if a message crosses into another day)
      ticket.messages.forEach((m) => {
        const dayKey = getDayKey(m.timestamp);
        if (dayKey !== lastDayKey) {
          items.push({
            type: 'date_divider',
            id: `day-${m.id}`,
            label: getDayDividerLabel(m.timestamp),
          });
          lastDayKey = dayKey;
        }

        items.push({
          type: 'message',
          id: m.id,
          msg: m,
          ticket,
        });
      });

      // When a complaint is solved, show resolution banner after its last message
      if (ticket.status === 'resolved' || ticket.status === 'closed') {
        items.push({
          type: 'resolved_marker',
          id: `resolved-${ticket.id}`,
          label: 'Matter has been resolved',
          ticket,
        });
      }
    });

    return items;
  }, [customerTickets]);

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    submitComplaint(subject.trim(), message.trim(), selectedOrderId || undefined);
    setSubject('');
    setMessage('');
    setShowNewForm(false);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    // Find the latest active ticket for this customer
    const latestTicket = customerTickets[customerTickets.length - 1];

    if (latestTicket && latestTicket.status !== 'resolved' && latestTicket.status !== 'closed') {
      sendComplaintReply(latestTicket.id, replyText.trim());
    } else {
      // If previous matter has resolved, start new inquiry so chat seamlessly continues below resolved message
      submitComplaint('Follow-up Inquiry', replyText.trim(), selectedOrderId || undefined);
    }

    setTargetScrollMessageId(null);
    setReplyText('');
  };

  const handleInquireOnOrder = (order: Order) => {
    setSelectedOrderId(order.id);
    setSubject(`Inquiry on Order #${order.orderNumber}`);
    setShowNewForm(true);
  };

  return (
    <div
      style={{
        maxWidth: '1360px',
        width: '100%',
        margin: '0 auto',
        padding: '10px 16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        height: '100%',
        maxHeight: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Row (Static at top) */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          paddingBottom: '2px',
        }}
      >
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
          Customer Support & Live Chat
        </h1>

        <button
          onClick={() => setShowNewForm(!showNewForm)}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: showNewForm ? 'var(--bg-card-subtle)' : 'var(--primary)',
            color: showNewForm ? 'var(--text-main)' : '#FFFFFF',
            border: showNewForm ? '1px solid var(--border-color)' : 'none',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: showNewForm ? 'none' : '0 4px 12px var(--primary-glow)',
          }}
        >
          <PlusCircle size={15} />
          <span>{showNewForm ? 'Close Form' : 'New Ticket / Inquiry'}</span>
        </button>
      </div>

      {/* NEW TICKET MODAL OVERLAY (Never disrupts static layout) */}
      {showNewForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewForm(false);
          }}
        >
          <form
            onSubmit={handleCreateTicket}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--primary)',
              padding: '24px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                New Ticket
              </h3>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                  {customerOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      Order #{o.orderNumber} ({o.createdAt || 'Recent'} - Rs. {Number(o.total).toLocaleString()})
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
                  placeholder="e.g. Missing extra naan, spice adjustment request, delivery ETA..."
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

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  Your Message *
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
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '9px 20px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                Submit Inquiry
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2-COLUMN MAIN SUPPORT LAYOUT (COMPLETELY STATIC - ONLY INTERNAL LISTS SCROLL) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '360px 1fr',
          gap: '12px',
          alignItems: 'stretch',
          height: '100%',
          maxHeight: '100%',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* LEFT COLUMN: YOUR ORDERS & OPEN INQUIRY THREADS */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            height: '100%',
            maxHeight: '100%',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* A. SCROLLABLE RECENT ORDERS CARD */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingBag size={16} color="var(--primary)" />
                <h3 style={{ fontSize: '13.5px', fontWeight: 800, margin: 0, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Your Orders ({customerOrders.length})
                </h3>
              </div>
            </div>

            {/* Scrollable Order List Container (Scrolls inside card) */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '4px',
              }}
            >
              {customerOrders.length === 0 ? (
                <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                  No recent orders found.
                </div>
              ) : (
                customerOrders.map((ord) => (
                  <div
                    key={ord.id}
                    style={{
                      backgroundColor: 'var(--bg-card-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)' }}>
                        #{ord.orderNumber}
                      </span>
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '1.5px 6px',
                          borderRadius: '4px',
                          backgroundColor:
                            ord.status === 'ready'
                              ? '#DCFCE7'
                              : ord.status === 'out_for_delivery'
                              ? '#DBEAFE'
                              : 'var(--bg-card)',
                          color:
                            ord.status === 'ready'
                              ? '#166534'
                              : ord.status === 'out_for_delivery'
                              ? '#1E40AF'
                              : 'var(--text-secondary)',
                        }}
                      >
                        {ord.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                      <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {ord.type.replace('_', ' ')} · {ord.createdAt || 'Recent'}
                      </span>
                      <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                        Rs. {Number(ord.total).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                      {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '2px' }}>
                      <button
                        type="button"
                        onClick={() => handleInquireOnOrder(ord)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--primary-light)',
                          color: 'var(--primary)',
                          border: '1px solid var(--primary)',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Inquire About This Order →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* B. OPEN INQUIRY THREADS LIST CARD */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={16} color="var(--primary)" />
                <h3 style={{ fontSize: '13.5px', fontWeight: 800, margin: 0, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Open Inquiry Threads ({customerTickets.length})
                </h3>
              </div>
            </div>

            {/* Scrollable Threads List Container (Scrolls inside card) */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '4px',
              }}
            >
              {customerTickets.length === 0 ? (
                <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                  No inquiry threads yet.
                </div>
              ) : (
                customerTickets.map((c) => {
                  const isSelected = activeTicket?.id === c.id;
                  const hasUnread = ticketHasUnreadReply(c);
                  const isResolved = c.status === 'resolved' || c.status === 'closed';

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectTicket(c)}
                      style={{
                        backgroundColor: isSelected
                          ? 'var(--primary-light)'
                          : hasUnread
                          ? '#FEF2F2'
                          : 'var(--bg-card)',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected
                          ? '2px solid var(--primary)'
                          : hasUnread
                          ? '2px solid #DC2626'
                          : !isResolved
                          ? '1px solid #FDE68A'
                          : '1px solid var(--border-color)',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800, fontSize: '12.5px', color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                            #{c.ticketNumber}
                          </span>
                          {hasUnread && (
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 800,
                                backgroundColor: '#DC2626',
                                color: '#FFFFFF',
                                padding: '1px 6px',
                                borderRadius: '8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                boxShadow: '0 1px 3px rgba(220, 38, 38, 0.25)',
                              }}
                            >
                              ● New Reply
                            </span>
                          )}
                        </div>

                        {c.orderId && (
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Order #{c.orderId}
                          </span>
                        )}
                      </div>

                      <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.subject}
                      </div>

                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{c.createdAt || 'Recent'}</span>
                        <span>{c.messages?.length || 0} messages</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE CHAT WINDOW */}
        <div
          style={{
            height: '100%',
            maxHeight: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
          }}
        >
          {/* Chat Header: Static at top of chat card */}
          <div
            style={{
              flexShrink: 0,
              padding: '12px 18px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                {activeTicket ? `Inquiry Thread #${activeTicket.ticketNumber}` : 'Direct Customer Support Desk'}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Branch Representative Online · Instant responses
              </div>
            </div>
            {activeTicket?.orderId && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                Order #{activeTicket.orderId}
              </span>
            )}
          </div>

          {/* Chat Messages: Scrolls internally (minHeight: 0 prevents card expansion) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              padding: '16px 20px',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#FAFAFA',
            }}
          >
            {chatFeedItems.length === 0 ? (
              <div
                style={{
                  margin: 'auto',
                  textAlign: 'center',
                  maxWidth: '320px',
                  padding: '24px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px dashed var(--border-color)',
                }}
              >
                <MessageSquare size={28} color="var(--primary)" style={{ margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
                  Start Direct Chat
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  Send a message to our branch support team. We reply immediately.
                </p>
              </div>
            ) : (
              chatFeedItems.map((item) => {
                if (item.type === 'date_divider') {
                  return (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          backgroundColor: '#E2E8F0',
                          color: '#475569',
                          padding: '3px 12px',
                          borderRadius: '12px',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                }

                if (item.type === 'ticket_topic') {
                  return (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 4px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: '#FEF3C7',
                          color: '#92400E',
                          padding: '3px 14px',
                          borderRadius: '12px',
                          border: '1px solid #FDE68A',
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                }

                if (item.type === 'resolved_marker') {
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '14px 0', gap: '8px' }}>
                      <div style={{ height: '1px', flex: 1, backgroundColor: '#86EFAC' }} />
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          backgroundColor: '#DCFCE7',
                          color: '#15803D',
                          padding: '4px 14px',
                          borderRadius: '16px',
                          border: '1px solid #BBF7D0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          letterSpacing: '0.02em',
                        }}
                      >
                        <CheckCircle2 size={12} color="#16A34A" />
                        Matter has been resolved
                      </span>
                      <div style={{ height: '1px', flex: 1, backgroundColor: '#86EFAC' }} />
                    </div>
                  );
                }

                if (item.type === 'message' && item.msg) {
                  const m = item.msg;
                  const isCustomer = m.sender === 'customer';
                  const isTargetUnseen = m.id === targetScrollMessageId;

                  return (
                    <React.Fragment key={item.id}>
                      {isTargetUnseen && (
                        <div
                          id="cust-unseen-divider"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            margin: '12px 0 6px',
                          }}
                        >
                          <div style={{ height: '1px', flex: 1, backgroundColor: 'var(--primary)', opacity: 0.35 }} />
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              backgroundColor: 'var(--primary-light)',
                              color: 'var(--primary)',
                              padding: '3px 12px',
                              borderRadius: '12px',
                              border: '1px solid var(--primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 1px 4px var(--primary-glow)',
                              letterSpacing: '0.02em',
                            }}
                          >
                            ● New Message from Support Below
                          </span>
                          <div style={{ height: '1px', flex: 1, backgroundColor: 'var(--primary)', opacity: 0.35 }} />
                        </div>
                      )}

                      <div
                        id={`cust-msg-${m.id}`}
                        style={{
                          alignSelf: isCustomer ? 'flex-end' : 'flex-start',
                          maxWidth: '78%',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          transition: 'all 0.3s ease',
                        }}
                      >
                        {/* Name removed as requested */}
                        <div
                          style={{
                            position: 'relative',
                            padding: '10px 14px 22px 14px',
                            borderRadius: isCustomer ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                            backgroundColor: isCustomer ? 'var(--primary)' : '#FFFFFF',
                            color: isCustomer ? '#FFFFFF' : 'var(--text-main)',
                            border: isTargetUnseen
                              ? '2px solid var(--primary)'
                              : isCustomer
                              ? 'none'
                              : '1px solid var(--border-color)',
                            boxShadow: isTargetUnseen
                              ? '0 0 0 3px var(--primary-light), 0 3px 10px rgba(0,0,0,0.08)'
                              : '0 1px 3px rgba(0,0,0,0.06)',
                            fontSize: '13.5px',
                            lineHeight: 1.45,
                            minWidth: '85px',
                          }}
                        >
                          <div style={{ wordBreak: 'break-word', paddingRight: '22px' }}>
                            {m.text}
                          </div>
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '4px',
                              right: '8px',
                              fontSize: '10px',
                              color: isCustomer ? 'rgba(255, 255, 255, 0.75)' : 'var(--text-muted)',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              userSelect: 'none',
                            }}
                          >
                            {/* ONLY time, not date */}
                            {formatMessageTime(m.timestamp)}
                            {isCustomer && <CheckCircle2 size={10} style={{ opacity: 0.85 }} />}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                }

                return null;
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Reply Box: Static at bottom of the card */}
          <form
            onSubmit={handleSendReply}
            style={{
              flexShrink: 0,
              marginTop: 'auto',
              padding: '12px 16px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              gap: '8px',
            }}
          >
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
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              <Send size={14} />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
