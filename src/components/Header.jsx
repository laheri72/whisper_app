import React from 'react';
import { BookOpen, Mic, Award, Activity, Sparkles, Clock, Globe, Sun, Moon, LogOut, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Header = ({ activeTab, user, theme, toggleTheme, handleLogout }) => {
  const { isModelReady, modelStatus, modelError } = useApp();

  const getTabTitle = () => {
    switch (activeTab) {
      case 'tilawat':
        return { title: 'Tilawat', subtitle: 'Digital Mushaf & Audio Recitation', icon: BookOpen };
      case 'tasmee':
        return { title: 'Tasmee', subtitle: 'Oral Recitation Assessment', icon: Mic };
      case 'ikhtebaar':
        return { title: 'Ikhtebaar', subtitle: 'Oral Examination & Testing', icon: Award };
      case 'analytics':
        return { title: 'Performance Analytics', subtitle: 'Student Records & Juz Retention Heatmap', icon: Activity };
      default:
        return { title: 'Quranic Portal', subtitle: 'Department of Quranic Studies', icon: Sparkles };
    }
  };

  const currentInfo = getTabTitle();
  const Icon = currentInfo.icon;

  return (
    <header className="sticky top-0 z-20 w-full bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between transition-colors duration-200">
      {/* Dynamic Tab Info */}
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-gold-500/30 flex items-center justify-center shadow-md">
          <Icon className="w-6 h-6 text-gold-500 dark:text-gold-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {currentInfo.title}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right Header Status Bar */}
      <div className="flex items-center gap-4">
        {/* Live Speech Model Status Pill */}
        <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm transition-all ${
          isModelReady
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            : modelStatus === 'error'
            ? 'bg-red-500/10 text-red-500 border-red-500/30'
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse'
        }`}>
          {isModelReady ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Speech Engine Ready</span>
            </>
          ) : modelStatus === 'error' ? (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              <span title={modelError || 'Model offline'}>Engine Offline</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
              <span>Initializing Engine...</span>
            </>
          )}
        </div>

        {/* Standard Info */}
        <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Globe className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Madani Mushaf Standard</span>
          </div>
          <div className="w-px h-4 bg-slate-300 dark:bg-slate-800" />
          <div className="flex items-center gap-1.5 text-gold-600 dark:text-gold-400 font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>Live Evaluation</span>
          </div>
        </div>

        {/* User Badge Pill */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-gold-500/30 shadow-sm">
          <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center">
            {user.initials}
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-none">
              {user.name}
            </span>
            <span className="text-[10px] font-mono text-gold-600 dark:text-gold-400 mt-0.5">
              ID: {user.id}
            </span>
          </div>
        </div>

        {/* Theme Toggle Button (Sun/Moon) */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-gold-400 hover:bg-slate-200/60 hover:text-slate-800 dark:hover:text-gold-300 transition-colors shadow-sm"
          title={theme === 'dark' ? "Switch to Light Academic Theme" : "Switch to Dark Academic Theme"}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 hover:text-red-600 transition-colors shadow-sm"
          title="Sign out of Session"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
