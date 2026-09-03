import React from 'react';
import { ShieldCheck, UserCheck, CheckCircle2 } from 'lucide-react';

export const UserProfile = ({ 
  user = { 
    id: "27137", 
    name: "Mustafa Shakir", 
    initials: "MS", 
    badge: "Registered User", 
    department: "Quranic Sciences & Recitation",
    status: "Active Talib"
  },
  compact = false 
}) => {
  if (compact) {
    return (
      <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-gold-500/20 hover:border-slate-300 dark:hover:border-gold-500/40 transition-all">
        <div className="relative flex items-center justify-center w-10 h-10 min-w-[40px] max-w-[40px] min-h-[40px] max-h-[40px] shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 font-bold text-sm shadow-md">
          {user.profilePhoto ? (
            <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover shrink-0 block" />
          ) : (
            user.initials
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-200 dark:border-slate-900" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user.name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono text-gold-600 dark:text-gold-400">TR no.: {user.id}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/30">
              {user.badge}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-950/40 p-4 border border-slate-200 dark:border-gold-500/20 shadow-md group">
      {/* Subtle Background Glow Accent */}
      <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-gold-500/5 dark:bg-gold-500/10 blur-xl group-hover:bg-gold-500/15 dark:group-hover:bg-gold-500/20 transition-all duration-500" />
      
      <div className="relative z-10 flex items-start gap-4">
        {/* User Initials Avatar */}
        <div className="relative flex-shrink-0 w-12 h-12 min-w-[48px] max-w-[48px] min-h-[48px] max-h-[48px]">
          <div className="w-12 h-12 min-w-[48px] max-w-[48px] min-h-[48px] max-h-[48px] rounded-2xl overflow-hidden bg-gradient-to-br from-amber-400 via-amber-600 to-amber-800 text-slate-950 font-extrabold text-lg flex items-center justify-center shadow-gold-glow border border-amber-300/40 shrink-0">
            {user.profilePhoto ? (
              <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover shrink-0 block" />
            ) : (
              user.initials
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-slate-100 dark:bg-slate-955 z-10">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 fill-emerald-50 dark:fill-emerald-950" />
          </div>
        </div>

        {/* User Info Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base tracking-tight truncate group-hover:text-gold-600 dark:group-hover:text-gold-300 transition-colors">
              {user.name}
            </h3>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-200/60 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-300/40 dark:border-slate-700/60">
              TR no.: <strong className="text-gold-600 dark:text-gold-400">{user.id}</strong>
            </span>
          </div>

          {/* Registered User Badge */}
          <div className="mt-2.5 flex items-center gap-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300/65 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold shadow-inner">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>{user.badge}</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
};
