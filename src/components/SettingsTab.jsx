import React, { useState, useContext } from 'react';
import { User, Shield, Type, Upload, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { AuthContext } from '../App';

export const SettingsTab = () => {
  const { user, checkUserSession } = useContext(AuthContext);

  // Profile update state
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [photoBase64, setPhotoBase64] = useState(user?.profilePhoto || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password update state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Handle Photo File Upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setProfileError("File size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoBase64(event.target.result);
        setProfileSuccess("Image loaded. Click 'Save Profile Details' to submit.");
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Profile Changes
  const saveProfile = async (e) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileSuccess('');
    setProfileError('');

    try {
      const res = await fetch('/api/user/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          profile_photo: photoBase64
        })
      });

      if (res.ok) {
        setProfileSuccess("Profile updated successfully!");
        if (checkUserSession) {
          await checkUserSession();
        }
      } else {
        const errData = await res.json();
        setProfileError(errData.detail || "Failed to update profile details");
      }
    } catch (err) {
      setProfileError("Profile connection error: " + err.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Submit Password Changes
  const savePassword = async (e) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      if (res.ok) {
        setPasswordSuccess("Password updated successfully!");
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const errData = await res.json();
        setPasswordError(errData.detail || "Failed to update password");
      }
    } catch (err) {
      setPasswordError("Password connection error: " + err.message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Handle Font File Upload & Activation
  const handleFontUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const fontName = 'CustomUserFont';
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          // Dynamic FontFace API registration
          const fontFace = new FontFace(fontName, event.target.result);
          const loadedFace = await fontFace.load();
          document.fonts.add(loadedFace);
          
          // Apply custom font globally, excluding Quran script elements
          const styleEl = document.getElementById('custom-user-font-styles') || document.createElement('style');
          styleEl.id = 'custom-user-font-styles';
          styleEl.innerHTML = `
            body, html, div, p, span, input, button, select, textarea, label {
              font-family: '${fontName}', sans-serif;
            }
            .quran-text, .quran-text *, .font-arabic, .font-arabic *, .misri-manuscript, .misri-manuscript *, .font-mono, .font-mono * {
              font-family: 'Amiri', 'Aref Ruqaa', serif !important;
            }
          `;
          document.head.appendChild(styleEl);
          setProfileSuccess("Custom portal font applied successfully!");
        } catch (err) {
          console.error("Font loading error:", err);
          setProfileError("Failed to apply font: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex items-center gap-4 shadow-sm">
        <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-mono tracking-wide">Academic Profile & Settings</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage user identity, account password, and portal typography preferences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <form onSubmit={saveProfile} className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-850 flex items-center gap-2">
              <User className="w-4 h-4 text-amber-500" />
              <span>Identity Profile Details</span>
            </h3>

            {profileSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {/* Profile Photo Upload */}
            <div className="flex items-center gap-4 py-2">
              <div className="relative">
                {photoBase64 ? (
                  <img 
                    src={photoBase64} 
                    alt="Profile Preview" 
                    className="w-20 h-20 rounded-full object-cover border-2 border-amber-500/50 shadow-md"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-150 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 font-extrabold text-2xl">
                    {user?.initials || '??'}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Profile Avatar</span>
                <label className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-800 text-xs font-bold bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 cursor-pointer flex items-center gap-1.5 transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Photo</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Display Name Input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Display Name</label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                placeholder="Enter display name"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={isUpdatingProfile}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow transition-all border border-amber-600/20 disabled:opacity-50"
            >
              {isUpdatingProfile ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Save Profile Details</span>
            </button>
          </form>
        </div>

        {/* Password Card */}
        <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <form onSubmit={savePassword} className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-850 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              <span>Security & Password Settings</span>
            </h3>

            {passwordSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {/* Current Password Input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Current Password</label>
              <input 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                placeholder="••••••••"
                required
              />
            </div>

            {/* New Password Input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">New Password</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                placeholder="••••••••"
                required
              />
            </div>

            {/* Confirm Password Input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Confirm New Password</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                placeholder="••••••••"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={isUpdatingPassword}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow transition-all border border-amber-600/20 disabled:opacity-50"
            >
              {isUpdatingPassword ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Update Password</span>
            </button>
          </form>
        </div>
      </div>

      {/* Typography Configuration Panel */}
      <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-850 flex items-center gap-2">
          <Type className="w-4 h-4 text-amber-500" />
          <span>Portal Typography Customization</span>
        </h3>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
          <div className="space-y-1 max-w-lg">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block uppercase tracking-wider">Dynamic Custom Font (.ttf, .woff, .woff2)</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Upload a font file to dynamically re-style the portal controls, dashboard navigation, and analytics sheets. 
              <br />
              <strong className="text-amber-500">Exclusion Rule:</strong> The Quranic text rendering components (<code className="text-red-400">.font-arabic</code>) and Misri manuscript glyph spaces bypass this style setting to preserve sacred typography.
            </p>
          </div>

          <label className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-800 text-xs font-bold bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850 cursor-pointer flex items-center justify-center gap-2 transition-all">
            <Upload className="w-4 h-4 text-amber-500" />
            <span>Upload Font File</span>
            <input type="file" accept=".ttf,.woff,.woff2" onChange={handleFontUpload} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
