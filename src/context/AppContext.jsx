import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children, onSetActiveTab }) => {
  // Shared global quran_data.json states
  const [quranData, setQuranData] = useState(null);
  const [loadingJson, setLoadingJson] = useState(false);

  // Model Readiness & Health States
  const [isModelReady, setIsModelReady] = useState(false);
  const [modelStatus, setModelStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [modelName, setModelName] = useState('tarteel-ai/whisper-base-ar-quran');
  const [modelError, setModelError] = useState('');

  const checkModelStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/model_status');
      if (res.ok) {
        const data = await res.json();
        const ready = Boolean(data.model_loaded);
        setIsModelReady(ready);
        setModelStatus(data.status || (ready ? 'ready' : 'loading'));
        if (data.model_name) setModelName(data.model_name);
        if (data.error) setModelError(data.error);
        return ready;
      }
    } catch (err) {
      console.warn("Failed to check model status:", err);
    }
    return false;
  }, []);

  // Poll for model readiness on initial mount until ready
  useEffect(() => {
    let interval = null;
    let isMounted = true;

    const poll = async () => {
      const ready = await checkModelStatus();
      if (ready && interval) {
        clearInterval(interval);
      }
    };

    poll();
    interval = setInterval(poll, 2000);

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [checkModelStatus]);

  const fetchQuranData = async () => {
    // High-speed direct image streaming via /api/page_image/{page} replaces monolithic 370MB JSON download
    setLoadingJson(false);
    return [];
  };

  // Quran Simple text cache (used by MutashabehatTab)
  const [quranSimple, setQuranSimple] = useState(null);
  const [loadingSimple, setLoadingSimple] = useState(false);

  const fetchQuranSimple = useCallback(async () => {
    if (quranSimple) return;
    setLoadingSimple(true);
    try {
      const res = await fetch('/api/quran-simple');
      if (res.ok) {
        const data = await res.json();
        setQuranSimple(data);
      } else {
        console.error('Failed to fetch quran-simple:', res.status);
      }
    } catch (err) {
      console.error('fetchQuranSimple error:', err);
    } finally {
      setLoadingSimple(false);
    }
  }, [quranSimple]);

  // Cross-tab navigation — delegates to App.jsx setActiveTab via prop
  const setActiveTab = (tabId) => {
    if (onSetActiveTab) onSetActiveTab(tabId);
  };

  // 1. Tilawat Tab Persistent State
  const [tilawatState, setTilawatState] = useState({
    pageNumber: 1
  });

  // 2. Tasmee Tab Persistent State
  const [tasmeeState, setTasmeeState] = useState({
    rangeMode: 'juz',
    selectedJuz: 1,
    fromPage: 1,
    toPage: 21,
    startSurah: 112,
    endSurah: 112,
    expectedText: '',
    paginatedPages: [],
    activePageIndex: 0,
    textError: '',
    evaluationResult: null,
    elapsedSeconds: 0,
    recordedAudioUrl: '',
    recordedAudioBlob: null,
    whisperCorrections: '',
    transcriptionData: [],
    isPaused: false
  });

  // 3. Ikhtebaar Tab Persistent State
  const [ikhtebaarState, setIkhtebaarState] = useState({
    rangeMode: 'page',
    selectedJuz: 1,
    fromPage: 1,
    toPage: 21,
    startSurah: 112,
    endSurah: 112,
    difficulty: 'easy',
    currentQuestion: null,
    excludedQuestions: [],
    activeHint: null,
    gradeResult: null,
    elapsedSeconds: 0,
    recordedAudioUrl: '',
    recordedAudioBlob: null,
    whisperCorrections: '',
    transcriptionData: [],
    isPaused: false
  });

  // 4. Mutashabehat Tab Persistent State
  const [mutashabehatState, setMutashabehatState] = useState({
    searchMode: 'verse', // 'verse' | 'keyword'
    keywordQuery: '',
    keywordMatchType: 'phrase', // 'phrase' | 'all' | 'any'
    surahNum: 1,
    ayahNum: 1,
    targetVerse: null,
    selectedWords: new Set(),
    matches: [],
    hasSearched: false,
    scopeMode: 'juz',
    selectedJuz: [],
    selectedSurahs: [],
    pageRange: { start: 1, end: 604 }
  });

  // Helper methods to modify states support functional updates
  const updateTilawat = (update) => {
    setTilawatState(prev => ({
      ...prev,
      ...(typeof update === 'function' ? update(prev) : update)
    }));
  };

  const updateTasmee = (update) => {
    setTasmeeState(prev => ({
      ...prev,
      ...(typeof update === 'function' ? update(prev) : update)
    }));
  };

  const updateIkhtebaar = (update) => {
    setIkhtebaarState(prev => ({
      ...prev,
      ...(typeof update === 'function' ? update(prev) : update)
    }));
  };

  const updateMutashabehat = (update) => {
    setMutashabehatState(prev => ({
      ...prev,
      ...(typeof update === 'function' ? update(prev) : update)
    }));
  };

  return (
    <AppContext.Provider value={{
      quranData,
      loadingJson,
      fetchQuranData,
      setQuranData,
      isModelReady,
      modelStatus,
      modelName,
      modelError,
      checkModelStatus,
      setActiveTab,
      quranSimple,
      loadingSimple,
      fetchQuranSimple,
      tilawatState,
      updateTilawat,
      tasmeeState,
      updateTasmee,
      ikhtebaarState,
      updateIkhtebaar,
      mutashabehatState,
      updateMutashabehat
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
