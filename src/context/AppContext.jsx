import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
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
    if (quranData) return quranData;
    setLoadingJson(true);
    try {
      const res = await fetch('/data/quran_data.json');
      if (res.ok) {
        const data = await res.json();
        setQuranData(data);
        setLoadingJson(false);
        return data;
      }
    } catch (err) {
      console.error("Failed to load quran_data.json:", err);
    }
    setLoadingJson(false);
    return null;
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
    startSurah: 1,
    endSurah: 1,
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
    startSurah: 1,
    endSurah: 1,
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
      tilawatState,
      updateTilawat,
      tasmeeState,
      updateTasmee,
      ikhtebaarState,
      updateIkhtebaar
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
