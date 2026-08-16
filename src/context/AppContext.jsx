import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // Shared global quran_data.json states
  const [quranData, setQuranData] = useState(null);
  const [loadingJson, setLoadingJson] = useState(false);

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
