'use client';

import { useState, useRef, useEffect } from 'react';

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;

    const data = new FormData(form);
    const body = {
      type: data.get('type') as string,
      message: data.get('message') as string,
      email: data.get('email') as string || undefined,
    };

    if (!body.message?.trim()) return;

    setSending(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSubmitted(true);
      setTimeout(() => { setOpen(false); setSubmitted(false); }, 2000);
    } catch {
      // silently fail
    } finally {
      setSending(false);
    }
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => { setOpen(!open); setSubmitted(false); }}
        className="bg-black/60 backdrop-blur-xl rounded-full p-2 border border-white/10 hover:bg-white/10 transition-colors"
        title="Send feedback"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 p-4 animate-fade-in z-50">
          {submitted ? (
            <div className="text-center py-4">
              <div className="text-green-400 text-sm font-medium">Thanks for your feedback!</div>
              <p className="text-gray-600 text-xs mt-1">We'll review your suggestion.</p>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit}>
              <h3 className="text-white text-sm font-medium mb-3">Suggest an improvement</h3>

              <div className="flex gap-1.5 mb-3">
                {['Feature', 'Bug', 'Data', 'Other'].map((t) => (
                  <label key={t} className="flex-1">
                    <input type="radio" name="type" value={t.toLowerCase()} className="sr-only peer" defaultChecked={t === 'Feature'} />
                    <span className="block text-center text-[11px] py-1 rounded-md border border-white/10 text-gray-500 peer-checked:border-white/30 peer-checked:text-white peer-checked:bg-white/5 cursor-pointer transition-colors">
                      {t}
                    </span>
                  </label>
                ))}
              </div>

              <textarea
                name="message"
                placeholder="What would you like to see?"
                rows={3}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-white/20 transition-colors"
              />

              <input
                name="email"
                type="email"
                placeholder="Email (optional)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 mt-2 focus:outline-none focus:border-white/20 transition-colors"
              />

              <button
                type="submit"
                disabled={sending}
                className="w-full mt-3 py-1.5 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Submit'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
