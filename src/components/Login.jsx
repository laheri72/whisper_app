import React, { useState } from 'react';
import { ShieldCheck, Lock, User, RefreshCw, GraduationCap, ArrowRightLeft } from 'lucide-react';

export const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Explicitly coerce state variables to strings and sanitize
    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '').trim();

    // Client-side validations
    if (cleanUsername.length === 0 || cleanPassword.length === 0) {
      setError('Please fill in all identification fields.');
      return;
    }

    if (cleanUsername.length !== 5 || !/^\d+$/.test(cleanUsername)) {
      setError('Identification Number must be exactly 5 numeric digits.');
      return;
    }

    if (cleanPassword.length < 5) {
      setError('Passcode must be at least 5 characters long.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    // Construct FormData body as required by FastAPI Form parameters
    const formData = new FormData();
    formData.append('username', cleanUsername);
    formData.append('password', cleanPassword);

    const targetEndpoint = isRegistering ? '/register' : '/login';

    try {
      const res = await fetch(targetEndpoint, {
        method: 'POST',
        body: formData
      });

      // Parse JSON response strictly
      const data = await res.json();

      if (res.ok) {
        if (data.error) {
          setError(data.error);
        } else if (isRegistering) {
          setIsRegistering(false);
          setSuccessMessage('Registration successful! Please sign in using your passcode.');
          setPassword('');
        } else if (data.success) {
          onLoginSuccess(cleanUsername);
        }
      } else {
        setError(data.error || 'Authentication server request failed.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to reach backend server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background blur accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />

      <div className="w-full max-w-md overflow-hidden rounded-2xl glass-panel-gold border border-gold-500/35 p-6 md:p-8 shadow-deep-card relative z-10 animate-fadeIn">
        {/* Branding header */}
        <div className="flex flex-col items-center text-center space-y-3.5 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-600 to-amber-800 p-0.5 flex items-center justify-center shadow-gold-glow">
            <div className="w-full h-full rounded-[12px] bg-slate-950 flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-gold-400" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-wide gold-gradient-text">
              {isRegistering ? 'Register Student Profile' : 'Academic Quran Portal'}
            </h1>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
              {isRegistering ? 'Create new credentials' : 'University Recitation & Testing Suite'}
            </span>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ID Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Student ID Number (5 digits)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <User className="w-4 h-4 text-gold-400/80" />
              </span>
              <input
                type="text"
                required
                maxLength={5}
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 5-digit ID (e.g. 27234)"
                className="w-full bg-slate-900/90 text-slate-100 text-sm rounded-xl pl-10 pr-4 py-3 border border-slate-700/80 focus:outline-none focus:border-amber-500 transition-all font-mono tracking-widest font-semibold"
              />
            </div>
          </div>

          {/* Passcode Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Passcode
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Lock className="w-4 h-4 text-gold-400/80" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegistering ? "Create password (min 5 characters)" : "Enter security passcode"}
                className="w-full bg-slate-900/90 text-slate-100 text-sm rounded-xl pl-10 pr-4 py-3 border border-slate-700/80 focus:outline-none focus:border-amber-500 transition-all font-medium"
              />
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/30 text-red-300 text-xs font-medium">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
              {successMessage}
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-gold-glow transition-all"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin animate-infinite" />
            ) : (
              <span>{isRegistering ? 'Register Profile' : 'Gain Portal Access'}</span>
            )}
          </button>
        </form>

        {/* Toggle Form Link */}
        <div className="mt-5 text-center">
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setSuccessMessage('');
            }}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium inline-flex items-center gap-1.5 hover:underline"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>
              {isRegistering
                ? 'Already have an account? Sign in here'
                : "Don't have an account? Register here"}
            </span>
          </button>
        </div>

        {/* Disclaimer Footer */}
        <div className="mt-8 text-center text-[10px] text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Authorized Academic Personnel Only
          </p>
        </div>
      </div>
    </div>
  );
};
