import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2, Check, ChevronDown, Copy, ExternalLink, FileSpreadsheet, Globe2,
  Loader2, Mail, MapPin, MessageCircle, Plus, Search, ShieldCheck, Sparkles,
  Star, Trash2, X, AlertCircle, CheckCircle2, TrendingUp, Clock, HelpCircle,
  Lightbulb, ListChecks, QrCode, Compass
} from 'lucide-react';
import { api } from './api/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeToggle } from './components/ThemeToggle';
import { ClientHandlerPage } from './pages/ClientHandlerPage';
import { WhatsAppPage } from './pages/WhatsAppPage';
import { JobFinderPage } from './pages/JobFinderPage';
import { useTheme } from './utils/theme';
import type { CustomService, Lead, LeadStats, LocationStatus, OutreachStrategy, Run, RunEvent, SearchForm, WhatsAppStatus } from './types';
import './styles.css';

const PREDEFINED_SERVICES = [
  'Website Development',
  'SEO',
  'Social Media Management',
  'AI Chatbot',
  'WhatsApp Automation',
  'CRM Automation',
  'Google Ads',
  'UGC Video Ads',
  'Branding & Design',
];

const DEFAULT_FORM: SearchForm = {
  userName: '',
  company: '',
  senderType: 'auto',
  userEmail: '',
  userPhone: '',
  portfolio: '',
  services: ['Website Development', 'SEO', 'WhatsApp Automation'],
  niche: '',
  area: '',
  country: '',
  maxLeads: 20,
  checkSocial: true,
  emailSummary: false,
};

function readForm(): SearchForm {
  try {
    return { ...DEFAULT_FORM, ...(JSON.parse(localStorage.getItem('client-hunter-form') || '{}') as Partial<SearchForm>) };
  } catch {
    return DEFAULT_FORM;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function sanitizeLead(lead: Partial<Lead>): Lead {
  return {
    runId: lead.runId || '',
    leadId: lead.leadId || `lead_${Math.random().toString(36).slice(2, 9)}`,
    businessName: lead.businessName || 'Unnamed Business',
    category: lead.category || '',
    leadType: lead.leadType || (lead.website ? 'Has Website' : 'No Website'),
    contactChannel: lead.contactChannel || 'Website Form Only',
    website: lead.website || '',
    email: lead.email || '',
    phone: lead.phone || '',
    whatsappLink: lead.whatsappLink || '',
    address: lead.address || '',
    country: lead.country || '',
    googleRating: lead.googleRating ?? '-',
    googleReviews: Number(lead.googleReviews) || 0,
    googleMapsUrl: lead.googleMapsUrl || '',
    locationStatus: (lead.locationStatus || 'Verified') as LocationStatus,
    locationVerified: lead.locationVerified ?? true,
    leadScore: Number(lead.leadScore) || 0,
    priority: lead.priority || 'medium',
    estimatedDealValue: lead.estimatedDealValue || '$300 - $800',
    recommendedServices: Array.isArray(lead.recommendedServices) ? lead.recommendedServices : [],
    weaknesses: Array.isArray(lead.weaknesses) ? lead.weaknesses : [],
    analysisSummary: lead.analysisSummary || '',
    strategy: lead.strategy,
    websiteScore: lead.websiteScore ?? null,
    websiteStatus: lead.websiteStatus || 'Unverified',
    websiteIssues: Array.isArray(lead.websiteIssues) ? lead.websiteIssues : [],
    websiteImages: Array.isArray(lead.websiteImages) ? lead.websiteImages : [],
    techStack: Array.isArray(lead.techStack) ? lead.techStack : [],
    social: lead.social || {},
    socialActivity: lead.socialActivity || {},
    socialStatus: lead.socialStatus || '',
    competitors: Array.isArray(lead.competitors) ? lead.competitors : [],
    emailSubject: lead.emailSubject || '',
    emailBodyText: lead.emailBodyText || '',
    emailBodyHtml: lead.emailBodyHtml || '',
    whatsappMessage: lead.whatsappMessage || '',
    approvalStatus: lead.approvalStatus || (lead.email ? 'Pending Review' : 'No Email'),
    emailStatus: lead.emailStatus || (lead.email ? 'Draft' : 'No Email'),
    responseStatus: lead.responseStatus || 'No Reply',
    senderName: lead.senderName || '',
    searchQuery: lead.searchQuery || '',
    createdAt: lead.createdAt || new Date().toISOString(),
    emailSentAt: lead.emailSentAt || '',
    followUp1Date: lead.followUp1Date || '',
    followUp2Date: lead.followUp2Date || '',
    gmailThreadId: lead.gmailThreadId || '',
    whatsappStatus: (lead.whatsappStatus || 'Not sent') as WhatsAppStatus,
    whatsappRunId: lead.whatsappRunId || '',
  };
}

function downloadCsv(leads: Lead[]): void {
  const columns = ['Lead ID', 'Business', 'Category', 'Address', 'Email', 'Phone', 'Website', 'Lead score', 'Priority', 'Website score', 'Recommended services', 'Summary'];
  const quote = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = leads.map((lead) => [
    lead.leadId,
    lead.businessName,
    lead.category,
    lead.address,
    lead.email,
    lead.phone,
    lead.website,
    lead.leadScore,
    lead.priority,
    lead.websiteScore ?? '',
    (lead.recommendedServices || []).join(', '),
    lead.analysisSummary,
  ].map(quote).join(','));

  const blob = new Blob([[columns.map(quote).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `client-hunter-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  useTheme();
  const [currentPage, setCurrentPage] = useState<'prospecting' | 'client-handler' | 'whatsapp' | 'job-finder'>('prospecting');
  const [waState, setWaState] = useState<string>('not_connected');
  const [token, setToken] = useState(api.token);
  const [accessCode, setAccessCode] = useState('');
  const [rememberCode, setRememberCode] = useState(true);
  const [form, setForm] = useState<SearchForm>(readForm);
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<{ sheetId: string; tab: string; title: string; url: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem('client-hunter-sheet') || 'null'); } catch { return null; }
  });
  const [sheetUrl, setSheetUrl] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState({ q: '', priority: '', type: '', contact: '', status: '', location: '', sort: 'score' });
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [sendingWa, setSendingWa] = useState<string | null>(null);

  // Stats & Custom Services
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [predefinedServices, setPredefinedServices] = useState<string[]>(PREDEFINED_SERVICES);
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [showAddService, setShowAddService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');

  useEffect(() => { localStorage.setItem('client-hunter-form', JSON.stringify(form)); }, [form]);

  useEffect(() => {
    return api.onAuthChange((newToken, reason) => {
      setToken(newToken);
      if (!newToken) {
        setRuns([]);
        setActiveRunId(null);
        setRunningId(null);
        setStats(null);
        if (reason) {
          setError(reason === 'Session expired or invalid.' ? 'Your session has expired. Please enter your access code to continue.' : reason);
        }
      }
    });
  }, []);

  const refreshStats = () => {
    if (!api.token) return;
    api.getStats().then(({ stats: s }) => setStats(s)).catch(() => {});
  };

  const refreshServices = () => {
    if (!api.token) return;
    api.getServices()
      .then((res) => {
        if (res.predefined?.length) setPredefinedServices(res.predefined);
        if (res.custom) setCustomServices(res.custom);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!token) return;
    void api.refreshSession();
    refreshStats();
    refreshServices();

    const loadRuns = (retryCount = 0) => {
      api.listRuns()
        .then(({ runs: remote }) => {
          const sanitizedRuns = remote.map((r) => ({
            ...r,
            leads: (r.leads || []).map(sanitizeLead),
          }));
          setRuns(sanitizedRuns);
          if (sanitizedRuns[0]) setActiveRunId(sanitizedRuns[0].runId);
          setError('');
        })
        .catch((cause) => {
          if (retryCount < 3 && cause instanceof Error && cause.message.toLowerCase().includes('fetch')) {
            window.setTimeout(() => loadRuns(retryCount + 1), 1000);
            return;
          }
          if (api.token) {
            setError(cause instanceof Error ? cause.message : 'Could not load saved runs.');
          }
        });
    };
    loadRuns();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const unsub = api.subscribeWhatsAppEvents((info) => {
      setWaState(info.state);
    });
    return () => {
      unsub();
    };
  }, [token]);

  useEffect(() => {
    if (!runningId || !token) return;
    let stopped = false;
    let after = 0;
    let consecutiveFailures = 0;

    const poll = async () => {
      if (stopped || !api.token) return;
      try {
        const result = await api.getEvents(runningId, after);
        consecutiveFailures = 0;
        if (result.events.length) {
          after = Math.max(after, ...result.events.map((event) => event.seq));
          setEvents((current) => [...current, ...result.events]);
        }
        if (result.run.status === 'done' || result.run.status === 'error') {
          const full = await api.getRun(runningId);
          const cleanLeads = (full.leads || []).map(sanitizeLead);
          const cleanRun = { ...full.run, leads: cleanLeads };
          setRuns((current) => [cleanRun, ...current.filter((run) => run.runId !== cleanRun.runId)]);
          setRunningId(null);
          setActiveRunId(runningId);
          refreshStats();
          setNotice(full.run.status === 'done' ? full.run.message : full.run.message);
          return;
        }
      } catch (cause) {
        if (!api.token) return;
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          setError(cause instanceof Error ? cause.message : 'The run could not be checked.');
        }
      }
      if (!stopped && api.token) {
        window.setTimeout(poll, 2500);
      }
    };
    void poll();
    return () => { stopped = true; };
  }, [runningId, token]);

  const activeRun = runs.find((run) => run.runId === activeRunId) || null;
  const allLeads = activeRun?.leads || [];

  const filtered = useMemo(() => {
    return allLeads.filter((lead) => {
      const rec = (lead.recommendedServices || []).join(' ');
      const haystack = [lead.businessName, lead.category, lead.address, lead.email, lead.phone, lead.website, rec].join(' ').toLowerCase();
      if (filters.q && !haystack.includes(filters.q.toLowerCase())) return false;
      if (filters.priority && lead.priority !== filters.priority) return false;
      if (filters.type && lead.leadType !== filters.type) return false;
      if (filters.contact === 'email' && !lead.email) return false;
      if (filters.contact === 'phone' && (lead.email || !lead.phone)) return false;
      if (filters.status && lead.responseStatus !== filters.status) return false;
      if (filters.location === 'verified' && !lead.locationVerified) return false;
      return true;
    }).sort((a, b) => {
      if (filters.sort === 'rating') return Number(b.googleRating || 0) - Number(a.googleRating || 0);
      if (filters.sort === 'reviews') return (b.googleReviews || 0) - (a.googleReviews || 0);
      if (filters.sort === 'name') return (a.businessName || '').localeCompare(b.businessName || '');
      if (filters.sort === 'website') return (a.websiteScore ?? -1) - (b.websiteScore ?? -1);
      return (b.leadScore || 0) - (a.leadScore || 0);
    });
  }, [allLeads, filters]);

  const previewGreeting = useMemo(() => {
    const rawName = form.userName?.trim() || '';
    const rawCompany = form.company?.trim() || '';
    if (!rawName && !rawCompany) return '';

    const type = form.senderType || 'auto';
    const isCompanyKeyword = (str: string) => {
      const s = str.toLowerCase();
      return /(solution|solutions|tech|technologies|agency|media|digital|systems|studio|labs|group|services|enterprises|consulting|ventures|holdings|corp|ltd|llc|inc)\b/.test(s);
    };

    let resolvedType: 'person' | 'company' = 'person';
    let personName = rawName;
    let companyName = rawCompany;

    if (type === 'company') {
      resolvedType = 'company';
      companyName = rawCompany || rawName;
    } else if (type === 'person') {
      resolvedType = 'person';
      personName = rawName || rawCompany;
    } else {
      if (rawName && !rawCompany) {
        if (isCompanyKeyword(rawName)) {
          resolvedType = 'company';
          companyName = rawName;
        } else {
          resolvedType = 'person';
          personName = rawName;
        }
      } else if (!rawName && rawCompany) {
        if (!isCompanyKeyword(rawCompany) && !rawCompany.includes(' ')) {
          resolvedType = 'person';
          personName = rawCompany;
        } else {
          resolvedType = 'company';
          companyName = rawCompany;
        }
      } else if (rawName && rawCompany) {
        if (rawName.toLowerCase() === rawCompany.toLowerCase()) {
          if (isCompanyKeyword(rawName)) {
            resolvedType = 'company';
            companyName = rawName;
          } else {
            resolvedType = 'person';
            personName = rawName;
          }
        } else {
          resolvedType = 'person';
          personName = rawName;
          companyName = rawCompany;
        }
      }
    }

    if (resolvedType === 'company') {
      return `Hi [Business] team, I'm reaching out from ${companyName || 'our company'}. I wanted to discuss...`;
    }
    if (personName && companyName && personName.toLowerCase() !== companyName.toLowerCase()) {
      return `Hi [Business] team, my name is ${personName} from ${companyName}. I wanted to reach out regarding...`;
    }
    return `Hi [Business] team, my name is ${personName || 'my name'}. I wanted to reach out regarding...`;
  }, [form.userName, form.company, form.senderType]);

  function setField<K extends keyof SearchForm>(key: K, value: SearchForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleService(service: string) {
    setField('services', form.services.includes(service) ? form.services.filter((value) => value !== service) : [...form.services, service]);
  }

  async function handleAddCustomService(e: React.FormEvent) {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    try {
      const res = await api.addCustomService(newServiceName, newServiceDesc);
      setCustomServices((current) => [...current, res.service]);
      if (!form.services.includes(res.service.name)) {
        setField('services', [...form.services, res.service.name]);
      }
      setNewServiceName('');
      setNewServiceDesc('');
      setShowAddService(false);
      setNotice(`Added custom service: ${res.service.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add service.');
    }
  }

  async function handleDeleteCustomService(id: string, name: string) {
    try {
      await api.deleteCustomService(id);
      setCustomServices((current) => current.filter((s) => s.id !== id));
      setField('services', form.services.filter((s) => s !== name));
      setNotice(`Removed custom service: ${name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove service.');
    }
  }

  async function handleDeleteLead(leadId: string, businessName: string) {
    if (!window.confirm(`Delete ${businessName} from your leads database?`)) return;
    try {
      const result = await api.deleteLead(leadId);
      setRuns((current) => current.map((r) => ({
        ...r,
        leads: (r.leads || []).filter((l) => l.leadId !== leadId),
      })));
      if (result.stats) setStats(result.stats);
      setNotice(`${businessName} was permanently removed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete lead.');
    }
  }

  async function handleDeleteRun(runId: string, niche: string, area: string) {
    if (!window.confirm(`Delete the saved search "${niche}" in ${area}? All associated leads from this run will also be removed.`)) return;
    try {
      const res = await api.deleteRun(runId);
      setRuns((current) => {
        const remaining = current.filter((r) => r.runId !== runId);
        if (activeRunId === runId) {
          setActiveRunId(remaining[0]?.runId || null);
        }
        return remaining;
      });
      if (res.stats) setStats(res.stats);
      setNotice(`Deleted saved search: ${niche}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete saved search.');
    }
  }

  function handleLoadRunBrief(run: Run) {
    setForm((current) => ({
      ...current,
      niche: run.request.niche,
      area: run.request.area,
      country: run.request.country,
      services: run.request.services?.length ? run.request.services : current.services,
    }));
    window.scrollTo({ top: 300, behavior: 'smooth' });
    setNotice(`Loaded "${run.request.niche}" into search brief. You can run or modify it.`);
  }

  async function handleClearEmptyRuns() {
    const emptyRuns = runs.filter((r) => (r.leads?.length ?? r.total) === 0);
    if (!emptyRuns.length) return;
    if (!window.confirm(`Remove all ${emptyRuns.length} empty search boxes?`)) return;
    try {
      for (const r of emptyRuns) {
        await api.deleteRun(r.runId);
      }
      setRuns((current) => {
        const remaining = current.filter((r) => (r.leads?.length ?? r.total) > 0);
        if (emptyRuns.some((r) => r.runId === activeRunId)) {
          setActiveRunId(remaining[0]?.runId || null);
        }
        return remaining;
      });
      refreshStats();
      setNotice(`Cleared ${emptyRuns.length} empty search boxes.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear empty searches.');
    }
  }

  async function login() {
    setError('');
    setBusy(true);
    try {
      await api.login(accessCode, rememberCode);
      setToken(api.token);
      setAccessCode('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function startSearch(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!form.services.length) return setError('Choose at least one service to offer.');
    setBusy(true);
    try {
      const result = await api.startRun(form, sheet ? { sheetId: sheet.sheetId, tab: sheet.tab } : undefined);
      const run: Run = {
        runId: result.runId,
        status: 'running',
        request: form,
        message: 'Search started.',
        total: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
        leads: [],
      };
      setRuns((current) => [run, ...current]);
      setActiveRunId(run.runId);
      setRunningId(run.runId);
      setEvents([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the search.');
    } finally {
      setBusy(false);
    }
  }

  async function connectSheet() {
    setError('');
    setBusy(true);
    try {
      const result = await api.connectSheet(sheetUrl);
      setSheet(result.sheet);
      localStorage.setItem('client-hunter-sheet', JSON.stringify(result.sheet));
      setSheetUrl('');
      setNotice(`Connected ${result.sheet.title}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google Sheet could not be connected.');
    } finally {
      setBusy(false);
    }
  }

  function copy(value: string, label: string) {
    void navigator.clipboard?.writeText(value);
    setNotice(`${label} copied.`);
  }

  function manualGmail(lead: Lead) {
    if (!lead.email) return;
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(lead.emailSubject || '')}&body=${encodeURIComponent(lead.emailBodyText || '')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-theme-corner">
          <ThemeToggle />
        </div>
        <div className="auth-card">
          <div className="brand-mark"><Search size={20} /></div>
          <p className="eyebrow">CLIENT HUNTER</p>
          <h1>Find better prospects, safely.</h1>
          <p className="muted">This frontend talks to your separated backend. No API keys or WhatsApp secrets are stored in the browser.</p>
          <label>
            Access code
            <input
              type="password"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void login(); }}
              placeholder="Enter your access code"
              autoFocus
            />
          </label>
          <label className="toggle-remember" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', margin: '6px 0 12px 0' }}>
            <input type="checkbox" checked={rememberCode} onChange={(event) => setRememberCode(event.target.checked)} />
            <span>Stay signed in on this device (auto-reconnect)</span>
          </label>
          {error && <Alert kind="error" onClose={() => setError('')}>{error}</Alert>}
          <button className="button primary full" disabled={busy || !accessCode.trim()} onClick={() => void login()}>
            {busy ? <><Loader2 className="spin" size={17} /> Checking…</> : <>Continue <ChevronDown size={17} /></>}
          </button>
          <div className="secure-note"><ShieldCheck size={16} /> Sessions stay active for 30 days and auto-refresh while active.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div className="brand">
              <span className="brand-icon"><Search size={19} /></span>
              <span>Client Hunter</span>
            </div>
            <nav style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setCurrentPage('prospecting')}
                style={{
                  background: currentPage === 'prospecting' ? 'rgba(255,255,255,0.18)' : 'transparent',
                  color: '#fff',
                  border: currentPage === 'prospecting' ? '1px solid rgba(255,255,255,0.25)' : '1px solid transparent',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer'
                }}
              >
                <Search size={13} />
                Prospecting & Leads
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage('client-handler')}
                style={{
                  background: currentPage === 'client-handler' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                  color: '#fff',
                  border: currentPage === 'client-handler' ? '1px solid rgba(16,185,129,0.5)' : '1px solid transparent',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer'
                }}
              >
                <MessageCircle size={13} />
                Client Handler
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage('whatsapp')}
                style={{
                  background: currentPage === 'whatsapp' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent',
                  color: '#fff',
                  border: currentPage === 'whatsapp' ? '1px solid rgba(2,132,199,0.5)' : '1px solid transparent',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer'
                }}
              >
                <QrCode size={13} />
                WhatsApp
                {waState === 'connected' ? (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} title="Connected" />
                ) : waState === 'waiting_for_qr' ? (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} title="Waiting for QR scan" />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage('job-finder')}
                style={{
                  background: currentPage === 'job-finder' ? 'linear-gradient(135deg, #06b6d4, #4f46e5)' : 'transparent',
                  color: '#fff',
                  border: currentPage === 'job-finder' ? '1px solid rgba(6,182,212,0.6)' : '1px solid transparent',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer'
                }}
              >
                <Compass size={13} />
                AI Job Finder
              </button>
            </nav>
          </div>
          <div className="top-actions">
            <span className="status-chip"><span className="status-dot" /> Backend connected</span>
            <ThemeToggle />
            <button className="button ghost" onClick={() => { api.logout(); setToken(null); }}>Sign out</button>
          </div>
        </div>
      </header>

      {currentPage === 'client-handler' ? (
        <ClientHandlerPage
          userPhoneDefault={form.userPhone}
          onBackToProspecting={() => setCurrentPage('prospecting')}
        />
      ) : currentPage === 'whatsapp' ? (
        <WhatsAppPage
          onNavigateToClientHandler={() => setCurrentPage('client-handler')}
        />
      ) : currentPage === 'job-finder' ? (
        <JobFinderPage
          onBackToProspecting={() => setCurrentPage('prospecting')}
        />
      ) : (
        <>
          <section className="hero">
        <div className="hero-inner">
          <div>
            <p className="eyebrow">SECURE LOCAL PROSPECTING</p>
            <h1>Find local businesses that are <span>ready for help.</span></h1>
            <p className="hero-copy">Discover businesses, audit public website signals, identify operational gaps beyond websites, and generate practical outreach strategies without exposing credentials to the browser.</p>
            <div className="hero-badges">
              <span><MapPin size={14} /> Strict Location Targeting</span>
              <span><ShieldCheck size={14} /> Persistent Deduplication</span>
              <span><Globe2 size={14} /> SSRF-Protected Audits</span>
              <span><Sparkles size={14} /> 8-Part Outreach Strategy</span>
            </div>
          </div>
          <div className="hero-side">
            <div className="hero-stat"><strong>{stats?.totalUniqueLeads ?? allLeads.length}</strong><span>unique stored leads</span></div>
            <div className="hero-stat"><strong>{runs.length}</strong><span>saved searches</span></div>
          </div>
        </div>
      </section>

      <main className="content">
        {/* Dedicated Total Leads Stats Banner */}
        {stats && (
          <div className="stats-banner">
            <div className="stat-box highlight">
              <strong>{stats.totalUniqueLeads}</strong>
              <span>Total Unique Prospects</span>
            </div>
            <div className="stat-box success">
              <strong>{stats.verifiedLeads}</strong>
              <span>Target Locality Matches</span>
            </div>
            <div className="stat-box">
              <strong>{stats.leadsWithPhone}</strong>
              <span>WhatsApp / Phone Ready</span>
            </div>
            <div className="stat-box">
              <strong>{stats.leadsWithEmail}</strong>
              <span>Verified Email Contacts</span>
            </div>
          </div>
        )}

        <section className="card search-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">01 · SEARCH BRIEF</p>
              <h2>Tell us who you are looking for</h2>
              <p className="muted">Live providers are optional. The backend always has a safe deterministic fallback for local development.</p>
            </div>
            <span className="security-label"><ShieldCheck size={15} /> Secrets stay server-side</span>
          </div>

          <form onSubmit={startSearch} className="form-grid">
            <Field label="Your name">
              <input value={form.userName} onChange={(event) => setField('userName', event.target.value)} placeholder="e.g. Ali Khan" required />
            </Field>
            <Field label="Company / brand">
              <input value={form.company} onChange={(event) => setField('company', event.target.value)} placeholder="e.g. Unitech Solution (Optional)" />
            </Field>

            <Field label="Sender identity & introduction" wide>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { id: 'auto', label: 'Auto-detect' },
                    { id: 'person', label: 'Personal Name (e.g. Ali)' },
                    { id: 'company', label: 'Company / Agency (e.g. Unitech Solution)' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`service-chip ${(form.senderType || 'auto') === item.id ? 'selected' : ''}`}
                      onClick={() => setField('senderType', item.id as any)}
                    >
                      {(form.senderType || 'auto') === item.id && <Check size={14} />}
                      {item.label}
                    </button>
                  ))}
                </div>
                {previewGreeting && (
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--ink-2)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Sparkles size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span><strong>Intro preview:</strong> <em>"{previewGreeting}"</em></span>
                  </div>
                )}
              </div>
            </Field>
            <Field label="Your email">
              <input type="email" value={form.userEmail} onChange={(event) => setField('userEmail', event.target.value)} placeholder="you@company.com" required />
            </Field>
            <Field label="Phone / WhatsApp">
              <input value={form.userPhone} onChange={(event) => setField('userPhone', event.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Portfolio link" wide>
              <input value={form.portfolio} onChange={(event) => setField('portfolio', event.target.value)} placeholder="https://yourwebsite.com" />
            </Field>

            <Field label="Services you sell (Predefined & Custom)" wide>
              <div className="service-chips">
                {predefinedServices.map((service) => (
                  <button
                    key={service}
                    type="button"
                    className={`service-chip ${form.services.includes(service) ? 'selected' : ''}`}
                    onClick={() => toggleService(service)}
                  >
                    {form.services.includes(service) && <Check size={14} />}
                    {service}
                  </button>
                ))}

                {customServices.map((service) => (
                  <span key={service.id} className="custom-service-chip">
                    <button
                      type="button"
                      onClick={() => toggleService(service.name)}
                      style={{ fontWeight: form.services.includes(service.name) ? 800 : 600 }}
                    >
                      {form.services.includes(service.name) && <Check size={13} style={{ marginRight: 3 }} />}
                      {service.name}
                    </button>
                    <button
                      type="button"
                      title="Delete custom service"
                      onClick={(e) => { e.stopPropagation(); void handleDeleteCustomService(service.id, service.name); }}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}

                <button
                  type="button"
                  className="service-chip"
                  style={{ borderStyle: 'dashed' }}
                  onClick={() => setShowAddService(!showAddService)}
                >
                  <Plus size={14} /> Add custom service
                </button>
              </div>

              {showAddService && (
                <div className="add-service-box">
                  <input
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    placeholder="New service name (e.g. Dental Implant Funnel)"
                  />
                  <input
                    value={newServiceDesc}
                    onChange={(e) => setNewServiceDesc(e.target.value)}
                    placeholder="Optional description"
                  />
                  <button type="button" className="button primary small-button" onClick={handleAddCustomService}>
                    Save Service
                  </button>
                  <button type="button" className="button ghost small-button" style={{ color: '#6b7690' }} onClick={() => setShowAddService(false)}>
                    Cancel
                  </button>
                </div>
              )}
            </Field>

            <Field label="Business niche">
              <input value={form.niche} onChange={(event) => setField('niche', event.target.value)} placeholder="Dental clinics, restaurants…" required />
            </Field>
            <Field label="Target Area / Locality (Strict Filtering)">
              <input value={form.area} onChange={(event) => setField('area', event.target.value)} placeholder="Peoples Colony, Gujranwala" required />
            </Field>
            <Field label="Country">
              <input value={form.country} onChange={(event) => setField('country', event.target.value)} placeholder="Pakistan" required />
            </Field>
            <Field label={`New leads: ${form.maxLeads}`}>
              <input type="range" min="1" max="100" step="1" value={form.maxLeads} onChange={(event) => setField('maxLeads', Number(event.target.value))} />
            </Field>

            <label className="toggle">
              <input type="checkbox" checked={form.checkSocial} onChange={(event) => setField('checkSocial', event.target.checked)} />
              <span><strong>Check social activity</strong><small>Uses Apify only when configured; failures never stop a run.</small></span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={form.emailSummary} onChange={(event) => setField('emailSummary', event.target.checked)} />
              <span><strong>Email a summary</strong><small>Reserved for the optional SMTP connector.</small></span>
            </label>

            <div className="form-actions">
              <button className="button primary" type="submit" disabled={busy || Boolean(runningId)}>
                {busy ? <><Loader2 className="spin" size={18} /> Starting…</> : <><Sparkles size={18} /> Find new leads</>}
              </button>
              {runningId && <span className="muted">A search is running below. You can keep this page open.</span>}
            </div>
          </form>
        </section>

        <section className="card integration-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">02 · OPTIONAL CONNECTOR</p>
              <h2><FileSpreadsheet size={21} /> Google Sheet sync</h2>
              <p className="muted">Connect a sheet only if you want an external copy. SQLite remains the backend source of truth.</p>
            </div>
            {sheet ? <span className="pill success"><Check size={14} /> Connected</span> : <span className="pill">Optional</span>}
          </div>
          {sheet ? (
            <div className="connected-row">
              <div>
                <strong>{sheet.title}</strong>
                <span className="muted">Tab: {sheet.tab}</span>
              </div>
              <div className="row-actions">
                <a className="button soft" href={sheet.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open</a>
                <button className="button danger" onClick={() => { setSheet(null); localStorage.removeItem('client-hunter-sheet'); }}>Disconnect</button>
              </div>
            </div>
          ) : (
            <div className="connect-row">
              <input value={sheetUrl} onChange={(event) => setSheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
              <button className="button soft" disabled={busy || !sheetUrl.trim()} onClick={() => void connectSheet()}>Connect sheet</button>
            </div>
          )}
        </section>

        {runningId && <ProgressCard events={events} />}
        {error && <Alert kind="error" onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert>}

        <section className="results-layout">
          <aside className="card history">
            <div className="section-heading" style={{ marginBottom: 14 }}>
              <div>
                <p className="eyebrow">03 · HISTORY</p>
                <h2>Saved searches</h2>
              </div>
              {runs.some((r) => (r.leads?.length ?? r.total) === 0) && (
                <button
                  type="button"
                  className="button ghost small-button"
                  style={{ color: '#ef4444', borderColor: '#fca5a5', padding: '4px 8px', fontSize: 11 }}
                  title="Clear searches with 0 leads"
                  onClick={() => void handleClearEmptyRuns()}
                >
                  Clear 0s
                </button>
              )}
            </div>
            {runs.length === 0 ? (
              <p className="muted">Your completed runs will appear here.</p>
            ) : (
              <div className="history-list">
                {runs.map((run) => (
                  <div
                    key={run.runId}
                    role="button"
                    tabIndex={0}
                    className={`history-item ${activeRunId === run.runId ? 'active' : ''}`}
                    onClick={() => setActiveRunId(run.runId)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveRunId(run.runId); }}
                  >
                    <div className="history-item-content">
                      <strong>{run.request.niche}</strong>
                      <small>{run.request.area}, {run.request.country}<br />{formatDate(run.createdAt)}</small>
                    </div>

                    <div className="history-item-actions">
                      <b className={run.status} title={`${run.leads?.length ?? run.total} leads`}>
                        {run.status === 'running' ? '…' : (run.leads?.length ?? run.total)}
                      </b>
                      <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                        <button
                          type="button"
                          className="history-load-btn"
                          title="Add/Load this niche into Search Brief"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadRunBrief(run);
                          }}
                        >
                          <Plus size={13} />
                        </button>
                        <button
                          type="button"
                          className="history-del-btn"
                          title="Delete this saved niche search"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteRun(run.runId, run.request.niche, run.request.area);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <section className="card results">
            <div className="results-header">
              <div>
                <p className="eyebrow">04 · RESULTS</p>
                <h2>{activeRun ? `${activeRun.request.niche} in ${activeRun.request.area}` : 'Your lead workspace'}</h2>
                <p className="muted">{activeRun ? activeRun.message : 'Run a search to populate your workspace.'}</p>
              </div>
              {activeRun && allLeads.length > 0 && (
                <button className="button soft" onClick={() => downloadCsv(allLeads)}>
                  <ExternalLink size={15} /> Export CSV
                </button>
              )}
            </div>

            {activeRun ? (
              <>
                <div className="metrics">
                  <Metric label="View leads" value={allLeads.length} />
                  <Metric label="Verified Area" value={allLeads.filter((lead) => lead.locationVerified).length} tone="success" />
                  <Metric label="High priority" value={allLeads.filter((lead) => lead.priority === 'high').length} tone="danger" />
                  <Metric label="With email" value={allLeads.filter((lead) => Boolean(lead.email)).length} tone="primary" />
                  <Metric label="Phone only" value={allLeads.filter((lead) => !lead.email && Boolean(lead.phone)).length} tone="amber" />
                </div>

                <div className="toolbar">
                  <div className="search-input">
                    <Search size={16} />
                    <input
                      value={filters.q}
                      onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                      placeholder="Search name, area, email…"
                    />
                  </div>
                  <select value={filters.location} onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}>
                    <option value="">All Locations</option>
                    <option value="verified">Verified Area Only</option>
                  </select>
                  <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}>
                    <option value="">All priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
                    <option value="">All website types</option>
                    <option value="Has Website">Has website</option>
                    <option value="No Website">No website</option>
                  </select>
                  <select value={filters.contact} onChange={(event) => setFilters((current) => ({ ...current, contact: event.target.value }))}>
                    <option value="">Any contact</option>
                    <option value="email">Has email</option>
                    <option value="phone">Phone only</option>
                  </select>
                  <select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}>
                    <option value="score">Best score</option>
                    <option value="rating">Highest rating</option>
                    <option value="reviews">Most reviews</option>
                    <option value="website">Weakest website</option>
                    <option value="name">Name A-Z</option>
                  </select>
                </div>

                {filtered.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="lead-list">
                    {filtered.map((lead) => (
                      <ErrorBoundary key={lead.leadId} fallbackTitle={`Display error on ${lead.businessName}`}>
                        <LeadCard
                          lead={lead}
                          expanded={Boolean(expanded[lead.leadId])}
                          tab={activeTab[lead.leadId] || 'strategy'}
                          onToggle={() => setExpanded((current) => ({ ...current, [lead.leadId]: !current[lead.leadId] }))}
                          onTab={(tab) => setActiveTab((current) => ({ ...current, [lead.leadId]: tab }))}
                          onCopy={copy}
                          onGmail={() => manualGmail(lead)}
                          onDelete={() => void handleDeleteLead(lead.leadId, lead.businessName)}
                          sendingEmail={sendingEmail === lead.leadId}
                          sendingWa={sendingWa === lead.leadId}
                          onEmail={async (payload) => {
                            setError('');
                            setSendingEmail(lead.leadId);
                            try {
                              await api.sendEmail(lead.leadId, { ...payload, replyTo: form.userEmail });
                              const updated = await api.getRun(activeRun.runId);
                              setRuns((current) => current.map((run) => run.runId === activeRun.runId ? { ...run, leads: (updated.leads || []).map(sanitizeLead) } : run));
                              setNotice('Email sent.');
                            } catch (cause) {
                              setError(cause instanceof Error ? cause.message : 'Email could not be sent.');
                            } finally {
                              setSendingEmail(null);
                            }
                          }}
                          onWhatsApp={async (number, message, resend) => {
                            setError('');
                            setSendingWa(lead.leadId);
                            try {
                              await api.sendWhatsApp(lead.leadId, { businessName: lead.businessName, number, message, resend });
                              const updated = await api.getRun(activeRun.runId);
                              setRuns((current) => current.map((run) => run.runId === activeRun.runId ? { ...run, leads: (updated.leads || []).map(sanitizeLead) } : run));
                              setNotice('WhatsApp request completed.');
                            } catch (cause) {
                              setError(cause instanceof Error ? cause.message : 'WhatsApp could not be sent.');
                            } finally {
                              setSendingWa(null);
                            }
                          }}
                          onOpenClientHandler={() => setCurrentPage('client-handler')}
                        />
                      </ErrorBoundary>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <EmptyState title="No saved search selected" text="Complete the brief above and your leads will appear here." />
            )}
          </section>
        </section>
      </main>
      </>
      )}

      <footer>
        <span>Client Hunter · secure split frontend/backend architecture</span>
        <span>SQLite persistence · explicit provider connectors · safe fallback mode</span>
      </footer>
    </div>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={wide ? 'field wide' : 'field'}><span>{label}</span>{children}</label>;
}

function Alert({ children, kind, onClose }: { children: React.ReactNode; kind: 'error' | 'success'; onClose?: () => void }) {
  return <div className={`alert ${kind}`}><span>{children}</span>{onClose && <button onClick={onClose} aria-label="Close"><X size={16} /></button>}</div>;
}

function Metric({ label, value, tone = '' }: { label: string; value: number; tone?: string }) {
  return <div className={`metric ${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}

function ProgressCard({ events }: { events: RunEvent[] }) {
  const stages = ['start', 'maps', 'websites', 'social', 'final', 'done'];
  const latest = events[events.length - 1];
  const active = latest?.stage || 'start';
  const index = Math.max(0, stages.indexOf(active));

  return (
    <section className="card progress-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">LIVE PIPELINE</p>
          <h2>Finding and auditing prospects…</h2>
          <p className="muted">The backend is processing this run. Partial lead facts appear as they become available.</p>
        </div>
        <Loader2 className="spin purple" size={22} />
      </div>
      <div className="stepper">
        {stages.slice(1).map((stage, index2) => (
          <div key={stage} className={`step ${index >= index2 + 1 ? 'done' : index === index2 ? 'current' : ''}`}>
            <span>{index >= index2 + 1 ? <Check size={15} /> : index2 + 1}</span>
            <small>{stage === 'maps' ? 'Maps' : stage[0].toUpperCase() + stage.slice(1)}</small>
          </div>
        ))}
      </div>
      <div className="event-log">
        {events.slice(-12).map((event) => (
          <div key={event.seq} className={event.level}>
            <time>{new Date(event.createdAt).toLocaleTimeString()}</time>
            <span>{event.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ title = 'No leads match these filters', text = 'Try changing the filters or run a new search.' }: { title?: string; text?: string }) {
  return (
    <div className="empty">
      <Building2 size={34} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

interface LeadCardProps {
  lead: Lead;
  expanded: boolean;
  tab: string;
  onToggle: () => void;
  onTab: (tab: string) => void;
  onCopy: (value: string, label: string) => void;
  onGmail: () => void;
  onDelete: () => void;
  sendingEmail: boolean;
  sendingWa: boolean;
  onEmail: (payload: { to: string; subject: string; html: string; text: string }) => Promise<void>;
  onWhatsApp: (number: string, message: string, resend: boolean) => Promise<void>;
  onOpenClientHandler?: () => void;
}

function LeadCard({
  lead, expanded, tab, onToggle, onTab, onCopy, onGmail, onDelete,
  sendingEmail, sendingWa, onEmail, onWhatsApp, onOpenClientHandler
}: LeadCardProps) {
  const initialWaNumber = lead.whatsappLink ? lead.whatsappLink.replace('https://wa.me/', '') : (lead.phone || '').replace(/\D/g, '');
  const [emailSubject, setEmailSubject] = useState(lead.emailSubject || '');
  const [emailHtml, setEmailHtml] = useState(lead.emailBodyHtml || '');
  const [emailText, setEmailText] = useState(lead.emailBodyText || '');
  const [waNumber, setWaNumber] = useState(initialWaNumber);
  const [waMessage, setWaMessage] = useState(lead.whatsappMessage || '');
  const scoreColor = (lead.leadScore || 0) >= 70 ? 'danger' : (lead.leadScore || 0) >= 40 ? 'amber' : 'muted';

  const strategy = lead.strategy;

  return (
    <article className={`lead-card ${expanded ? 'expanded' : ''}`}>
      <div className="lead-summary">
        <div className={`score-ring ${scoreColor}`}>
          <strong>{lead.leadScore || 0}</strong>
          <span>/100</span>
        </div>

        <div className="lead-main">
          <div className="lead-title">
            <h3>{lead.businessName}</h3>
            <span className={`priority ${lead.priority}`}>{lead.priority} priority</span>
            <span className={`website-pill ${lead.leadType === 'No Website' ? 'no' : ''}`}>{lead.leadType}</span>
            {lead.locationVerified ? (
              <span className="pill success" title="Address matches target locality and city">
                <Check size={12} /> Verified Location
              </span>
            ) : (
              <span className="pill amber" title={lead.locationStatus || 'Unverified Locality'}>
                {lead.locationStatus || 'Unverified'}
              </span>
            )}
          </div>

          <p className="muted small">{lead.category} · {lead.address}</p>

          <div className="lead-facts">
            <span><Star size={14} /> {lead.googleRating || '-'} <small>({lead.googleReviews || 0} reviews)</small></span>
            <span><Globe2 size={14} /> {lead.websiteScore === null ? 'No website' : `${lead.websiteScore}/100`}</span>
            <span><Sparkles size={14} /> {lead.estimatedDealValue}</span>
          </div>

          <div className="contact-row">
            {lead.email ? (
              <button onClick={() => onCopy(lead.email, 'Email')} title="Verified email found on website">
                <Mail size={14} /> {lead.email}
              </button>
            ) : (
              <span className="pill" style={{ fontSize: 11, color: '#94a3b8' }}>
                <Mail size={13} style={{ opacity: 0.6 }} /> No email found
              </span>
            )}

            {lead.phone && (
              <a href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`}>
                <MessageCircle size={14} /> {lead.phone}
              </a>
            )}

            {lead.website && (
              <a href={lead.website} target="_blank" rel="noreferrer">
                <Globe2 size={14} /> Website
              </a>
            )}

            {lead.googleMapsUrl && (
              <a href={lead.googleMapsUrl} target="_blank" rel="noreferrer">
                <MapPin size={14} /> Map
              </a>
            )}
          </div>
        </div>

        <div className="lead-actions">
          {onOpenClientHandler && (
            <button
              type="button"
              className="button ghost small-button"
              title="Open full conversation and AI client handler for this business"
              onClick={onOpenClientHandler}
              style={{ color: '#059669', borderColor: '#a7f3d0', background: '#ecfdf5' }}
            >
              <MessageCircle size={14} /> Open in Client Handler
            </button>
          )}

          {lead.email && (
            <button
              className="button primary small-button"
              onClick={() => onEmail({ to: lead.email, subject: emailSubject, html: emailHtml, text: emailText })}
              disabled={sendingEmail}
            >
              <Mail size={14} /> {sendingEmail ? 'Sending…' : lead.emailStatus === 'Sent' ? 'Send again' : 'Send email'}
            </button>
          )}

          {lead.whatsappLink && (
            <button
              className="button whatsapp small-button"
              onClick={() => void onWhatsApp(waNumber, waMessage, lead.whatsappStatus === 'Sent')}
              disabled={sendingWa}
            >
              <MessageCircle size={14} /> {sendingWa ? 'Sending…' : lead.whatsappStatus && lead.whatsappStatus !== 'Not sent' ? lead.whatsappStatus : 'WhatsApp'}
            </button>
          )}

          <button className="button soft small-button" onClick={onToggle}>
            {expanded ? 'Hide details' : 'View details'} <ChevronDown size={14} className={expanded ? 'rotate' : ''} />
          </button>

          <button
            className="button delete-btn small-button"
            onClick={onDelete}
            title="Permanently remove this lead from SQLite database"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className="lead-details">
          <div className="tabs">
            {['strategy', 'overview', 'whatsapp', 'email', 'website'].map((item) => (
              <button
                key={item}
                className={tab === item ? 'active' : ''}
                onClick={() => onTab(item)}
              >
                {item === 'strategy' ? '🎯 Outreach Strategy (8-Part)' : item === 'whatsapp' ? 'WhatsApp' : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>

          {/* TAB: 8-Part Structured Outreach Strategy */}
          {tab === 'strategy' && (
            <div className="strategy-view">
              {/* 1. Business Overview */}
              <div className="strategy-section">
                <h4><Building2 size={16} /> 1. Business Overview</h4>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#334155' }}>
                  {strategy?.overview || lead.analysisSummary}
                </p>
                <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span className="pill">Location: {lead.address}</span>
                  <span className="pill">Google Reviews: {lead.googleReviews} ({lead.googleRating}★)</span>
                  <span className={`pill ${lead.locationVerified ? 'success' : 'amber'}`}>
                    {lead.locationVerified ? 'Locality Verified' : lead.locationStatus || 'Unverified'}
                  </span>
                </div>
              </div>

              {/* 2. Identified Problems */}
              <div className="strategy-section">
                <h4><AlertCircle size={16} /> 2. Identified Problems & Operational Friction</h4>
                {strategy?.problems?.length ? (
                  <div>
                    {strategy.problems.map((p, i) => (
                      <div key={i} className={`problem-card ${p.type}`}>
                        <div className="problem-header">
                          <strong style={{ fontSize: 13, color: '#0f172a' }}>{p.title}</strong>
                          <span className={`problem-badge ${p.type}`}>
                            {p.type === 'confirmed' ? 'Confirmed Fact' : 'Potential Gap'}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                          {p.detail}
                        </p>
                        {p.evidence && (
                          <small style={{ color: '#64748b', fontSize: 11 }}>
                            Evidence: {p.evidence}
                          </small>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul>
                    {(lead.weaknesses || []).map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
              </div>

              {/* 3. Business Impact */}
              <div className="strategy-section">
                <h4><TrendingUp size={16} /> 3. Business Impact</h4>
                <ul className="q-list">
                  {(strategy?.businessImpact || [
                    'Loss of high-intent inquiries to nearby competitors offering instant booking.',
                    'Reduced visibility in local Google 3-pack search results.',
                    'Missed after-hours patient consultation opportunities.',
                  ]).map((impact, i) => (
                    <li key={i}>{impact}</li>
                  ))}
                </ul>
              </div>

              {/* 4. Relevant Services */}
              <div className="strategy-section">
                <h4><Sparkles size={16} /> 4. Relevant Services</h4>
                <div className="tag-list">
                  {(strategy?.relevantServices || lead.recommendedServices || []).map((srv) => (
                    <span key={srv}>{srv}</span>
                  ))}
                </div>
              </div>

              {/* 5. Recommended Solutions */}
              <div className="strategy-section">
                <h4><Lightbulb size={16} /> 5. Recommended Solutions & Implementation</h4>
                {(strategy?.solutions || []).map((sol, i) => (
                  <div key={i} className="solution-card">
                    <strong>{sol.service}</strong>
                    <p>{sol.howItWorks}</p>
                    <div className="solution-meta">
                      <span><strong>Expected Impact:</strong> {sol.impact}</span>
                      <span><strong>Timeline:</strong> {sol.estimatedTimeline}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 6. Conversation Guidance & Discovery Questions */}
              <div className="strategy-section">
                <h4><HelpCircle size={16} /> 6. Client Conversation Guidance</h4>
                <p style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
                  <strong>Recommended Icebreaker:</strong><br />
                  "{strategy?.conversationGuidance?.icebreaker || `Hi ${lead.businessName} team, I noticed your strong rating in ${lead.address} and wanted to ask how you currently handle after-hours patient inquiries.`}"
                </p>
                <strong style={{ fontSize: 12, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                  High-Impact Discovery Questions to Ask:
                </strong>
                <ul className="q-list">
                  {(strategy?.conversationGuidance?.discoveryQuestions || [
                    'How do you currently capture patient inquiries that arrive after 7 PM or over the weekend?',
                    'What percentage of callers actually schedule an appointment versus hanging up without booking?',
                    'Are you happy with your practice visibility compared to competitors in your immediate area?',
                  ]).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>

              {/* 7. Next Steps */}
              <div className="strategy-section">
                <h4><ListChecks size={16} /> 7. Actionable Next Steps</h4>
                <ul className="q-list">
                  {(strategy?.nextSteps || [
                    'Initiate direct WhatsApp message using the pre-crafted outreach template.',
                    'Review technical website signals with practice manager.',
                    'Follow up within 48 hours to offer a free 5-minute intake workflow demonstration.',
                  ]).map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB: Overview */}
          {tab === 'overview' && (
            <div className="detail-grid">
              <Detail title="Analysis summary">
                <p>{lead.analysisSummary}</p>
              </Detail>
              <Detail title="Recommended services">
                <div className="tag-list">
                  {(lead.recommendedServices || []).map((service) => <span key={service}>{service}</span>)}
                </div>
              </Detail>
              <Detail title="Weaknesses & Gaps Found">
                <ul>
                  {(lead.weaknesses || []).length ? (
                    lead.weaknesses.map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li>No material issue recorded.</li>
                  )}
                </ul>
              </Detail>
              <Detail title="Nearby competitors">
                <ul>
                  {(lead.competitors || []).map((item) => (
                    <li key={item.name}>
                      {item.name} · {item.rating || '-'}★ ({item.reviews} reviews) · {item.hasWebsite ? 'has website' : 'no website'}
                    </li>
                  ))}
                </ul>
              </Detail>
            </div>
          )}

          {/* TAB: Email */}
          {tab === 'email' && (
            lead.email ? (
              <div className="editor-grid">
                <div>
                  <label>
                    Email subject
                    <input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} />
                  </label>
                  <label>
                    Plain-text fallback
                    <textarea value={emailText} onChange={(event) => setEmailText(event.target.value)} rows={11} />
                  </label>
                  <label>
                    Sanitized HTML
                    <textarea value={emailHtml} onChange={(event) => setEmailHtml(event.target.value)} rows={8} />
                  </label>
                  <div className="inline-actions">
                    <button
                      className="button primary"
                      disabled={sendingEmail}
                      onClick={() => void onEmail({ to: lead.email, subject: emailSubject, html: emailHtml, text: emailText })}
                    >
                      <Mail size={15} /> {sendingEmail ? 'Sending…' : 'Send through backend'}
                    </button>
                    <button className="button soft" onClick={onGmail}>
                      <ExternalLink size={15} /> Open Gmail draft
                    </button>
                    <button className="button ghost" onClick={() => onCopy(emailText, 'Email text')}>
                      <Copy size={15} /> Copy
                    </button>
                  </div>
                </div>
                <iframe title="Email preview" className="email-preview" sandbox="" srcDoc={emailHtml} />
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <Mail size={32} style={{ color: 'var(--muted)', margin: '0 auto 10px' }} />
                <h4 style={{ margin: '0 0 6px', color: 'var(--ink)' }}>No verified email found for {lead.businessName}</h4>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', maxWidth: 460, marginInline: 'auto' }}>
                  To avoid spam and protect domain deliverability, email drafts are only prepared when a verified address is found on the company website. Use <strong>WhatsApp</strong> or phone calling instead.
                </p>
              </div>
            )
          )}

          {/* TAB: WhatsApp */}
          {tab === 'whatsapp' && (
            <div className="editor-grid whatsapp-editor">
              <div>
                <label>
                  WhatsApp number
                  <input value={waNumber} onChange={(event) => setWaNumber(event.target.value)} />
                </label>
                <label>
                  Message
                  <textarea maxLength={1500} value={waMessage} onChange={(event) => setWaMessage(event.target.value)} rows={11} />
                </label>
                <div className="inline-actions">
                  <button
                    className="button whatsapp"
                    disabled={sendingWa || !waNumber || !waMessage}
                    onClick={() => void onWhatsApp(waNumber, waMessage, Boolean(lead.whatsappStatus && lead.whatsappStatus !== 'Not sent'))}
                  >
                    <MessageCircle size={15} /> {sendingWa ? 'Sending…' : 'Save & send'}
                  </button>
                  <button className="button ghost" onClick={() => onCopy(waMessage, 'WhatsApp message')}>
                    <Copy size={15} /> Copy message
                  </button>
                </div>
              </div>
              <Detail title="Safe sending rules">
                <ul>
                  <li>One lead and one number per request.</li>
                  <li>The backend records a Sending lock before dispatching via Baileys.</li>
                  <li>Local Pakistani numbers automatically convert (e.g. 0300... → 92300...).</li>
                  <li>Timeouts are Unconfirmed, never silently retried.</li>
                  <li>Delivery ACKs move forward only: Sent → Delivered → Read.</li>
                </ul>
              </Detail>
            </div>
          )}

          {/* TAB: Website */}
          {tab === 'website' && (
            <div className="detail-grid">
              <Detail title={`Website health ${lead.websiteScore === null ? '' : `· ${lead.websiteScore}/100`}`}>
                <p className="muted">{lead.websiteStatus}</p>
                <ul>
                  {(lead.websiteIssues || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
                <p className="muted">Tech: {(lead.techStack || []).join(', ') || 'Not detected'}</p>
              </Detail>
              <Detail title="Social profiles">
                <p>{lead.socialStatus}</p>
                <div className="tag-list">
                  {Object.entries(lead.social || {}).filter(([, value]) => value).map(([key]) => (
                    <a key={key} href={lead.social[key]} target="_blank" rel="noreferrer">{key}</a>
                  ))}
                </div>
              </Detail>
              {(lead.websiteImages || []).length > 0 && (
                <Detail title="Website images">
                  <div className="thumb-grid">
                    {lead.websiteImages.map((image) => (
                      <img key={image} src={image} alt="Website preview" loading="lazy" referrerPolicy="no-referrer" />
                    ))}
                  </div>
                </Detail>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="detail-box"><h4>{title}</h4>{children}</div>;
}
