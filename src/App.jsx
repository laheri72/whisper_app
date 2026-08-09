import React, { useState, useEffect, createContext, useContext } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './components/Login';
import { OnboardingModal } from './components/OnboardingModal';
import { TilawatTab } from './components/TilawatTab';
import { TasmeeTab } from './components/TasmeeTab';
import { IkhtebaarTab } from './components/IkhtebaarTab';
import { RefreshCw } from 'lucide-react';

// Create Theme & Auth Contexts for enterprise-grade state propagation
export const ThemeContext = createContext();
export const AuthContext = createContext();

export function App() {
  const [activeTab, setActiveTab] = useState('tilawat');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Initialize theme class on root element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Fetch logged-in user profile on application mount
  const checkUserSession = async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Session verification failed:", err);
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    checkUserSession();
  }, []);

  const handleLoginSuccess = async (username) => {
    setLoadingUser(true);
    await checkUserSession();
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      setUser(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleOnboardingComplete = (displayName) => {
    setUser(prev => ({
      ...prev,
      display_name: displayName,
      is_first_login: false
    }));
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Render a clean spinner while validating auth session
  if (loadingUser) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-gold-400">
        <RefreshCw className="w-10 h-10 animate-spin mb-4" />
        <span className="text-sm font-semibold tracking-wider uppercase font-mono">
          Verifying Portal Session...
        </span>
      </div>
    );
  }

  // Route to Auth Screen if user is not authenticated
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Interrupt routing and enforce Display Name onboarding modal if first-time user
  if (user.is_first_login) {
    return <OnboardingModal onSubmitDisplayName={handleOnboardingComplete} />;
  }

  const computedUserInitials = user.display_name
    ? user.display_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : user.username.substring(0, 2).toUpperCase();

  const userProfileData = {
    id: user.username,
    name: user.display_name || user.username,
    initials: computedUserInitials,
    badge: "Registered User"
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <AuthContext.Provider value={{ user: userProfileData, handleLogout }}>
        {/* Core Layout wrapper with strict height & width limits to solve blank screen issues */}
        <div className="h-screen w-screen flex overflow-hidden bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
          
          {/* Persistent Sidebar */}
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            user={userProfileData}
            theme={theme}
            toggleTheme={toggleTheme}
            handleLogout={handleLogout}
          />

          {/* Main Dashboard Space */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            {/* Header */}
            <Header 
              activeTab={activeTab} 
              user={userProfileData} 
              theme={theme}
              toggleTheme={toggleTheme}
              handleLogout={handleLogout}
            />

            {/* Scrollable Viewport Container */}
            <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-100/50 dark:bg-slate-900/30 transition-colors duration-200">
              <div className="max-w-7xl w-full mx-auto h-full">
                {activeTab === 'tilawat' && <TilawatTab />}
                {activeTab === 'tasmee' && <TasmeeTab />}
                {activeTab === 'ikhtebaar' && <IkhtebaarTab />}
              </div>
            </main>
          </div>
        </div>
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}

export default App;
