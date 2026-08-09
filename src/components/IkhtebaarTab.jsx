import React, { useState, useEffect, useRef } from 'react';
import { Award, HelpCircle, ChevronDown, ChevronUp, Mic, MicOff, RefreshCw, CheckCircle2, AlertCircle, Sparkles, Zap, Shield, Flame, BookOpen } from 'lucide-react';
import { getJuzPageRange, JUZ_LIST, SURAH_LIST } from '../utils/juzMapping';
import { BatchAudioRecorder } from '../utils/audioRecorder';
import { AudioVisualizer } from './AudioVisualizer';

export const IkhtebaarTab = () => {
  // Config States
  const [rangeMode, setRangeMode] = useState('juz'); // 'juz' | 'page' | 'surah'
  const [selectedJuz, setSelectedJuz] = useState(1);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(21);
  const [startSurah, setStartSurah] = useState(1);
  const [endSurah, setEndSurah] = useState(1);
  const [difficulty, setDifficulty] = useState('medium'); // 'easy' | 'medium' | 'hard'

  // Exam Question State
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [excludedQuestions, setExcludedQuestions] = useState([]);

  // Accordion Hint Toggles
  const [activeHint, setActiveHint] = useState(null); // 'hint_1' | 'hint_2' | 'hint_3' | null

  // Batch Recording States
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFinalizingStream, setIsFinalizingStream] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [analyserNode, setAnalyserNode] = useState(null);

  // Grade Evaluation Result
  const [gradeResult, setGradeResult] = useState(null);

  const recorderRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Apply exact Juz mapping math whenever Juz changes
  useEffect(() => {
    if (rangeMode === 'juz') {
      const range = getJuzPageRange(selectedJuz);
      setFromPage(range.startPage);
      setToPage(range.endPage);
    }
  }, [selectedJuz, rangeMode]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (recorderRef.current) recorderRef.current.cleanup();
    };
  }, []);

  // Fetch AI Question from /api/generate_ikhtebaar
  const generateQuestion = async () => {
    setLoadingQuestion(true);
    setQuestionError('');
    setGradeResult(null);
    setActiveHint(null);

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
      const data = await res.json();

      if (data.error) {
        setQuestionError(data.error);
        setCurrentQuestion(null);
      } else {
        setCurrentQuestion(data);
        if (data.question_id) {
          setExcludedQuestions(prev => [...prev, data.question_id]);
        }
      }
    } catch (err) {
      console.error("Generate Ikhtebaar error:", err);
      setQuestionError("Failed to fetch exam question from server.");
    } finally {
      setLoadingQuestion(false);
    }
  };

  // 1. INITIATE RECITATION (Batch Mode)
  const initiateRecitation = async () => {
    if (!currentQuestion) {
      alert("Please generate an exam question first.");
      return;
    }

    try {
      setIsStartingRecording(true);
      const recorder = new BatchAudioRecorder();
      recorderRef.current = recorder;

      await recorder.startRecording();
      setAnalyserNode(recorder.getAnalyser());
      setIsRecording(true);
      setGradeResult(null);
      setElapsedSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      alert(err.message || "Failed to start microphone recording.");
    } finally {
      setIsStartingRecording(false);
    }
  };

  // 2. CONCLUDE RECITATION & SEND AUDIO BLOB TO /transcribe_and_compare
  const concludeRecitation = async () => {
    if (!recorderRef.current || !isRecording) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    try {
      setIsRecording(false);
      setIsFinalizingStream(true);
      setAnalysisStage("Flushing audio stream buffer...");

      // 450ms audio tail buffer delay to ensure final spoken words are captured into PCM stream
      await new Promise(r => setTimeout(r, 450));

      setIsFinalizingStream(false);
      setIsAnalyzing(true);
      setAnalysisProgress(10);
      setAnalysisStage("Decoding 16kHz PCM Audio Stream...");

      // Stop recorder and encode 16kHz PCM WAV Audio Blob
      const audioBlob = await recorderRef.current.stopRecording();

      // Start progress bar animation for AI evaluation pipeline
      let currentProg = 15;
      const progressInterval = setInterval(() => {
        currentProg += Math.floor(Math.random() * 8) + 5;
        if (currentProg >= 92) {
          currentProg = 92;
        }
        setAnalysisProgress(currentProg);

        if (currentProg < 35) {
          setAnalysisStage("Analyzing Audio Recitation...");
        } else if (currentProg < 75) {
          setAnalysisStage("Academic Neural Evaluation...");
        } else if (currentProg < 92) {
          setAnalysisStage("Verse Alignment & Assessment...");
        }
      }, 300);

      const startVal = rangeMode === 'juz' ? selectedJuz : rangeMode === 'page' ? fromPage : startSurah;
      const endVal = rangeMode === 'juz' ? selectedJuz : rangeMode === 'page' ? toPage : endSurah;

      const formData = new FormData();
      formData.append('file', audioBlob, 'ikhtebaar_recitation.wav');
      formData.append('expected_text', currentQuestion.expected_full_text);
      formData.append('module_type', 'ikhtebaar');
      formData.append('range_mode', rangeMode);
      formData.append('start_val', startVal.toString());
      formData.append('end_val', endVal.toString());

      const response = await fetch('/transcribe_and_compare', {
        method: 'POST',
        body: formData,
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
    } catch (err) {
      console.error("Exam evaluation error:", err);
      alert("Failed to grade exam recitation: " + err.message);
    } finally {
      setIsAnalyzing(false);
      setIsFinalizingStream(false);
      setAnalyserNode(null);
      setAnalysisProgress(0);
      setAnalysisStage('');
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

        {/* Dynamic Controls */}
        <div className="flex flex-wrap items-center gap-6">
          {rangeMode === 'juz' && (
            <div className="flex items-center gap-4 flex-1 min-w-[280px]">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Select Juz Module:
                </label>
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
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Calculated Range</span>
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
            <label className="block text-xs font-semibold text-slate-400 mb-1">Exam Difficulty:</label>
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setDifficulty('easy')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  difficulty === 'easy' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" /> Easy
              </button>
              <button
                onClick={() => setDifficulty('medium')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  difficulty === 'medium' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> Medium
              </button>
              <button
                onClick={() => setDifficulty('hard')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  difficulty === 'hard' ? 'bg-red-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5" /> Hard
              </button>
            </div>
          </div>

          {/* Generate Question Button */}
          <button
            onClick={generateQuestion}
            disabled={loadingQuestion}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-gold-glow transition-all disabled:opacity-50 ml-auto"
          >
            {loadingQuestion ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Generate Exam Question</span>
          </button>
        </div>
      </div>

      {/* 2. Main Exam Question & Recitation Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Panel: Question Boundaries & Accordion Hints */}
        <div className="glass-panel rounded-2xl p-6 border border-gold-500/20 shadow-xl space-y-5">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-gold-400" /> Exam Question Prompt
            </h3>
            {currentQuestion && (
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                Page {currentQuestion.page_number}
              </span>
            )}
          </div>

          {loadingQuestion ? (
            <div className="py-12 text-center text-gold-400 text-xs font-semibold flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span>Analyzing database & generating non-repeating exam question...</span>
            </div>
          ) : questionError ? (
            <div className="p-6 text-center text-red-400 text-xs font-semibold space-y-2 bg-red-950/30 rounded-xl border border-red-800/40">
              <AlertCircle className="w-6 h-6 mx-auto" />
              <p>{questionError}</p>
            </div>
          ) : currentQuestion ? (
            <div className="space-y-6">
              {/* Start Ayah Prompt */}
              <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                  🟢 Recitation Starting Ayah (Start Prompt):
                </span>
                <p dir="rtl" className="font-arabic text-2xl text-amber-100 leading-loose text-right">
                  {currentQuestion.start_text}
                </p>
              </div>

              {/* Stop Ayah Prompt */}
              <div className="p-5 rounded-2xl bg-red-950/30 border border-red-500/30 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 block">
                  🛑 Recitation Termination Ayah (Stop Target):
                </span>
                <p dir="rtl" className="font-arabic text-2xl text-amber-100 leading-loose text-right">
                  {currentQuestion.stop_text}
                </p>
              </div>

              {/* Progressive Hints Accordion */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-gold-400" /> Progressive Exam Hints (Optional)
                </h4>

                {/* Hint 1 */}
                <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                  <button
                    onClick={() => setActiveHint(activeHint === 'hint_1' ? null : 'hint_1')}
                    className="w-full p-3 text-left text-xs font-semibold text-slate-300 flex items-center justify-between hover:bg-slate-900 transition-all"
                  >
                    <span>Hint 1: First Ayah on Page {currentQuestion.page_number}</span>
                    {activeHint === 'hint_1' ? <ChevronUp className="w-4 h-4 text-gold-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {activeHint === 'hint_1' && (
                    <div dir="rtl" className="p-4 border-t border-slate-800 text-right font-arabic text-xl text-amber-200 bg-slate-900/60">
                      {currentQuestion.hint_1}
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
                      {currentQuestion.hint_2}
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
                      {currentQuestion.hint_3}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs font-semibold space-y-2">
              <HelpCircle className="w-8 h-8 mx-auto text-slate-500" />
              <p>Click "Generate Exam Question" above to start an oral examination test.</p>
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
                <span className="font-mono text-xs font-bold text-red-400 bg-red-950 px-2 py-0.5 rounded border border-red-800 animate-pulse">
                  REC: {formatTime(elapsedSeconds)}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Click <strong>"Initiate Recitation"</strong>, recite from the Start Ayah to Stop Ayah uninterrupted, then click <strong>"Conclude Recitation"</strong> to submit audio.
            </p>
          </div>

          {/* Live Audio Visualizer */}
          <AudioVisualizer analyser={analyserNode} isRecording={isRecording} className="h-28" />

          {/* Action Buttons & Animated AI Pipeline Indicator */}
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
                  <span>Capturing Final Spoken Words (Audio Tail Buffer)...</span>
                </div>
              </div>
            ) : isAnalyzing ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-gold-500/40 shadow-gold-glow space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gold-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-spin-slow" /> AI Examination Pipeline
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
              <button
                onClick={initiateRecitation}
                disabled={!currentQuestion}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40"
              >
                <Mic className="w-5 h-5" />
                <span>Initiate Recitation</span>
              </button>
            ) : (
              <button
                onClick={concludeRecitation}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 animate-pulse transition-all"
              >
                <MicOff className="w-5 h-5" />
                <span>Conclude Recitation & Grade Exam</span>
              </button>
            )}
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

          {/* Recognized Speech Output Banner */}
          {gradeResult.user_transcription && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recognized Recitation Output:</span>
              <p dir="rtl" className="font-arabic text-lg text-amber-200 text-right">{gradeResult.user_transcription}</p>
            </div>
          )}

          {/* Word-by-Word Color-Coded Comparison */}
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
    </div>
  );
};
