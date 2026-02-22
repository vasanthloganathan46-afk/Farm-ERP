import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, MessageSquare, RefreshCw } from 'lucide-react';

/**
 * SuspensionAppealChat
 * ─────────────────────
 * Shown on the Login screen when a user's account is suspended.
 * Safe to render OUTSIDE the login <form> — has its own self-contained form.
 * No auth token required — calls public endpoints only.
 *
 * Props:
 *   username      — the suspended user's username (required)
 *   token         — optional valid JWT (used for richer thread fetch)
 *   onMessageSent — optional callback fired after a message is saved successfully
 */
export default function SuspensionAppealChat({ username, token, onMessageSent }) {
    const [thread, setThread] = useState([]);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const bottomRef = useRef(null);

    const fetchThread = async () => {
        try {
            let data;
            if (token) {
                const res = await api.get(`/support/tickets/${username}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                data = res.data;
            } else {
                // Public endpoint — no token needed
                const res = await api.get(`/support/tickets/${username}/public`);
                data = res.data;
            }
            console.log('[SuspensionAppealChat] thread fetched:', data);
            setThread(data.messages || []);
            setFetchError(null);
        } catch (err) {
            console.error('[SuspensionAppealChat] fetch error:', err?.response?.data || err.message);
            setFetchError('Could not load messages.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!username) return;
        fetchThread();
        const interval = setInterval(fetchThread, 10000);
        return () => clearInterval(interval);
        // eslint-disable-next-line
    }, [username]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [thread]);

    const handleSend = async (e) => {
        // CRITICAL: prevent this form submit from bubbling to any parent form
        e.preventDefault();
        e.stopPropagation();

        if (!message.trim() || sending) return;
        setSending(true);

        const sentText = message.trim();
        setMessage('');

        // Optimistic UI — show message immediately
        const optimistic = { sender: 'user', text: sentText, timestamp: new Date().toISOString() };
        setThread(prev => [...prev, optimistic]);

        try {
            await api.post('/support/tickets', { username, message_text: sentText });
            console.log('[SuspensionAppealChat] message sent successfully for', username);
            // Notify parent so banner can update without a page refresh
            if (typeof onMessageSent === 'function') onMessageSent();
            // Sync with server to replace optimistic entry
            await fetchThread();
        } catch (err) {
            console.error('[SuspensionAppealChat] SUBMISSION FAILED:', err?.response?.data || err.message);
            // Keep the optimistic message visible but flag error
            setFetchError(`Send failed: ${err?.response?.data?.detail || err.message}`);
        } finally {
            setSending(false);
        }
    };

    const formatTime = (iso) => {
        try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
        catch { return ''; }
    };

    return (
        <div className="mt-4 border border-red-200 rounded-xl overflow-hidden bg-white" data-testid="appeal-chat">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-b border-red-200">
                <div className="flex items-center gap-2 text-red-800 text-sm font-semibold">
                    <MessageSquare className="h-4 w-4" />
                    Appeal Portal — Message Admin
                </div>
                <button
                    type="button"
                    onClick={fetchThread}
                    className="text-red-500 hover:text-red-700 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>

            {/* Message thread */}
            <div className="h-48 overflow-y-auto p-3 space-y-2 bg-gray-50">
                {loading && (
                    <p className="text-center text-xs text-muted-foreground py-8">Loading messages…</p>
                )}
                {fetchError && !loading && (
                    <p className="text-center text-xs text-red-500 py-4">{fetchError}</p>
                )}
                {!loading && !fetchError && thread.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-8">
                        No messages yet. Write to the admin below to appeal your suspension.
                    </p>
                )}
                {thread.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${msg.sender === 'user'
                                ? 'bg-red-600 text-white rounded-br-none'
                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                            }`}>
                            {msg.sender === 'admin' && (
                                <p className="text-xs font-semibold text-green-700 mb-1">🛡 Admin</p>
                            )}
                            <p>{msg.text}</p>
                            <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-red-200' : 'text-gray-400'}`}>
                                {formatTime(msg.timestamp)}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input — self-contained form, safe outside any parent form */}
            <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-red-100 bg-white">
                <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your appeal message…"
                    className="flex-1 text-sm"
                    disabled={sending}
                    data-testid="appeal-message-input"
                />
                <Button
                    type="submit"
                    size="sm"
                    disabled={sending || !message.trim()}
                    className="bg-red-600 hover:bg-red-700"
                    data-testid="appeal-send-btn"
                >
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </div>
    );
}
