import React from 'react';
import { BookOpen, Mic, Award, GraduationCap, Sparkles, ChevronRight, Activity, Database } from 'lucide-react';
import { UserProfile } from './UserProfile';

export const Sidebar = ({ activeTab, setActiveTab, user }) => {
  const navItems = [
    {
      id: 'tilawat',
      label: 'Tilawat Reading',
      arabic: 'الـتـلاوة',
      icon: BookOpen,
      badge: 'Manuscript',
      color: 'from-amber-500/20 to-amber-600/10 text-amber-400 border-amber-500/30',
      description: 'Page manuscript & audio recitation'
    },
    {
      id: 'tasmee',
      label: 'Tasmee Recitation',
      arabic: 'التسميع المباشر',
      icon: Mic,
      badge: 'Batch AI',
      color: 'from-emerald-500/20 to-emerald-600/10 text-emerald-400 border-emerald-500/30',
      description: 'Batch audio memorization test'
    },
    {
      id: 'ikhtebaar',
      label: 'Ikhtebaar Testing',
      arabic: 'الاختبار الأكاديمي',
      icon: Award,
      badge: 'Exam Mode',
      color: 'from-blue-500/20 to-blue-600/10 text-blue-400 border-blue-500/30',
      description: 'Intelligent AI testing & hints'
    },
    {
      id: 'analytics',
      label: 'Student Analytics',
      arabic: 'لوحة الأداء',
      icon: Activity,
      badge: 'Metrics',
      color: 'from-purple-500/20 to-purple-600/10 text-purple-400 border-purple-500/30',
      description: 'Progress heatmap & mistake queue'
    }
  ];

  return (
    <aside className="w-80 flex-shrink-0 min-h-screen bg-white dark:bg-slate-950/95 border-r border-slate-200 dark:border-slate-800/80 backdrop-blur-xl flex flex-col justify-between p-4 z-30 select-none shadow-xl transition-colors duration-200">
      {/* Top Section */}
      <div className="space-y-6">
        {/* Academic Branding Header */}
        <div className="flex items-center gap-3.5 p-2 rounded-2xl bg-slate-100 dark:bg-gradient-to-r dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border border-slate-200 dark:border-gold-500/25 shadow-md">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 via-amber-600 to-amber-800 p-0.5 shadow-lg flex items-center justify-center flex-shrink-0">
            <div className="w-full h-full rounded-[10px] bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-gold-500 dark:text-gold-400" />
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-base tracking-wide gold-gradient-text">
                Academic Quran
              </h1>
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tracking-wider uppercase">
              Portal of Recitation AI
            </span>
          </div>
        </div>

        {/* User Profile Component Section */}
        <div className="pt-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 mb-2 flex items-center justify-between">
            <span>Student Identification</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <UserProfile user={user} compact={false} />
        </div>

        {/* Navigation Section */}
        <div className="space-y-1.5 pt-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 mb-2">
            Academic Modules
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left p-3 rounded-xl transition-all duration-200 group relative flex items-center gap-3 border ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/10 via-slate-100 to-slate-100 dark:from-amber-950/50 dark:via-slate-900 dark:to-slate-900 border-amber-500/50 shadow-md text-slate-900 dark:text-white'
                    : 'bg-slate-50/40 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 hover:border-slate-300/80 dark:hover:border-slate-700/80 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-gradient-to-b from-amber-400 to-amber-600 rounded-r-full" />
                )}

                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${
                    isActive
                      ? 'bg-amber-500/10 dark:bg-amber-500/20 text-gold-600 dark:text-gold-300 border border-amber-500/30 dark:border-amber-500/40 shadow-inner'
                      : 'bg-slate-200 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold text-sm tracking-tight ${isActive ? 'text-gold-600 dark:text-gold-200' : 'text-slate-700 dark:text-slate-200'}`}>
                      {item.label}
                    </span>
                    <span className="font-arabic text-xs text-amber-600 dark:text-amber-400/80">{item.arabic}</span>
                  </div>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 truncate mt-0.5">
                    {item.description}
                  </p>
                </div>

                <ChevronRight
                  className={`w-4 h-4 transition-transform ${
                    isActive ? 'text-gold-550 dark:text-gold-400 translate-x-0.5' : 'text-slate-400 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-400'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom System & Academic Status Card */}
      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80 space-y-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-550 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> AI Whisper Model
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
              READY
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-550 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" /> Database Status
            </span>
            <span className="text-gold-600 dark:text-gold-400 font-mono text-[10px]">
              604 Pages Loaded
            </span>
          </div>
        </div>

        <div className="text-center text-[10px] text-slate-500 dark:text-slate-400 font-mono">
          Academic Quranic Portal v2.4 • Batch AI
        </div>
      </div>
    </aside>
  );
};
