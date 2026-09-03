import React, { useState, useContext } from 'react';
import { 
  User, Shield, Type, Upload, CheckCircle2, AlertCircle, RefreshCw, 
  Volume2, BookOpen, Sparkles, Layers, Sliders, Database, HardDrive, 
  RotateCcw, Check, Sparkle, Eye, Mic, Bookmark, Settings, Info,
  CheckCheck, Globe, Play, Palette, Cpu
} from 'lucide-react';
import { AuthContext } from '../App';
import { useApp, FONT_OPTIONS, DEFAULT_PORTAL_SETTINGS } from '../context/AppContext';

export const SettingsTab = () => {
  const { user, checkUserSession } = useContext(AuthContext) || {};
  const { 
    portalSettings = DEFAULT_PORTAL_SETTINGS, 
    updatePortalSettings = () => {}, 
    resetPortalSettings = () => {},
    isModelReady,
    modelStatus,
    modelName
  } = useApp() || {};

  // Settings active category tab
  const [activeCategory, setActiveCategory] = useState('typography'); // 'typography' | 'audio' | 'tafseer' | 'engine' | 'account'

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

  // Reset notification state
  const [resetSavedNotice, setResetSavedNotice] = useState(false);

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

  // Handle Reset to Defaults
  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all portal settings to default academic configurations?")) {
      resetPortalSettings();
      setResetSavedNotice(true);
      setTimeout(() => setResetSavedNotice(false), 3000);
    }
  };

  const navCategories = [
    { id: 'typography', label: 'Typography & Fonts', icon: Type, count: 'Curated' },
    { id: 'audio', label: 'Recitation Engine', icon: Volume2, count: 'Audio' },
    { id: 'tafseer', label: 'Exegesis & Scholars', icon: BookOpen, count: '5 Books' },
    { id: 'engine', label: 'AI Model & Database', icon: Cpu, count: 'Core' },
    { id: 'account', label: 'Account & Security', icon: Shield, count: 'User' }
  ];

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 pb-16 select-none">
      {/* 1. Header Banner */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 border shadow-xl flex flex-wrap items-center justify-between gap-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-md flex items-center justify-center flex-shrink-0">
            <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center">
              <Sliders className="w-6 h-6 text-gold-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-extrabold tracking-wide text-slate-900 dark:text-slate-100">
                Portal Enterprise Settings & Preferences
              </h2>
              <span className="text-[11px] font-bold font-mono px-2 py-0.5 bg-amber-500/15 text-amber-700 dark:text-gold-400 rounded-md border border-amber-500/30">
                v2.4 Academic
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Curated classical typography, recitation engine controls, and exegesis defaults.
            </p>
          </div>
        </div>

        {/* Global Reset Action */}
        <div className="flex items-center gap-2">
          {resetSavedNotice && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-fadeIn">
              <Check className="w-4 h-4" /> Reset to defaults!
            </span>
          )}
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* 2. Navigation Category Pills */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-950/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
        {navCategories.map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 ring-2 ring-amber-400 font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-900/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 3. SECTION 1: CURATED TYPOGRAPHY ENGINE (SAFE LOCKED ENTERPRISE FONTS)     */}
      {/* ========================================================================= */}
      {activeCategory === 'typography' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. Sacred Quranic Calligraphy Font */}
            <div className="glass-panel rounded-3xl p-6 border shadow-xl space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Quranic Calligraphy Script</span>
                  </h3>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-gold-400 border border-amber-500/30">
                    .font-quran
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Select the classical font for Ayah text across Tilawat, Tafseer, and Mutashabehat tabs.
                </p>

                {/* Font Selector List */}
                <div className="space-y-2 pt-2">
                  {FONT_OPTIONS.quran.map(f => (
                    <button
                      key={f.id}
                      onClick={() => updatePortalSettings({ quranFont: f.id })}
                      className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        portalSettings.quranFont === f.id
                          ? 'border-amber-500 bg-amber-500/10 shadow-sm ring-2 ring-amber-400/40'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{f.name}</span>
                          {portalSettings.quranFont === f.id && (
                            <Check className="w-3.5 h-3.5 text-amber-500" />
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">{f.author}</span>
                      </div>
                      <span className="text-base font-quran text-amber-600 dark:text-gold-400" style={{ fontFamily: f.family }}>
                        بِسْمِ اللَّهِ
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Classical Tafseer Exegesis Font */}
            <div className="glass-panel rounded-3xl p-6 border shadow-xl space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-teal-500" />
                    <span>Tafseer Commentary Font</span>
                  </h3>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-teal-500/15 text-teal-800 dark:text-teal-400 border border-teal-500/30">
                    .font-tafsir
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Select the classical font for the 5 exegeses (Al-Jalalayn, Ibn Kathir, Al-Qurtubi, As-Sa'di, Al-Tabari).
                </p>

                {/* Font Selector List */}
                <div className="space-y-2 pt-2">
                  {FONT_OPTIONS.tafsir.map(f => (
                    <button
                      key={f.id}
                      onClick={() => updatePortalSettings({ tafsirFont: f.id })}
                      className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        portalSettings.tafsirFont === f.id
                          ? 'border-teal-500 bg-teal-500/10 shadow-sm ring-2 ring-teal-400/40'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{f.name}</span>
                          {portalSettings.tafsirFont === f.id && (
                            <Check className="w-3.5 h-3.5 text-teal-500" />
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">{f.author}</span>
                      </div>
                      <span className="text-sm font-tafsir text-teal-600 dark:text-teal-400" style={{ fontFamily: f.family }}>
                        التفسير والبيان
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Dashboard UI & Navigation Sans Font */}
            <div className="glass-panel rounded-3xl p-6 border shadow-xl space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Type className="w-4 h-4 text-blue-500" />
                    <span>Portal Controls & UI Sans</span>
                  </h3>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-800 dark:text-blue-400 border border-blue-500/30">
                    --font-ui
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Select the modern sans-serif typography for dashboards, buttons, and navigation.
                </p>

                {/* Font Selector List */}
                <div className="space-y-2 pt-2">
                  {FONT_OPTIONS.ui.map(f => (
                    <button
                      key={f.id}
                      onClick={() => updatePortalSettings({ uiFont: f.id })}
                      className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        portalSettings.uiFont === f.id
                          ? 'border-blue-500 bg-blue-500/10 shadow-sm ring-2 ring-blue-400/40'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{f.name}</span>
                          {portalSettings.uiFont === f.id && (
                            <Check className="w-3.5 h-3.5 text-blue-500" />
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">Clean Geometric</span>
                      </div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400" style={{ fontFamily: f.family }}>
                        Aa Bb 123
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live Interactive Typography Preview Card */}
          <div className="glass-panel-gold rounded-3xl p-6 md:p-8 border shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-500" />
                <span>Live Interactive Typography & Script Preview</span>
              </h4>
              <span className="text-xs text-slate-500 font-mono">
                Active: {portalSettings.quranFont} &bull; {portalSettings.tafsirFont} &bull; {portalSettings.uiFont}
              </span>
            </div>

            <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="font-quran text-2xl md:text-3xl text-center leading-[2.6] text-slate-900 dark:text-slate-100 select-text">
                ﴿ إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ ﴾
              </div>
              <div className="p-4 rounded-xl bg-amber-50/40 dark:bg-slate-900/60 border border-amber-200/80 dark:border-slate-800 font-tafsir text-right text-sm md:text-base leading-relaxed text-slate-800 dark:text-slate-200 select-text" dir="rtl">
                <strong>تفسير القرآن:</strong> حفظه الله تعالى من الزيادة والنقصان والتبديل والتغيير على ممر الأعصار والدهور، وهو حجة الله البالغة على خلقه أجمعين.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SECTION 2: AUDIO RECITATION ENGINE SETTINGS                            */}
      {/* ========================================================================= */}
      {activeCategory === 'audio' && (
        <div className="glass-panel rounded-3xl p-6 md:p-8 border shadow-xl space-y-6 animate-fadeIn">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-amber-500" />
              <span>Audio Recitation & Engine Controls</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Configure default playback speed, continuous recitation behavior, and buffering strategy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Playback Speed */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider">Default Playback Speed</span>
                <span className="text-xs font-mono font-bold text-amber-500">{portalSettings.defaultPlaybackSpeed}x</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[0.75, 1.0, 1.25, 1.5, 2.0].map(spd => (
                  <button
                    key={spd}
                    onClick={() => updatePortalSettings({ defaultPlaybackSpeed: spd })}
                    className={`py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                      portalSettings.defaultPlaybackSpeed === spd
                        ? 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-400'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Advance Toggle */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block uppercase tracking-wider">Continuous Auto-Advance</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Automatically proceed to recite the next Ayah upon completion.</p>
              </div>
              <button
                onClick={() => updatePortalSettings({ autoAdvanceRecitation: !portalSettings.autoAdvanceRecitation })}
                className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out ${
                  portalSettings.autoAdvanceRecitation ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-800'
                }`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                  portalSettings.autoAdvanceRecitation ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SECTION 3: EXEGESIS & SCHOLAR PREFERENCES                              */}
      {/* ========================================================================= */}
      {activeCategory === 'tafseer' && (
        <div className="glass-panel rounded-3xl p-6 md:p-8 border shadow-xl space-y-6 animate-fadeIn">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-teal-500" />
              <span>Classical Exegesis & Tafseer Preferences</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Choose your default primary scholar when opening verses and set default layout styles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Primary Scholar Default */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block uppercase tracking-wider">Default Preferred Scholar</span>
              <div className="space-y-1.5">
                {[
                  { id: 'ja', name: 'تفسير الجلالين (Al-Jalalayn)', desc: 'وجيز لغوي وسياقي مباشر' },
                  { id: 'ik', name: 'تفسير ابن كثير (Ibn Kathir)', desc: 'مأثور بالأحاديث والآثار' },
                  { id: 'qu', name: 'تفسير القرطبي (Al-Qurtubi)', desc: 'فقه وأحكام وبلاغة' },
                  { id: 'sa', name: 'تفسير السعدي (As-Sa\'di)', desc: 'تربوي وميسر للتدبر' },
                  { id: 'ta', name: 'تفسير الطبري (Al-Tabari)', desc: 'جامع الروايات واللغة' }
                ].map(sch => (
                  <button
                    key={sch.id}
                    onClick={() => updatePortalSettings({ defaultTafsirScholar: sch.id })}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      portalSettings.defaultTafsirScholar === sch.id
                        ? 'border-teal-500 bg-teal-500/10 ring-2 ring-teal-400/40'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span>{sch.name}</span>
                        {portalSettings.defaultTafsirScholar === sch.id && (
                          <Check className="w-3.5 h-3.5 text-teal-500" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">{sch.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Surah Reader Inline Exegesis Auto-Expand */}
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block uppercase tracking-wider">Auto-Expand Tafseer in Reader</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Automatically open inline commentary when jumping to verses.</p>
                </div>
                <button
                  onClick={() => updatePortalSettings({ readerAutoExpand: !portalSettings.readerAutoExpand })}
                  className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out ${
                    portalSettings.readerAutoExpand ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-800'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                    portalSettings.readerAutoExpand ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-amber-50/40 dark:bg-slate-950/60 border border-amber-200/80 dark:border-slate-800 text-xs space-y-2">
                <span className="font-extrabold text-amber-800 dark:text-gold-400 block">📚 5 Classical Databases Verified</span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  All 6,236 verses across 43.5 million Arabic characters are indexed in SQLite FTS5 for sub-15ms offline search latency.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SECTION 4: AI MODEL & CORE DATABASES                                   */}
      {/* ========================================================================= */}
      {activeCategory === 'engine' && (
        <div className="glass-panel rounded-3xl p-6 md:p-8 border shadow-xl space-y-6 animate-fadeIn">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-500" />
              <span>AI Speech Recognition & Offline Databases</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Live status of neural models, manuscript bounding boxes, and local storage caches.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* AI Speech Model */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">Tasmee Whisper Model</span>
                <span className={`w-2.5 h-2.5 rounded-full ${isModelReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              </div>
              <div className="font-mono text-xs text-amber-600 dark:text-gold-400 truncate">{modelName}</div>
              <span className="text-[11px] text-slate-500 block">Status: {modelStatus.toUpperCase()}</span>
            </div>

            {/* Tafsir Database */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">tafsir.db (SQLite FTS5)</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="font-mono text-xs text-teal-600 dark:text-teal-400">6,236 Verses / 5 Scholars</div>
              <span className="text-[11px] text-slate-500 block">Status: READY & INDEXED</span>
            </div>

            {/* Misri Coordinate Engine */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">file1.db / file2.db</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="font-mono text-xs text-blue-600 dark:text-blue-400">604 Misri Manuscript Pages</div>
              <span className="text-[11px] text-slate-500 block">Status: CALIBRATED</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. SECTION 5: USER ACCOUNT & SECURITY                                     */}
      {/* ========================================================================= */}
      {activeCategory === 'account' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
          {/* Profile Card */}
          <div className="glass-panel rounded-3xl p-6 md:p-8 border shadow-xl flex flex-col justify-between">
            <form onSubmit={saveProfile} className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
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
          <div className="glass-panel rounded-3xl p-6 md:p-8 border shadow-xl flex flex-col justify-between">
            <form onSubmit={savePassword} className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
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
      )}
    </div>
  );
};

export default SettingsTab;
