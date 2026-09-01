import React, { useState } from 'react';
import { Sparkles, User, RefreshCw } from 'lucide-react';

export const OnboardingModal = ({ onSubmitDisplayName }) => {
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Display Name cannot be empty.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/update_profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName.trim() })
      });

      if (res.ok) {
        const data = await res.json();
        onSubmitDisplayName(data.display_name);
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to save profile. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError('Server connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-2xl glass-panel-gold border border-gold-500/30 p-6 md:p-8 shadow-deep-card animate-fadeIn">
        
        {/* Header/Welcome Crest */}
        <div className="flex flex-col items-center text-center space-y-3 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 p-0.5 flex items-center justify-center shadow-gold-glow">
            <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-gold-400" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">Profile Setup</h2>
            <p className="text-xs text-slate-400 mt-1">
              Please enter your full name to configure your student profile.
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Full Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <User className="w-4 h-4 text-gold-400/80" />
              </span>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Abdullah Al-Mansoor"
                className="w-full bg-slate-900/90 text-slate-100 text-sm rounded-xl pl-10 pr-4 py-3 border border-slate-700/80 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all font-medium"
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Your name will appear on official assessment records.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/30 text-red-300 text-xs font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-gold-glow transition-all disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <span>Continue</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
