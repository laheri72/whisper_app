import React, { useEffect, useRef, useState } from 'react';
import { Award, HelpCircle, ChevronDown, ChevronUp, Mic, MicOff, RefreshCw, CheckCircle2, AlertCircle, Sparkles, Zap, Shield, Flame, BookOpen, Pause, Play, Download } from 'lucide-react';
import { getJuzPageRange, JUZ_LIST, SURAH_LIST } from '../utils/juzMapping';
import { WaveMediaRecorder } from '../utils/audioRecorder';
import { AudioVisualizer } from './AudioVisualizer';
import { useApp } from '../context/AppContext';
import { getPageFromManuscript } from '../utils/quranLookup';

export const IkhtebaarTab = () => {
  const { ikhtebaarState, updateIkhtebaar, quranData, fetchQuranData, loadingJson } = useApp();
  const [showFullPage, setShowFullPage] = useState(false);

  const handleViewFullPage = async () => {
    setShowFullPage(true);
    if (!quranData) {
      await fetchQuranData();
    }
  };
  const {
    rangeMode,
    selectedJuz,
    fromPage,
    toPage,
    startSurah,
    endSurah,
    difficulty,
    currentQuestion,
    excludedQuestions,
    activeHint,
    gradeResult,
    elapsedSeconds,
    recordedAudioUrl,
    recordedAudioBlob,
    whisperCorrections,
    transcriptionData,
    isPaused
  } = ikhtebaarState;

  // Stateful setters mapped to context updates
  const setRangeMode = (val) => updateIkhtebaar({ rangeMode: typeof val === 'function' ? val(rangeMode) : val });
  const setSelectedJuz = (val) => updateIkhtebaar({ selectedJuz: typeof val === 'function' ? val(selectedJuz) : val });
  const setFromPage = (val) => updateIkhtebaar({ fromPage: typeof val === 'function' ? val(fromPage) : val });
  const setToPage = (val) => updateIkhtebaar({ toPage: typeof val === 'function' ? val(toPage) : val });
  const setStartSurah = (val) => updateIkhtebaar({ startSurah: typeof val === 'function' ? val(startSurah) : val });
  const setEndSurah = (val) => updateIkhtebaar({ endSurah: typeof val === 'function' ? val(endSurah) : val });
  const setDifficulty = (val) => updateIkhtebaar({ difficulty: typeof val === 'function' ? val(difficulty) : val });
  const setCurrentQuestion = (val) => updateIkhtebaar({ currentQuestion: typeof val === 'function' ? val(currentQuestion) : val });
  const setExcludedQuestions = (val) => updateIkhtebaar({ excludedQuestions: typeof val === 'function' ? val(excludedQuestions) : val });
  const setActiveHint = (val) => updateIkhtebaar({ activeHint: typeof val === 'function' ? val(activeHint) : val });
  const setGradeResult = (val) => updateIkhtebaar({ gradeResult: typeof val === 'function' ? val(gradeResult) : val });

  // Transient UI states
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomedPageList, setZoomedPageList] = useState([]);
  const [currentZoomedIndex, setCurrentZoomedIndex] = useState(0);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFinalizingStream, setIsFinalizingStream] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('');
  const [analyserNode, setAnalyserNode] = useState(null);
  const [gradingError, setGradingError] = useState('');

  const mediaRecorderRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const correctionsContainerRef = useRef(null);
  const chunkIndexRef = useRef(0);
  const sessionIdRef = useRef('');

  // Auto-scroll the real-time transcription container and log updates
  useEffect(() => {
    console.log("Exam Transcription Update:", transcriptionData);
    if (correctionsContainerRef.current) {
      correctionsContainerRef.current.scrollTop = correctionsContainerRef.current.scrollHeight;
    }
  }, [transcriptionData]);

  // Apply Juz page range calculations
  useEffect(() => {
    if (rangeMode === 'juz') {
      const range = getJuzPageRange(selectedJuz);
      updateIkhtebaar({
        fromPage: range.startPage,
        toPage: range.endPage
      });
    }
  }, [selectedJuz, rangeMode]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    };
  }, []);

  // Handle Keyboard Navigation inside Zoom Modal (RTL logic)
  useEffect(() => {
    if (!isZoomed || zoomedPageList.length === 0) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsZoomed(false);
      } else if (e.key === 'ArrowLeft') {
        // Arabic RTL: Left Arrow goes to NEXT page
        if (currentZoomedIndex < zoomedPageList.length - 1) {
          setCurrentZoomedIndex(prev => Math.min(zoomedPageList.length - 1, prev + 1));
        }
      } else if (e.key === 'ArrowRight') {
        // Arabic RTL: Right Arrow goes to PREVIOUS page
        if (currentZoomedIndex > 0) {
          setCurrentZoomedIndex(prev => Math.max(0, prev - 1));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isZoomed, currentZoomedIndex, zoomedPageList]);


  // Fetch AI Question from /api/generate_ikhtebaar
  const generateQuestion = async () => {
    setIsLoadingQuestion(true);
    setQuestionError('');
    setGradeResult(null);
    setGradingError('');
    updateIkhtebaar({
      activeHint: null,
      whisperCorrections: '',
      transcriptionData: [],
      recordedAudioUrl: '',
      recordedAudioBlob: null
    });

    let modeParam = 'page';
    let startVal = fromPage;
    let endVal = toPage;

    if (rangeMode === 'juz') {
      const range = getJuzPageRange(selectedJuz);
      modeParam = 'page';
      startVal = range.startPage;
      endVal = range.endPage;
    } else if (rangeMode === 'page') {
      modeParam = 'page';
      startVal = fromPage;
      endVal = toPage;
    } else if (rangeMode === 'surah') {
      modeParam = 'surah';
      startVal = startSurah;
      endVal = endSurah;
    }

    const excludeParam = excludedQuestions.join(',');

    try {
      const url = `/api/generate_ikhtebaar?mode=${modeParam}&start_val=${startVal}&end_val=${endVal}&difficulty=${difficulty}&exclude=${excludeParam}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`Server returned HTTP status ${res.status}`);
      }

      const responseData = await res.json();
      
      // Verify whether data is located at res.data, res.data.question, or the root of the response payload
      const data = responseData?.data || responseData;
      const questionPayload = data?.question || data;

      if (questionPayload?.error) {
        setQuestionError(questionPayload.error);
        setCurrentQuestion(null);
      } else if (!questionPayload || Object.keys(questionPayload).length === 0) {
        throw new Error("Empty question payload received from server.");
      } else {
        console.log("Generated Exam Question:", questionPayload);
        console.log("Exam Boundary Data:", questionPayload);
        setCurrentQuestion(questionPayload);
        if (questionPayload?.question_id) {
          setExcludedQuestions(prev => [...prev, questionPayload.question_id]);
        }
      }
    } catch (error) {
      console.error("Exam generation failed:", error);
      setQuestionError(error?.message || "Failed to generate exam question. Please check server connection.");
      setCurrentQuestion(null);
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  // 1. INITIATE RECITATION (Continuous Buffer WAV Chunking Mode)
  const initiateRecitation = async () => {
    if (!currentQuestion) {
      alert("Please generate an exam question first.");
      return;
    }

    try {
      setIsStartingRecording(true);

      // Clean up previous blob URL to prevent memory leaks
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }

      setGradingError('');

      // Clear previous recording buffer/blob state immediately (Overwrite)
      updateIkhtebaar({
        recordedAudioUrl: '',
        recordedAudioBlob: null,
        whisperCorrections: '',
        transcriptionData: [],
        isPaused: false,
        gradeResult: null,
        elapsedSeconds: 0
      });

      // Generate random unique Session ID
      const sessId = 'sess_ikhtebaar_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      sessionIdRef.current = sessId;
      chunkIndexRef.current = 0;

      // Wipe incoming files from any previous chunks
      await fetch('/api/cleanup_temp', { 
        method: 'POST', 
        body: new URLSearchParams({ session_id: sessionIdRef.current }) 
      }).catch(() => {});

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });

      const recorder = new WaveMediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      // Handle 10-second chunks ondataavailable
      recorder.ondataavailable = async (e) => {
        if (!e.data || e.data.size === 0) return;

        const formData = new FormData();
        formData.append('file', e.data, `chunk_${chunkIndexRef.current}.wav`);
        formData.append('session_id', sessionIdRef.current);
        formData.append('chunk_index', chunkIndexRef.current);

        chunkIndexRef.current += 1;

        try {
          const res = await fetch('/transcribe_chunk', {
            method: 'POST',
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            
            // ADD DEBUGGING LOGS:
            console.log("Whisper Chunk Response:", data);

            if (data.comparison && Array.isArray(data.comparison)) {
              updateIkhtebaar(prev => ({
                transcriptionData: [...prev.transcriptionData, ...data.comparison]
              }));
            } else if (data.words && Array.isArray(data.words)) {
              updateIkhtebaar(prev => ({
                transcriptionData: [...prev.transcriptionData, ...data.words]
              }));
            } else if (Array.isArray(data)) {
              updateIkhtebaar(prev => ({
                transcriptionData: [...prev.transcriptionData, ...data]
              }));
            } else if (data.transcription) {
              updateIkhtebaar(prev => ({
                transcriptionData: [...prev.transcriptionData, { text: data.transcription, isRawString: true }]
              }));
            }
          }
        } catch (err) {
          console.warn("Real-time chunk grading failed:", err);
        }
      };

      // Set stopping event handler to collect complete merged recording WAV
      recorder.onstop = async (finalBlob) => {
        setIsFinalizingStream(false);
        setIsAnalyzing(true);
        setAnalysisProgress(10);
        setAnalysisStage("AI is analyzing your recitation, please wait...");

        // Save final blob locally and generate URL for HTML5 Audio player
        const finalUrl = URL.createObjectURL(finalBlob);
        updateIkhtebaar({
          recordedAudioBlob: finalBlob,
          recordedAudioUrl: finalUrl
        });

        // Trigger Final neural grading assessment
        let currentProg = 15;
        const progressInterval = setInterval(() => {
          currentProg += Math.floor(Math.random() * 8) + 5;
          if (currentProg >= 92) currentProg = 92;
          setAnalysisProgress(currentProg);
        }, 300);

        try {
          const startVal = rangeMode === 'juz' ? selectedJuz : rangeMode === 'page' ? fromPage : startSurah;
          const endVal = rangeMode === 'juz' ? selectedJuz : rangeMode === 'page' ? toPage : endSurah;

          const formData = new FormData();
          formData.append('file', finalBlob, 'ikhtebaar_recitation.wav');
          formData.append('expected_text', currentQuestion.expected_full_text);
          formData.append('module_type', 'ikhtebaar');
          formData.append('range_mode', rangeMode);
          formData.append('start_val', startVal.toString());
          formData.append('end_val', endVal.toString());

          const response = await fetch('/transcribe_and_compare', {
            method: 'POST',
            body: formData
          });

          clearInterval(progressInterval);

          if (!response.ok) {
            throw new Error(`Server returned HTTP status ${response.status}`);
          }

          const resultData = await response.json();
          setAnalysisProgress(100);
          setAnalysisStage("Exam Assessment Complete!");
          await new Promise(r => setTimeout(r, 300));
          setGradeResult(resultData);

          // Wipes temporary audio files on completion
          fetch('/api/cleanup_temp', { 
            method: 'POST', 
            body: new URLSearchParams({ session_id: sessionIdRef.current }) 
          }).catch(() => {});

        } catch (err) {
          clearInterval(progressInterval);
          console.error("Evaluation error:", err);
          setGradingError("Failed to grade exam recitation: " + err.message);
        } finally {
          setIsAnalyzing(false);
          setAnalyserNode(null);
          setAnalysisProgress(0);
          setAnalysisStage('');
        }
      };

      // Start recorder with 10s timeslice (10000ms)
      recorder.start(10000);
      setAnalyserNode(recorder.getAnalyser());
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          updateIkhtebaar(prev => ({ elapsedSeconds: prev.elapsedSeconds + 1 }));
        }
      }, 1000);

    } catch (err) {
      alert(err.message || "Failed to start microphone recording.");
    } finally {
      setIsStartingRecording(false);
    }
  };

  // 2. PAUSE RECITATION
  const pauseRecitation = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      updateIkhtebaar({ isPaused: true });
    }
  };

  // 3. RESUME RECITATION
  const resumeRecitation = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      updateIkhtebaar({ isPaused: false });
    }
  };

  // 4. CONCLUDE RECITATION & FLUSH CHUNKS
  const concludeRecitation = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    try {
      setIsRecording(false);
      setIsFinalizingStream(true);
      setAnalysisStage("Flushing audio recording buffer...");
      
      // Stop the recorder, triggering the onstop callback with merged audio bytes
      mediaRecorderRef.current.stop();

    } catch (err) {
      console.error(err);
      alert("Failed to wrap up exam: " + err.message);
      setIsAnalyzing(false);
      setIsFinalizingStream(false);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const matchCount = gradeResult?.comparison?.filter(c => c.status === 'match').length || 0;
  const mistakeCount = gradeResult?.comparison?.filter(c => c.status === 'mistake').length || 0;
  const totalWords = gradeResult?.comparison?.length || 0;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Exam Configuration Header */}
      <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/30 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-gold-400" /> Academic Exam Configurator
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Set exam boundaries and difficulty. Algorithm selects non-repeating testing passages.
            </p>
          </div>

          {/* Range Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setRangeMode('juz')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                rangeMode === 'juz' ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Juz Module (1-30)
            </button>
            <button
              onClick={() => setRangeMode('page')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                rangeMode === 'page' ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Page Range
            </button>
            <button
              onClick={() => setRangeMode('surah')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                rangeMode === 'surah' ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Surah Range
            </button>
          </div>
        </div>

        {/* Dynamic configurations */}
        <div className="flex flex-wrap items-center gap-6">
          {rangeMode === 'juz' && (
            <div className="flex items-center gap-4 flex-1 min-w-[280px]">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-400 mb-1">Select Juz Module (1-30):</label>
                <select
                  value={selectedJuz}
                  onChange={(e) => setSelectedJuz(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 text-gold-300 font-bold text-sm rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-amber-500"
                >
                  {JUZ_LIST.map((j) => (
                    <option key={j.id} value={j.id}>{j.displayLabel}</option>
                  ))}
                </select>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/90 border border-gold-500/30 text-center">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Exam Boundaries</span>
                <span className="text-xs font-mono font-bold text-amber-400">Page {fromPage} → {toPage}</span>
              </div>
            </div>
          )}

          {rangeMode === 'page' && (
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">From Page:</label>
                <input
                  type="number"
                  min={1}
                  max={604}
                  value={fromPage}
                  onChange={(e) => setFromPage(parseInt(e.target.value, 10))}
                  className="w-28 bg-slate-900 text-gold-300 font-bold text-sm rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">To Page:</label>
                <input
                  type="number"
                  min={1}
                  max={604}
                  value={toPage}
                  onChange={(e) => setToPage(parseInt(e.target.value, 10))}
                  className="w-28 bg-slate-900 text-gold-300 font-bold text-sm rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {rangeMode === 'surah' && (
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Start Surah:</label>
                <select
                  value={startSurah}
                  onChange={(e) => setStartSurah(parseInt(e.target.value, 10))}
                  className="bg-slate-900 text-slate-100 text-xs font-semibold rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-500"
                >
                  {SURAH_LIST.map((s) => (
                    <option key={s.id} value={s.id}>{s.id}. {s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">End Surah:</label>
                <select
                  value={endSurah}
                  onChange={(e) => setEndSurah(parseInt(e.target.value, 10))}
                  className="bg-slate-900 text-slate-100 text-xs font-semibold rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-500"
                >
                  {SURAH_LIST.map((s) => (
                    <option key={s.id} value={s.id}>{s.id}. {s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Difficulty Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Difficulty:</label>
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              {['easy', 'medium', 'hard'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase ${
                    difficulty === d
                      ? d === 'easy' ? 'bg-emerald-500 text-slate-950 shadow-md font-bold' : d === 'medium' ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'bg-red-500 text-white shadow-md font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>          {/* Generate Question Button */}
          <button
            onClick={generateQuestion}
            disabled={isLoadingQuestion}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-gold-glow transition-all disabled:opacity-50 ml-auto"
          >
            {isLoadingQuestion ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
            <span>Generate Exam Question</span>
          </button>
        </div>
      </div>

      {/* 2. Question Prompt Card & Audio controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Card: Oral Question Prompt */}
        <div className="glass-panel rounded-2xl p-6 border border-gold-500/20 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-gold-400" /> Exam Verse Selection
            </h3>
            {currentQuestion && (
              <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                Difficulty: {difficulty}
              </span>
            )}
          </div>

          {currentQuestion ? (() => {
            const surahName = currentQuestion?.surah_name || `Surah ${currentQuestion?.sura_number || currentQuestion?.surah_number || ""}`;
            const pageNumber = currentQuestion?.page_number || "";
            const ayahNumber = currentQuestion?.ayah_number || currentQuestion?.start_ayah_num || "";
            const arabicText = currentQuestion?.arabic_text || currentQuestion?.start_text || "";
            return (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Test Instructions:</span>
                  <p className="text-xs text-slate-300">
                    Read and recite the verse printed below. Recitation starts at this verse, and you must recite the continuing verses from memory until the exam boundaries stop you.
                  </p>
                </div>

                {/* Start Ayah Prompt */}
                <div className="p-5 rounded-xl bg-slate-900/60 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Start Recitation Verse ({surahName}, Page {pageNumber}):
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleViewFullPage}
                        className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-[10px] uppercase transition-all shadow-sm"
                      >
                        View Whole Page
                      </button>
                      <span className="font-mono text-amber-400 font-bold">Ayah {ayahNumber}</span>
                    </div>
                  </div>
                  <p dir="rtl" className="font-arabic text-2xl text-amber-100 text-right leading-loose mt-2">
                    {arabicText}
                  </p>
                </div>

                {/* Stop Ayah Prompt */}
                <div className="p-5 rounded-xl bg-red-950/10 border border-red-500/30 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="text-red-400 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                      Stop At This Verse (End Point):
                    </span>
                    <span className="font-mono text-red-400 font-bold">
                      {currentQuestion?.end_surah_name || '...'}, Ayah {currentQuestion?.end_ayah_number || '...'} (Page {currentQuestion?.end_page_number || '...'})
                    </span>
                  </div>
                  <p dir="rtl" className="font-arabic text-2xl text-red-100/90 text-right leading-loose mt-2">
                    {currentQuestion?.end_arabic_text || currentQuestion?.stop_text || "..."}
                  </p>
                </div>

                {/* Help Hints Accordion */}
                <div className="space-y-2 pt-2">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Interactive Scholarship Hints:</span>

                  {/* Hint 1 */}
                  <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                    <button
                      onClick={() => setActiveHint(activeHint === 'hint_1' ? null : 'hint_1')}
                      className="w-full p-3 text-left text-xs font-semibold text-slate-300 flex items-center justify-between hover:bg-slate-900 transition-all"
                    >
                      <span>Hint 1: First Ayah on Page {pageNumber}</span>
                      {activeHint === 'hint_1' ? <ChevronUp className="w-4 h-4 text-gold-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {activeHint === 'hint_1' && (
                      <div dir="rtl" className="p-4 border-t border-slate-800 text-right font-arabic text-xl text-amber-200 bg-slate-900/60">
                        {currentQuestion?.hint_1 || "No hint available"}
                      </div>
                    )}
                  </div>

                  {/* Hint 2 */}
                  <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                    <button
                      onClick={() => setActiveHint(activeHint === 'hint_2' ? null : 'hint_2')}
                      className="w-full p-3 text-left text-xs font-semibold text-slate-300 flex items-center justify-between hover:bg-slate-900 transition-all"
                    >
                      <span>Hint 2: Target Surah Identifier</span>
                      {activeHint === 'hint_2' ? <ChevronUp className="w-4 h-4 text-gold-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {activeHint === 'hint_2' && (
                      <div className="p-4 border-t border-slate-800 text-xs font-bold text-amber-300 bg-slate-900/60">
                        {currentQuestion?.hint_2 || "No hint available"}
                      </div>
                    )}
                  </div>

                  {/* Hint 3 */}
                  <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                    <button
                      onClick={() => setActiveHint(activeHint === 'hint_3' ? null : 'hint_3')}
                      className="w-full p-3 text-left text-xs font-semibold text-slate-300 flex items-center justify-between hover:bg-slate-900 transition-all"
                    >
                      <span>Hint 3: Preceding Passage Context</span>
                      {activeHint === 'hint_3' ? <ChevronUp className="w-4 h-4 text-gold-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {activeHint === 'hint_3' && (
                      <div dir="rtl" className="p-4 border-t border-slate-800 text-right font-arabic text-xl text-amber-200 bg-slate-900/60">
                        {currentQuestion?.hint_3 || "No hint available"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="py-12 text-center text-slate-400 text-xs font-semibold space-y-2">
              <HelpCircle className="w-8 h-8 mx-auto text-slate-500" />
              {questionError ? (
                <p className="text-red-400 font-bold">{questionError}</p>
              ) : (
                <p>Click "Generate Exam Question" above to start an oral examination test.</p>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Oral Examination Reciter & Audio Controls */}
        <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/30 shadow-xl flex flex-col justify-between space-y-5 lg:sticky lg:top-6 self-start">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Mic className="w-4 h-4 text-gold-400" /> Oral Examination Reciter
              </h3>
              {isStartingRecording ? (
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800 animate-pulse flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" /> Activating Mic...
                </span>
              ) : isRecording ? (
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                  isPaused 
                    ? 'text-yellow-400 bg-yellow-950/40 border-yellow-800' 
                    : 'text-red-400 bg-red-950 border-red-800 animate-pulse'
                }`}>
                  {isPaused ? "PAUSED" : "REC"}: {formatTime(elapsedSeconds)}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Click <strong>"Initiate Recitation"</strong> to record. Chunks are automatically dispatched to the Whisper AI model. Click <strong>"Conclude Recitation"</strong> to submit and grade.
            </p>
          </div>

          {/* Live Audio Visualizer */}
          <AudioVisualizer analyser={analyserNode} isRecording={isRecording && !isPaused} className="h-28" />

          {/* Action Buttons */}
          <div className="space-y-3">
            {isStartingRecording ? (
              <div className="py-4 rounded-xl bg-slate-900 border border-amber-500/40 text-center text-amber-300 text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Activating Microphone & Audio Graph...</span>
              </div>
            ) : isFinalizingStream ? (
              <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 text-center space-y-2 animate-pulse">
                <div className="flex items-center justify-center gap-2 text-amber-300 text-xs font-bold">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Merging Audio Chunks & Finalizing Stream...</span>
                </div>
              </div>
            ) : isAnalyzing ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-gold-500/40 shadow-gold-glow space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gold-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-spin-slow" /> AI Evaluation Pipeline
                  </span>
                  <span className="font-mono text-amber-400 font-extrabold">{analysisProgress}%</span>
                </div>

                <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-300 shadow-gold-glow"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>

                <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
                  <span className="animate-pulse text-slate-300 font-semibold">{analysisStage}</span>
                  <span className="text-amber-400/80 font-mono text-[10px]">Academic Engine</span>
                </div>
              </div>
            ) : !isRecording ? (
              <div className="space-y-3">
                <button
                  onClick={initiateRecitation}
                  disabled={!currentQuestion}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40"
                >
                  <Mic className="w-5 h-5" />
                  <span>Initiate Recitation</span>
                </button>

                {/* HTML5 Player & Download controls */}
                {recordedAudioUrl && (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 animate-fadeIn">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Play Back Recorded Session:</span>
                    <audio src={recordedAudioUrl} controls className="w-full" />
                    
                    <a
                      href={recordedAudioUrl}
                      download="ikhtebaar_recitation.wav"
                      className="w-full py-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-gold-500/40 text-gold-300 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                    >
                      <Download className="w-4 h-4" /> Save Recording
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Pause/Resume Switch controls */}
                <div className="flex gap-2">
                  {isPaused ? (
                    <button
                      onClick={resumeRecitation}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      <Play className="w-4 h-4" /> Resume Stream
                    </button>
                  ) : (
                    <button
                      onClick={pauseRecitation}
                      className="flex-1 py-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-amber-400 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      <Pause className="w-4 h-4" /> Pause Stream
                    </button>
                  )}
                </div>

                <button
                  onClick={concludeRecitation}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 transition-all"
                >
                  <MicOff className="w-5 h-5" />
                  <span>Conclude Recitation & Grade Exam</span>
                </button>
              </div>
            )}

            {/* Non-blocking inline grading error indicator */}
            {gradingError && (
              <div className="p-4 rounded-xl bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{gradingError}</span>
              </div>
            )}

            {/* Real-time transcription dynamic panel with scroll control and conditional word styling */}
            <div className="p-4 rounded-xl bg-slate-950/85 border border-slate-800 space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Real-Time Transcription (Whisper AI):</span>
              <div 
                ref={correctionsContainerRef}
                className="max-h-[160px] min-h-[60px] overflow-y-auto pr-1 flex flex-wrap flex-row-reverse justify-start items-center gap-2 text-right leading-relaxed font-arabic text-2xl"
                dir="rtl"
              >
                {transcriptionData && transcriptionData.length > 0 ? (
                  transcriptionData.map((item, idx) => {
                    if (item.isRawString) {
                      return (
                        <span key={idx} className="text-amber-200/90 font-medium">
                          {item.text}
                        </span>
                      );
                    }
                    const isCorrect = item.status === 'match' || item.status === 'correct' || item.correct === true || item.status === 'equal';
                    const wordText = item.word || item.text || (typeof item === 'string' ? item : JSON.stringify(item));
                    return (
                      <span
                        key={idx}
                        className={isCorrect 
                          ? "text-emerald-400 font-bold transition-all" 
                          : "text-red-500 line-through decoration-red-600/70 decoration-2 font-bold animate-pulse"
                        }
                      >
                        {wordText}
                      </span>
                    );
                  })
                ) : (
                  <div className="w-full text-center text-slate-600 font-mono text-sm tracking-widest py-2">
                    - - - - - - - -
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Academic Examination Evaluation & Report Card */}
      {gradeResult && (
        <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/40 shadow-2xl space-y-6 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-extrabold text-2xl flex items-center justify-center shadow-gold-glow">
                {gradeResult.score}%
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-100">Oral Examination Score</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    gradeResult.score >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {gradeResult.score >= 85 ? 'Passed - Mastered' : gradeResult.score >= 70 ? 'Passed - Needs Revision' : 'Needs Practice'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Exam audio transcribed and verified against Uthmani Quranic text standard.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Total Words</span>
                <span className="text-sm font-bold text-slate-100">{totalWords}</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-center">
                <span className="block text-[10px] text-emerald-400 font-semibold uppercase">Matches</span>
                <span className="text-sm font-bold text-emerald-300">{matchCount}</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-red-950/60 border border-red-500/30 text-center">
                <span className="block text-[10px] text-red-400 font-semibold uppercase">Mistakes</span>
                <span className="text-sm font-bold text-red-300">{mistakeCount}</span>
              </div>
            </div>
          </div>

          {gradeResult.user_transcription && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recognized Recitation Output:</span>
              <p dir="rtl" className="font-arabic text-lg text-amber-200 text-right">{gradeResult.user_transcription}</p>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Word-by-Word Analysis (Green = Match, Red = Mistake)</span>
              <span className="text-gold-400 font-arabic text-sm">التدقيق الحرفي</span>
            </h4>

            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap flex-row-reverse gap-3 text-right leading-loose font-arabic text-2xl">
              {gradeResult.comparison?.map((item, idx) => {
                const isMatch = item.status === 'match';
                return (
                  <span
                    key={idx}
                    className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-xl font-bold transition-all shadow-sm ${
                      isMatch
                        ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300 hover:border-emerald-400'
                        : 'bg-red-950/70 border-red-500/50 text-red-300 hover:border-red-400 ring-1 ring-red-500/30 animate-pulse'
                    }`}
                  >
                    {item.word}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {showFullPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-gold-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-100 text-sm">
                Misri Quran Manuscript — Page {currentQuestion?.page_number}
              </h3>
              <button 
                onClick={() => setShowFullPage(false)}
                className="text-slate-400 hover:text-white font-bold text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-all"
              >
                Close
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto flex items-center justify-center p-2 bg-slate-950 rounded-xl border border-slate-800 min-h-[300px]">
              {loadingJson ? (
                <div className="flex items-center gap-2 text-gold-400 text-xs font-bold animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-gold-400" />
                  <span>Loading manuscript database...</span>
                </div>
              ) : (() => {
                const pageData = getPageFromManuscript(quranData, currentQuestion?.page_number);
                const imageBase64 = pageData?.image_base64 || pageData?.misri_quran || quranData?.[currentQuestion?.page_number]?.misri_quran || "";
                return imageBase64 ? (
                  <img 
                    src={imageBase64} 
                    alt={`Misri Quran Manuscript Page ${currentQuestion?.page_number}`}
                    onClick={() => {
                      const startPage = Number(currentQuestion?.page_number || 1);
                      const endPage = Number(currentQuestion?.end_page_number || startPage);
                      const pageRangeList = startPage === endPage ? [startPage] : [startPage, endPage];
                      
                      setZoomedPageList(pageRangeList);
                      const idx = pageRangeList.indexOf(startPage);
                      setCurrentZoomedIndex(idx >= 0 ? idx : 0);
                      setIsZoomed(true);
                    }}
                    className="max-h-[60vh] object-contain rounded shadow-lg border border-slate-800 animate-fadeIn cursor-pointer transition-all hover:scale-[1.02] hover:border-gold-500/40"
                    title="Click to enlarge manuscript page"
                  />
                ) : (
                  <div className="text-slate-500 text-xs font-semibold">
                    Manuscript page data not found for Page {currentQuestion?.page_number}.
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {isZoomed && zoomedPageList.length > 0 && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fadeIn cursor-zoom-out"
          onClick={() => setIsZoomed(false)}
        >
          {/* Previous Page Navigation */}
          {currentZoomedIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentZoomedIndex(prev => Math.max(0, prev - 1));
              }}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-50 text-white hover:text-amber-400 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-700/50 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next Page Navigation */}
          {currentZoomedIndex < zoomedPageList.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentZoomedIndex(prev => Math.min(zoomedPageList.length - 1, prev + 1));
              }}
              className="absolute right-6 top-1/2 -translate-y-1/2 z-50 text-white hover:text-amber-400 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-700/50 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          <div className="relative max-w-full max-h-[90vh] flex flex-col items-center justify-center">
            <button
              onClick={() => setIsZoomed(false)}
              className="absolute top-4 right-4 z-50 text-white hover:text-red-400 font-extrabold text-lg bg-black/60 hover:bg-black/85 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all"
              title="Close Enlarged View"
            >
              ✕
            </button>
            
            {(() => {
              const safePageList = Array.isArray(zoomedPageList) ? zoomedPageList : [];
              const safeIndex = (currentZoomedIndex >= 0 && currentZoomedIndex < safePageList.length) ? currentZoomedIndex : 0;
              const pageNum = safePageList[safeIndex];
              
              // Debug logging
              console.log("Modal active page:", pageNum, "Data:", quranData ? (Array.isArray(quranData) ? quranData.find(item => Number(item?.page_number) === Number(pageNum)) : quranData?.[pageNum]) : "No Quran data");
              
              if (!pageNum) {
                return (
                  <div className="text-slate-500 text-xs font-semibold py-8">
                    Loading page...
                  </div>
                );
              }
              
              const pageData = getPageFromManuscript(quranData, pageNum);
              const imgUrl = pageData?.image_base64 || pageData?.misri_quran || quranData?.[pageNum]?.misri_quran || quranData?.[pageNum]?.image_base64 || "";
              
              return (
                <div className="flex flex-col items-center space-y-2 select-none">
                  <span className="text-slate-300 font-bold font-mono text-xs bg-slate-950/80 border border-slate-800 px-3 py-1 rounded-full">
                    Page {pageNum} ({safeIndex + 1} of {safePageList.length})
                  </span>
                  {loadingJson ? (
                    <div className="flex items-center gap-2 text-gold-400 text-xs font-bold animate-pulse py-12">
                      <RefreshCw className="w-4 h-4 animate-spin text-gold-400" />
                      <span>Loading page...</span>
                    </div>
                  ) : imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={`Enlarged Quran Page ${pageNum}`}
                      className="max-h-[82vh] max-w-full object-contain rounded-lg shadow-2xl border border-slate-800 cursor-default animate-scaleIn"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="text-slate-500 text-xs font-semibold py-12 flex flex-col items-center gap-2">
                      <span>Manuscript page not found for Page {pageNum}.</span>
                      <span className="text-[10px] text-slate-600">Please check your manuscript database.</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
