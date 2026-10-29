import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  LogOut,
  MessageCircle,
  Phone,
  Power,
  QrCode,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api/client';
import type { BaileysConnectionState, BaileysStatusInfo } from '../types';

interface WhatsAppPageProps {
  onNavigateToClientHandler?: () => void;
}

export const WhatsAppPage: React.FC<WhatsAppPageProps> = ({ onNavigateToClientHandler }) => {
  const [statusInfo, setStatusInfo] = useState<BaileysStatusInfo>({
    state: 'not_connected',
    qr: null,
    account: null,
    error: null,
    reconnectAttempts: 0,
    lastConnectedAt: null,
    isReady: false,
  });

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Quick test message state
  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Hello! This is a test message from Client Hunter via direct Baileys integration.');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Subscribe to real-time status and QR updates
  useEffect(() => {
    // Initial fetch
    void (async () => {
      try {
        const res = await api.getWhatsAppStatus();
        if (res?.status) {
          setStatusInfo(res.status);
        }
      } catch (err) {
        console.warn('Initial WhatsApp status check failed:', err);
      }
    })();

    // Live subscription
    const unsubscribe = api.subscribeWhatsAppEvents((updated) => {
      setStatusInfo(updated);
      if (updated.state === 'connected') {
        setErrorMessage(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleConnect = async () => {
    setLoadingAction('connect');
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await api.connectWhatsApp();
      if (res?.status) setStatusInfo(res.status);
      setSuccessMessage('WhatsApp connection initialized. Waiting for QR scan...');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not initialize WhatsApp connection.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDisconnect = async () => {
    setLoadingAction('disconnect');
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await api.disconnectWhatsApp();
      if (res?.status) setStatusInfo(res.status);
      setSuccessMessage('WhatsApp disconnected. Your session credentials remain saved on the server.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not disconnect WhatsApp.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to log out? This will unlink your device and delete saved session credentials. You will need to scan a new QR code to reconnect.')) {
      return;
    }
    setLoadingAction('logout');
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await api.logoutWhatsApp();
      if (res?.status) setStatusInfo(res.status);
      setSuccessMessage('Logged out from WhatsApp. Saved session data cleared.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not log out from WhatsApp.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRestart = async () => {
    setLoadingAction('restart');
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await api.restartWhatsApp();
      if (res?.status) setStatusInfo(res.status);
      setSuccessMessage('Reconnection requested.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not reconnect WhatsApp.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testNumber.trim() || !testMessage.trim()) return;
    setSendingTest(true);
    setTestResult(null);
    setErrorMessage(null);
    try {
      const res = await api.sendWhatsApp('test_manual', {
        businessName: 'Direct Test',
        number: testNumber.trim(),
        message: testMessage.trim(),
        resend: true,
      });
      setTestResult(`Message successfully dispatched! Status: ${res.record?.status || 'Sent'} (ID: ${res.record?.providerMessageId || 'N/A'})`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send test message.');
    } finally {
      setSendingTest(false);
    }
  };

  const renderStatusBadge = (state: BaileysConnectionState) => {
    switch (state) {
      case 'connected':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: '13px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            Connected
          </span>
        );
      case 'waiting_for_qr':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fef3c7', color: '#b45309', padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: '13px' }}>
            <Radio size={14} className="spin" />
            Waiting for QR scan
          </span>
        );
      case 'initializing':
      case 'connecting':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: '13px' }}>
            <Loader2 size={14} className="spin" />
            Connecting…
          </span>
        );
      case 'reconnecting':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ffedd5', color: '#c2410c', padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: '13px' }}>
            <RefreshCw size={14} className="spin" />
            Reconnecting ({statusInfo.reconnectAttempts})…
          </span>
        );
      case 'logged_out':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fee2e2', color: '#b91c1c', padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: '13px' }}>
            <LogOut size={14} />
            Logged Out
          </span>
        );
      case 'connection_error':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fee2e2', color: '#b91c1c', padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: '13px' }}>
            <AlertCircle size={14} />
            Connection Error
          </span>
        );
      case 'disconnected':
      case 'not_connected':
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f1f5f9', color: '#475569', padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: '13px' }}>
            <WifiOff size={14} />
            Not Connected
          </span>
        );
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px', fontFamily: 'inherit' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ background: '#25D366', color: '#fff', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle size={22} />
            </div>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              WhatsApp Connection
            </h1>
            {renderStatusBadge(statusInfo.state)}
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px', maxWidth: 650 }}>
            Direct Baileys integration without WAHA, paid gateways, or third-party webhooks. Connect your WhatsApp account by scanning the QR code below.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {statusInfo.state === 'connected' ? (
            <>
              <button
                type="button"
                className="button ghost"
                disabled={Boolean(loadingAction)}
                onClick={() => void handleDisconnect()}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Power size={15} />
                Disconnect
              </button>
              <button
                type="button"
                className="button ghost"
                disabled={Boolean(loadingAction)}
                onClick={() => void handleLogout()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}
              >
                <LogOut size={15} />
                Log Out
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="button primary"
                disabled={Boolean(loadingAction) || statusInfo.state === 'waiting_for_qr'}
                onClick={() => void handleConnect()}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#10b981', borderColor: '#059669' }}
              >
                {loadingAction === 'connect' ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Initializing…
                  </>
                ) : (
                  <>
                    <QrCode size={16} />
                    Connect WhatsApp
                  </>
                )}
              </button>
              {statusInfo.state !== 'not_connected' && (
                <button
                  type="button"
                  className="button ghost"
                  disabled={Boolean(loadingAction)}
                  onClick={() => void handleRestart()}
                  title="Force restart session connection"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw size={15} className={loadingAction === 'restart' ? 'spin' : ''} />
                  Reconnect
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: '14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: '14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {statusInfo.error && statusInfo.state !== 'connected' && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: '14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Info size={18} />
          <span>{statusInfo.error}</span>
        </div>
      )}

      {/* Main Connection Area */}
      <div style={{ display: 'grid', gridTemplateColumns: statusInfo.state === 'connected' ? '1fr 1fr' : '1fr 1.1fr', gap: 24, marginBottom: 28 }}>
        {/* Left Column: QR Code or Connected Account Card */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {statusInfo.state === 'connected' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Smartphone size={28} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800 }}>
                    {statusInfo.account?.name || 'WhatsApp Device'}
                  </h3>
                  <div style={{ color: '#16a34a', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Phone size={14} />
                    {statusInfo.account?.phone || 'Connected Account'}
                  </div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '16px 20px', border: '1px solid #e2e8f0', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #edf2f7', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Status</span>
                  <strong style={{ color: '#16a34a' }}>Active & Ready</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #edf2f7', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Account JID</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#334155' }}>
                    {statusInfo.account?.id || 'Active'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Session Storage</span>
                  <strong style={{ color: '#0f172a' }}>Persistent SQLite</strong>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 20px' }}>
                Your phone is connected directly. Incoming messages from leads are automatically matched, logged, and processed by your Client Handler.
              </p>

              {onNavigateToClientHandler && (
                <button
                  type="button"
                  className="button primary full"
                  onClick={onNavigateToClientHandler}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <MessageCircle size={16} />
                  Open Client Handler Conversations
                </button>
              )}
            </div>
          ) : statusInfo.state === 'waiting_for_qr' && statusInfo.qr ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '4px 10px', borderRadius: 999 }}>
                  Scan with WhatsApp on your phone
                </span>
              </div>

              <div
                style={{
                  display: 'inline-block',
                  padding: 16,
                  background: '#fff',
                  border: '2px solid #0284c7',
                  borderRadius: 16,
                  boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.15)',
                  marginBottom: 16,
                }}
              >
                <QRCodeSVG
                  value={statusInfo.qr}
                  size={240}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                This QR code auto-refreshes automatically. Point your phone camera directly at the code.
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                {statusInfo.state === 'initializing' || statusInfo.state === 'connecting' ? (
                  <Loader2 size={32} className="spin" color="#0284c7" />
                ) : (
                  <QrCode size={32} />
                )}
              </div>

              <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800 }}>
                {statusInfo.state === 'initializing'
                  ? 'Initializing Session…'
                  : statusInfo.state === 'connecting'
                  ? 'Connecting to WhatsApp…'
                  : statusInfo.state === 'reconnecting'
                  ? 'Reconnecting Session…'
                  : 'WhatsApp Disconnected'}
              </h3>

              <p style={{ fontSize: '13px', color: '#64748b', maxWidth: 360, margin: '0 auto 24px', lineHeight: 1.5 }}>
                {statusInfo.state === 'logged_out'
                  ? 'Your WhatsApp session expired or was logged out from the phone. Click below to generate a new QR code.'
                  : 'Click the button below to initialize Baileys and generate a real-time pairing QR code.'}
              </p>

              <button
                type="button"
                className="button primary"
                disabled={Boolean(loadingAction)}
                onClick={() => void handleConnect()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', fontSize: '14px' }}
              >
                {loadingAction === 'connect' ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Generating QR…
                  </>
                ) : (
                  <>
                    <QrCode size={16} />
                    Connect WhatsApp
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Instructions & Setup Guidance */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={18} color="#25D366" />
            How to Connect Your Phone
          </h3>

          <ol style={{ paddingLeft: 20, margin: '0 0 24px', fontSize: '13px', color: '#334155', lineHeight: 1.8 }}>
            <li>Open <strong>WhatsApp</strong> on your mobile phone.</li>
            <li>
              Tap <strong>Menu</strong> (⋮) on Android or <strong>Settings</strong> (⚙) on iPhone.
            </li>
            <li>
              Tap <strong>Linked Devices</strong>, then tap <strong>Link a Device</strong>.
            </li>
            <li>
              If prompted, unlock your phone using your biometric / passcode.
            </li>
            <li>
              Point your phone's camera at the QR code displayed on this screen.
            </li>
          </ol>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} color="#10b981" />
              Persistent & Free Architecture
            </h4>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
              <li><strong>Zero Recurring Gateway Fees:</strong> Uses open-source Baileys directly.</li>
              <li><strong>Persistent Sessions:</strong> Reconnection happens automatically when restarting your backend without re-scanning.</li>
              <li><strong>Idempotent Messaging:</strong> Deduplication guards prevent accidental double outreach or duplicate AI replies.</li>
              <li><strong>Complete Privacy:</strong> Cryptographic keys remain private on your server; nothing is sent to third-party gateways.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Test Message Card (Active when connected) */}
      {statusInfo.state === 'connected' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={16} color="#25D366" />
            Send a Verification Message
          </h3>
          <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px' }}>
            Verify that your WhatsApp connection can send real messages directly from your linked device.
          </p>

          <form onSubmit={(e) => void handleSendTestMessage(e)} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Phone Number (with Country Code)
              </label>
              <input
                type="text"
                placeholder="e.g. 14155552671 or 923001234567"
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Message Text
              </label>
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px' }}
                required
              />
            </div>

            <button
              type="submit"
              className="button primary"
              disabled={sendingTest || !testNumber.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
            >
              {sendingTest ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
              Send Test
            </button>
          </form>

          {testResult && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 6, fontSize: '13px' }}>
              {testResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
