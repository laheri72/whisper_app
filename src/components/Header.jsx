import React from 'react';
import { BookOpen, Mic, Award, Activity, Sparkles, Clock, Globe, Sun, Moon, LogOut } from 'lucide-react';

export const Header = ({ activeTab, user, theme, toggleTheme, handleLogout }) => {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'tilawat':
        return { title: 'Tilawat Reading Module', subtitle: 'Interactive Manuscript Explorer & Recitation Audio', icon: BookOpen };
      case 'tasmee':
        return { title: 'Tasmee Recitation Engine', subtitle: 'Batch-Processed Audio Memorization & AI Evaluation', icon: Mic };
      case 'ikhtebaar':
        return { title: 'Ikhtebaar Testing Suite', subtitle: 'Academic Oral Examination with Progressive Hints', icon: Award };
      case 'analytics':
        return { title: 'Talabat Analytics & Progress', subtitle: '30-Juz Heatmap, Mutashabihat Queue & Audit Logs', icon: Activity };
      default:
        return { title: 'Academic Quran Portal', subtitle: 'Enterprise Dashboard', icon: Sparkles };
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
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/30">
              ACADEMIC V2
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right Header Status Bar */}
      <div className="flex items-center gap-4">
        {/* System Time & Connection */}
        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Globe className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Madani Standard (604 Pages)</span>
          </div>
          <div className="w-px h-4 bg-slate-300 dark:bg-slate-800" />
          <div className="flex items-center gap-1.5 text-gold-600 dark:text-gold-400 font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>Recitation Engine</span>
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
              TR no.: {user.id}
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
