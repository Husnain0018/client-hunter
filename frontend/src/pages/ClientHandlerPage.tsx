import React, { useEffect, useState, useMemo } from 'react';
import {
  AlertCircle,
  Bot,
  Building2,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Flame,
  HelpCircle,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Trophy,
  User,
  XCircle,
  Zap
} from 'lucide-react';
import { api } from '../api/client';
import type { ClientConversation, ClientHandlerStats, ClientStage, ConversationMessage } from '../types';

interface ClientHandlerPageProps {
  onBackToProspecting?: () => void;
  userPhoneDefault?: string;
}

const STAGE_LABELS: Record<ClientStage, { label: string; color: string; bg: string }> = {
  new: { label: 'New Lead', color: '#6366f1', bg: '#eef2ff' },
  contacted: { label: 'Contacted', color: '#0ea5e9', bg: '#f0f9ff' },
  awaiting_reply: { label: 'Awaiting Reply', color: '#8b5cf6', bg: '#f5f3ff' },
  conversing: { label: 'Active Chat', color: '#10b981', bg: '#ecfdf5' },
  follow_up_scheduled: { label: 'Follow-Up Due', color: '#f59e0b', bg: '#fffbeb' },
  interested: { label: 'Interested', color: '#059669', bg: '#d1fae5' },
  proposal_pending: { label: 'Proposal Sent', color: '#d97706', bg: '#fef3c7' },
  negotiating: { label: 'Negotiating', color: '#ea580c', bg: '#ffedd5' },
  closed_won: { label: 'Deal Closed 🎉', color: '#16a34a', bg: '#dcfce7' },
  lost: { label: 'Lost', color: '#64748b', bg: '#f1f5f9' },
  opted_out: { label: 'Opted Out', color: '#ef4444', bg: '#fee2e2' },
  needs_human: { label: 'Needs Human ⚠️', color: '#dc2626', bg: '#fef2f2' },
};

export const ClientHandlerPage: React.FC<ClientHandlerPageProps> = ({ userPhoneDefault = '' }) => {
  const [clients, setClients] = useState<ClientConversation[]>([]);
  const [stats, setStats] = useState<ClientHandlerStats | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientConversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [aiDraft, setAiDraft] = useState<any | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'research' | 'close'>('chat');
  const [errorNotice, setErrorNotice] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string>('');

  // Deal Closer Form State
  const [closingPrice, setClosingPrice] = useState('');
  const [closingTimeline, setClosingTimeline] = useState('1-2 weeks');
  const [closingDeliverables, setClosingDeliverables] = useState('');
  const [closingServices, setClosingServices] = useState<string[]>([]);
  const [closingNotes, setClosingNotes] = useState('');
  const [notifyUserPhone, setNotifyUserPhone] = useState(userPhoneDefault);
  const [notifyUserToggle, setNotifyUserToggle] = useState(Boolean(userPhoneDefault));
  const [closingBusy, setClosingBusy] = useState(false);

  // Load clients list
  const loadClients = async (silent = false) => {
    if (!silent) setLoadingList(true);
    setErrorNotice('');
    try {
      const res = await api.listClients(stageFilter, searchQuery);
      setClients(res.clients);
      setStats(res.stats);
      if (!selectedLeadId && res.clients.length > 0) {
        setSelectedLeadId(res.clients[0].leadId);
      }
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to load client conversations.');
    } finally {
      if (!silent) setLoadingList(false);
    }
  };

  useEffect(() => {
    void loadClients();
  }, [stageFilter]);

  // Load single client conversation
  useEffect(() => {
    if (!selectedLeadId) return;
    let isMounted = true;
    setLoadingChat(true);
    setAiDraft(null);
    setErrorNotice('');

    api.getClient(selectedLeadId)
      .then((res) => {
        if (!isMounted) return;
        setSelectedClient(res.client);
        setMessages(res.client.messages || []);
        // Seed closer state from lead defaults
        if (res.client.lead) {
          setClosingServices(res.client.agreedServices?.length ? res.client.agreedServices : res.client.lead.recommendedServices);
          setClosingPrice(res.client.agreedPrice || res.client.lead.estimatedDealValue || '$500');
          setClosingDeliverables(res.client.agreedDeliverables || `Full setup and deployment of ${res.client.lead.recommendedServices.slice(0, 2).join(' & ')}`);
          setClosingTimeline(res.client.agreedTimeline || '1-2 weeks');
          setClosingNotes(res.client.dealNotes || '');
        }
      })
      .catch((err: any) => {
        if (isMounted) setErrorNotice(err?.message || 'Failed to load chat history.');
      })
      .finally(() => {
        if (isMounted) setLoadingChat(false);
      });

    return () => { isMounted = false; };
  }, [selectedLeadId]);

  // Periodic poll for updates every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      void loadClients(true);
      if (selectedLeadId) {
        api.getClient(selectedLeadId).then((res) => {
          setSelectedClient(res.client);
          setMessages(res.client.messages || []);
        }).catch(() => {});
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [selectedLeadId]);

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedLeadId || !inputMessage.trim() || sendingMsg) return;
    setSendingMsg(true);
    setErrorNotice('');
    try {
      const res = await api.sendClientMessage(selectedLeadId, inputMessage.trim());
      setMessages((prev) => [...prev, res.message]);
      setSelectedClient(res.client);
      setInputMessage('');
      setAiDraft(null);
      void loadClients(true);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to send WhatsApp message.');
    } finally {
      setSendingMsg(false);
    }
  };

  // Generate First Outreach
  const handlePrepareFirstMessage = async () => {
    if (!selectedLeadId) return;
    setGeneratingAi(true);
    setErrorNotice('');
    try {
      const res = await api.sendFirstMessage(selectedLeadId, false);
      setInputMessage(res.messageText);
      setSuccessNotice('First personalized outreach message prepared from lead research! Review and send.');
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to prepare first message.');
    } finally {
      setGeneratingAi(false);
    }
  };

  // Generate AI Response Draft
  const handleGenerateAiReply = async (guidance?: string) => {
    if (!selectedLeadId || generatingAi) return;
    setGeneratingAi(true);
    setErrorNotice('');
    try {
      const res = await api.generateClientReply(selectedLeadId, guidance);
      setAiDraft(res.draft);
      if (res.draft.replyText) {
        setInputMessage(res.draft.replyText);
      }
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to generate AI response.');
    } finally {
      setGeneratingAi(false);
    }
  };

  // Toggle Auto-Pilot
  const handleToggleAutopilot = async () => {
    if (!selectedLeadId || !selectedClient) return;
    const nextVal = !selectedClient.autoPilot;
    try {
      const res = await api.toggleAutopilot(selectedLeadId, nextVal);
      setSelectedClient(res.client);
      void loadClients(true);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to toggle autopilot.');
    }
  };

  // Update Stage Manually
  const handleStageChange = async (newStage: ClientStage) => {
    if (!selectedLeadId) return;
    try {
      const res = await api.updateClientStage(selectedLeadId, newStage);
      setSelectedClient(res.client);
      void loadClients(true);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to change stage.');
    }
  };

  // Close Deal Action
  const handleCloseDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) return;
    setClosingBusy(true);
    setErrorNotice('');
    try {
      const res = await api.closeDeal(selectedLeadId, {
        leadId: selectedLeadId,
        agreedServices: closingServices,
        agreedPrice: closingPrice,
        agreedTimeline: closingTimeline,
        agreedDeliverables: closingDeliverables,
        dealNotes: closingNotes,
        notifyUserWhatsApp: notifyUserToggle,
        userPhoneNumber: notifyUserPhone,
      });
      setSelectedClient(res.client);
      setSuccessNotice('🎉 Deal closed successfully! Deliverables and terms logged.');
      void loadClients(true);
      setActiveTab('chat');
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to close deal.');
    } finally {
      setClosingBusy(false);
    }
  };

  return (
    <div style={{ padding: '0 0 50px' }}>
      {/* Top Banner & Stats Overview */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid var(--line)',
        padding: '20px 24px',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                display: 'grid',
                placeItems: 'center',
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
              }}>
                <Bot size={22} />
              </span>
              <div>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                  AI Client Handler Studio
                </h1>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>
                  Autonomous WhatsApp conversations, lead-researched outreach, objection handling & deal closing.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => void loadClients()}
              className="service-chip"
              style={{ background: '#fff', border: '1px solid var(--line)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={13} className={loadingList ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Pipeline Metrics Counters */}
        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 12,
            marginTop: 20
          }}>
            {[
              { label: 'Total Prospects', value: stats.totalClients, icon: Building2, color: '#6366f1' },
              { label: 'New / Ready', value: stats.newLeads, icon: Flame, color: '#3b82f6' },
              { label: 'Awaiting Reply', value: stats.awaitingReply, icon: Clock, color: '#8b5cf6' },
              { label: 'Active Chats', value: stats.activeConversations, icon: MessageCircle, color: '#10b981' },
              { label: 'In Negotiation', value: stats.negotiating, icon: DollarSign, color: '#ea580c' },
              { label: 'Deals Closed', value: stats.closedWon, icon: Trophy, color: '#16a34a', highlight: true },
              { label: 'Needs Attention', value: stats.needsHuman, icon: ShieldAlert, color: '#dc2626', alert: stats.needsHuman > 0 },
            ].map((m, idx) => {
              const Icon = m.icon;
              return (
                <div key={idx} style={{
                  background: m.alert ? '#fef2f2' : m.highlight ? '#ecfdf5' : '#f8fafc',
                  border: `1px solid ${m.alert ? '#fecaca' : m.highlight ? '#a7f3d0' : '#e2e8f0'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    color: m.color,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                  }}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <strong style={{ fontSize: '18px', display: 'block', lineHeight: 1.1, color: m.color }}>
                      {m.value}
                    </strong>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{m.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Container: 3-column or split layout */}
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 20px' }}>
        {errorNotice && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #f87171',
            borderRadius: 10,
            padding: '10px 16px',
            marginBottom: 16,
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '13px'
          }}>
            <AlertCircle size={16} />
            <span>{errorNotice}</span>
          </div>
        )}

        {successNotice && (
          <div style={{
            background: '#dcfce7',
            border: '1px solid #4ade80',
            borderRadius: 10,
            padding: '10px 16px',
            marginBottom: 16,
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '13px'
          }}>
            <CheckCircle2 size={16} />
            <span>{successNotice}</span>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr 340px',
          gap: 20,
          alignItems: 'start'
        }}>
          {/* Column 1: Client Roster & Filters */}
          <div style={{
            background: '#fff',
            borderRadius: 16,
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            maxHeight: 'calc(100vh - 200px)',
            overflow: 'hidden'
          }}>
            <div>
              <input
                type="text"
                placeholder="Search clients, phone, area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void loadClients(); }}
                style={{ padding: '8px 12px', fontSize: '12px' }}
              />
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'new', label: 'New' },
                { id: 'conversing', label: 'Active' },
                { id: 'negotiating', label: 'Negotiating' },
                { id: 'closed_won', label: 'Closed' },
                { id: 'needs_human', label: 'Action Due' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStageFilter(f.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: '11px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    background: stageFilter === f.id ? 'var(--primary)' : '#f1f5f9',
                    color: stageFilter === f.id ? '#fff' : '#475569',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Clients List */}
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
              {loadingList && clients.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)' }}>
                  <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px' }} />
                  <span style={{ fontSize: '12px' }}>Loading clients...</span>
                </div>
              ) : clients.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--muted)', fontSize: '13px' }}>
                  <Building2 size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>No prospects found in this view.</p>
                  <small>Run a search in Prospecting to populate clients.</small>
                </div>
              ) : (
                clients.map((c) => {
                  const stageInfo = STAGE_LABELS[c.stage] || STAGE_LABELS.new;
                  const isSelected = selectedLeadId === c.leadId;
                  return (
                    <div
                      key={c.leadId}
                      onClick={() => setSelectedLeadId(c.leadId)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: `1px solid ${isSelected ? 'var(--primary)' : '#e2e8f0'}`,
                        background: isSelected ? 'var(--soft)' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                        <strong style={{ fontSize: '13px', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.businessName}
                        </strong>
                        {c.autoPilot && (
                          <span title="Autonomous AI auto-pilot enabled" style={{ color: '#10b981', flexShrink: 0 }}>
                            <Bot size={13} />
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 999,
                          color: stageInfo.color,
                          background: stageInfo.bg
                        }}>
                          {stageInfo.label}
                        </span>
                        {c.phone && (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {c.phone}
                          </span>
                        )}
                      </div>

                      <p style={{
                        margin: 0,
                        fontSize: '11px',
                        color: '#64748b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.3
                      }}>
                        {c.messages && c.messages.length > 0
                          ? `${c.messages[c.messages.length - 1].sender === 'client' ? 'Client' : 'You'}: ${c.messages[c.messages.length - 1].text}`
                          : (c.summary || 'Awaiting initial outreach.')}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Active Conversation Studio */}
          <div style={{
            background: '#fff',
            borderRadius: 16,
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow)',
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 200px)',
            overflow: 'hidden'
          }}>
            {selectedClient ? (
              <>
                {/* Chat Top Header */}
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--line)',
                  background: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                        {selectedClient.businessName}
                      </h2>
                      {selectedClient.lead?.googleMapsUrl && (
                        <a href={selectedClient.lead.googleMapsUrl} target="_blank" rel="noreferrer" title="View on Google Maps">
                          <ExternalLink size={13} style={{ color: 'var(--primary)' }} />
                        </a>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={11} /> {selectedClient.phone || 'No phone'}
                      </span>
                      {selectedClient.lead?.address && (
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          • {selectedClient.lead.address.split(',')[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Auto-Pilot Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Stage Selector */}
                    <select
                      value={selectedClient.stage}
                      onChange={(e) => void handleStageChange(e.target.value as ClientStage)}
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: 8,
                        background: STAGE_LABELS[selectedClient.stage]?.bg || '#fff',
                        color: STAGE_LABELS[selectedClient.stage]?.color || '#1e293b',
                        border: '1px solid var(--line)'
                      }}
                    >
                      {Object.entries(STAGE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>

                    {/* Auto-pilot button */}
                    <button
                      type="button"
                      onClick={() => void handleToggleAutopilot()}
                      className={`service-chip ${selectedClient.autoPilot ? 'selected' : ''}`}
                      title={selectedClient.autoPilot ? 'Auto-pilot is ON: AI replies automatically' : 'Auto-pilot is OFF: Manual approval required'}
                      style={{ fontSize: '11px', padding: '6px 10px' }}
                    >
                      <Bot size={13} />
                      {selectedClient.autoPilot ? 'Auto-Pilot: ON' : 'Auto-Pilot: OFF'}
                    </button>
                  </div>
                </div>

                {/* Warning/Alert Banners */}
                {selectedClient.stage === 'needs_human' && (
                  <div style={{
                    background: '#fef2f2',
                    borderBottom: '1px solid #fecaca',
                    padding: '10px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: '#991b1b',
                    fontSize: '12px'
                  }}>
                    <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <strong>Human Intervention Requested:</strong> {selectedClient.humanInterventionReason || 'AI paused to prevent unapproved commitments.'}
                    </div>
                    <button
                      onClick={() => void handleStageChange('conversing')}
                      style={{ fontSize: '11px', padding: '4px 8px', borderRadius: 6, background: '#fff', border: '1px solid #f87171', color: '#991b1b', fontWeight: 700 }}
                    >
                      Clear & Resume
                    </button>
                  </div>
                )}

                {selectedClient.stage === 'closed_won' && (
                  <div style={{
                    background: '#ecfdf5',
                    borderBottom: '1px solid #a7f3d0',
                    padding: '10px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: '#065f46',
                    fontSize: '12px'
                  }}>
                    <Trophy size={16} style={{ flexShrink: 0, color: '#059669' }} />
                    <div>
                      <strong>Deal Closed!</strong> Agreed Services: {selectedClient.agreedServices.join(', ') || 'Custom Solution'}. Price: {selectedClient.agreedPrice || 'Agreed'}. Deliverables: {selectedClient.agreedDeliverables}.
                    </div>
                  </div>
                )}

                {selectedClient.optedOut && (
                  <div style={{
                    background: '#fee2e2',
                    borderBottom: '1px solid #fca5a5',
                    padding: '8px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: '#991b1b',
                    fontSize: '12px'
                  }}>
                    <XCircle size={14} />
                    <span>Client has opted out. Messaging is locked to respect opt-out preferences.</span>
                  </div>
                )}

                {/* Messages Chat Scroll Area */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  background: '#f8fafc'
                }}>
                  {loadingChat ? (
                    <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--muted)' }}>
                      <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px' }} />
                      <span style={{ fontSize: '13px' }}>Loading conversation history...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      margin: 'auto',
                      maxWidth: 420,
                      padding: 24,
                      background: '#fff',
                      borderRadius: 16,
                      border: '1px dashed var(--line)'
                    }}>
                      <MessageCircle size={32} style={{ color: 'var(--primary)', margin: '0 auto 10px', opacity: 0.8 }} />
                      <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 800 }}>Start WhatsApp Conversation</h3>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
                        No messages sent yet. The AI can draft a tailored outreach message using verified research for <strong>{selectedClient.businessName}</strong>.
                      </p>
                      <button
                        onClick={handlePrepareFirstMessage}
                        disabled={generatingAi}
                        style={{
                          background: 'linear-gradient(135deg, var(--primary), var(--primary-2))',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '12px',
                          padding: '10px 18px',
                          borderRadius: 10,
                          boxShadow: '0 4px 12px rgba(103, 87, 232, 0.25)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Sparkles size={14} />
                        Prepare First Message
                      </button>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isClient = m.sender === 'client';
                      return (
                        <div
                          key={m.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isClient ? 'flex-start' : 'flex-end',
                            maxWidth: '80%',
                            alignSelf: isClient ? 'flex-start' : 'flex-end'
                          }}
                        >
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: isClient ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                            background: isClient ? '#fff' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                            color: isClient ? '#1e293b' : '#fff',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                            border: isClient ? '1px solid #e2e8f0' : 'none',
                            fontSize: '13px',
                            lineHeight: 1.45,
                            wordBreak: 'break-word'
                          }}>
                            {m.text}
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 3,
                            fontSize: '10px',
                            color: '#94a3b8'
                          }}>
                            <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {!isClient && (
                              <span>
                                {m.status === 'Read' || m.status === 'Played' ? (
                                  <CheckCheck size={12} style={{ color: '#0ea5e9' }} />
                                ) : m.status === 'Delivered' ? (
                                  <CheckCheck size={12} />
                                ) : (
                                  <Check size={12} />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* AI Draft Suggestion Box */}
                {aiDraft && (
                  <div style={{
                    background: '#f5f3ff',
                    borderTop: '1px solid #ddd6fe',
                    padding: '10px 18px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12
                  }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <Sparkles size={16} style={{ color: '#7c3aed', marginTop: 2, flexShrink: 0 }} />
                      <div style={{ fontSize: '12px', color: '#4c1d95' }}>
                        <strong>AI Proposed Stage:</strong> {STAGE_LABELS[aiDraft.detectedStage as ClientStage]?.label || aiDraft.detectedStage}
                        {aiDraft.summaryUpdate && <span> • {aiDraft.summaryUpdate}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => setAiDraft(null)}
                      style={{ background: 'none', border: 'none', color: '#8b5cf6', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Quick Action Helpers */}
                <div style={{
                  padding: '8px 18px',
                  borderTop: '1px solid var(--line)',
                  background: '#fff',
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto'
                }}>
                  <button
                    type="button"
                    onClick={() => handleGenerateAiReply('Explain how our recommended service solves their specific problem')}
                    disabled={generatingAi}
                    className="service-chip"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    ✨ Explain Solution
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateAiReply('Address pricing, explain typical package range, and offer discovery walk-through')}
                    disabled={generatingAi}
                    className="service-chip"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    💰 Discuss Pricing
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateAiReply('Handle hesitation or objection politely and emphasize zero risk')}
                    disabled={generatingAi}
                    className="service-chip"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    🛡️ Address Objection
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateAiReply('Summarize proposed terms and invite them to finalize kickoff date')}
                    disabled={generatingAi}
                    className="service-chip"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    🏆 Propose Agreement
                  </button>
                </div>

                {/* Message Composer */}
                <form
                  onSubmit={handleSendMessage}
                  style={{
                    padding: '12px 18px',
                    borderTop: '1px solid var(--line)',
                    background: '#fff',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-end'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <textarea
                      rows={2}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={selectedClient.optedOut ? 'Client has opted out.' : 'Type your WhatsApp reply, or click Generate AI Reply...'}
                      disabled={selectedClient.optedOut || sendingMsg}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                      style={{ fontSize: '13px', padding: '10px 12px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => void handleGenerateAiReply()}
                      disabled={generatingAi || selectedClient.optedOut}
                      title="Generate context-aware AI reply using lead research"
                      className="service-chip"
                      style={{ padding: '8px 12px', fontSize: '11px', color: '#7c3aed', borderColor: '#ddd6fe', background: '#f5f3ff' }}
                    >
                      {generatingAi ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                      AI Reply
                    </button>

                    <button
                      type="submit"
                      disabled={sendingMsg || !inputMessage.trim() || selectedClient.optedOut}
                      style={{
                        background: 'linear-gradient(135deg, var(--primary), var(--primary-2))',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '12px',
                        padding: '8px 16px',
                        borderRadius: 10,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        opacity: sendingMsg || !inputMessage.trim() || selectedClient.optedOut ? 0.6 : 1
                      }}
                    >
                      {sendingMsg ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                      Send
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--muted)' }}>
                <Building2 size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <p>Select a prospective client from the left roster to view messages and manage outreach.</p>
              </div>
            )}
          </div>

          {/* Column 3: Lead Intelligence & Deal Closer Drawer */}
          <div style={{
            background: '#fff',
            borderRadius: 16,
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto'
          }}>
            {/* Drawer Tabs */}
            <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--line)', paddingBottom: 10, marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 8,
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  background: activeTab === 'chat' ? 'var(--soft)' : 'transparent',
                  color: activeTab === 'chat' ? 'var(--primary)' : '#64748b'
                }}
              >
                🔍 Research
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('close')}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 8,
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  background: activeTab === 'close' ? '#ecfdf5' : 'transparent',
                  color: activeTab === 'close' ? '#059669' : '#64748b'
                }}
              >
                🏆 Close Deal
              </button>
            </div>

            {selectedClient?.lead && activeTab === 'chat' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Score & Priority */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Lead Opportunity Score</span>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>
                      {selectedClient.lead.leadScore}/100
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Est. Deal Value</span>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>
                      {selectedClient.lead.estimatedDealValue || '$400 - $800'}
                    </div>
                  </div>
                </div>

                {/* Verified Problems & Weaknesses */}
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 800, color: '#1e293b' }}>
                    Verified Problems & Findings
                  </h4>
                  {selectedClient.lead.weaknesses && selectedClient.lead.weaknesses.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                      {selectedClient.lead.weaknesses.map((w, idx) => (
                        <li key={idx} style={{ marginBottom: 4 }}>{w}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>No verified technical weaknesses found.</p>
                  )}
                </div>

                {/* Recommended Services */}
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 800, color: '#1e293b' }}>
                    Recommended Solutions
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedClient.lead.recommendedServices?.map((s) => (
                      <span key={s} style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: 'var(--soft)',
                        color: 'var(--primary)',
                        fontWeight: 700
                      }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Analysis Summary */}
                {selectedClient.lead.analysisSummary && (
                  <div style={{
                    background: '#f8fafc',
                    padding: 10,
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    fontSize: '11px',
                    color: '#475569',
                    lineHeight: 1.45
                  }}>
                    <strong>Strategist Overview:</strong> {selectedClient.lead.analysisSummary}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Close Deal Form */}
            {selectedClient && activeTab === 'close' && (
              <form onSubmit={handleCloseDeal} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 800, color: '#065f46' }}>
                    Close Deal & Log Terms
                  </h3>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                    Confirm agreed deliverables, pricing, and optionally send a celebration alert to your WhatsApp.
                  </p>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Agreed Services
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {selectedClient.lead?.recommendedServices?.map((srv) => (
                      <label key={srv} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#475569', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={closingServices.includes(srv)}
                          onChange={(e) => {
                            if (e.target.checked) setClosingServices([...closingServices, srv]);
                            else setClosingServices(closingServices.filter((s) => s !== srv));
                          }}
                        />
                        {srv}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Finalized Deal Price ($)
                  </label>
                  <input
                    type="text"
                    value={closingPrice}
                    onChange={(e) => setClosingPrice(e.target.value)}
                    placeholder="e.g. $600/month or $1,200"
                    required
                    style={{ fontSize: '12px', padding: '7px 10px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Agreed Timeline
                  </label>
                  <input
                    type="text"
                    value={closingTimeline}
                    onChange={(e) => setClosingTimeline(e.target.value)}
                    placeholder="e.g. 1-2 weeks"
                    required
                    style={{ fontSize: '12px', padding: '7px 10px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Confirmed Deliverables
                  </label>
                  <textarea
                    rows={2}
                    value={closingDeliverables}
                    onChange={(e) => setClosingDeliverables(e.target.value)}
                    placeholder="e.g. Mobile-friendly website, WhatsApp booking bot setup"
                    required
                    style={{ fontSize: '12px', padding: '7px 10px' }}
                  />
                </div>

                {/* WhatsApp Notification Option */}
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 10,
                  padding: 10
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#166534', fontWeight: 700, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={notifyUserToggle}
                      onChange={(e) => setNotifyUserToggle(e.target.checked)}
                    />
                    Send Deal Alert to my WhatsApp
                  </label>
                  {notifyUserToggle && (
                    <input
                      type="text"
                      value={notifyUserPhone}
                      onChange={(e) => setNotifyUserPhone(e.target.value)}
                      placeholder="e.g. +923001234567"
                      style={{ fontSize: '11px', padding: '6px 8px', marginTop: 6 }}
                    />
                  )}
                </div>

                <button
                  type="submit"
                  disabled={closingBusy || closingServices.length === 0}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '12px',
                    padding: '10px 14px',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  {closingBusy ? <Loader2 size={14} className="spin" /> : <Trophy size={14} />}
                  Confirm Deal & Notify
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
