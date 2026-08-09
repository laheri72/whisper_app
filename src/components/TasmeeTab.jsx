import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Play, CheckCircle2, AlertCircle, Eye, EyeOff, Layers, RefreshCw, Award, FileText, Sparkles } from 'lucide-react';
import { getJuzPageRange, JUZ_LIST, SURAH_LIST } from '../utils/juzMapping';
import { BatchAudioRecorder } from '../utils/audioRecorder';
import { AudioVisualizer } from './AudioVisualizer';

export const TasmeeTab = () => {
  // Config States
  const [rangeMode, setRangeMode] = useState('juz'); // 'juz' | 'page' | 'surah'
  const [selectedJuz, setSelectedJuz] = useState(1);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(21);
  const [startSurah, setStartSurah] = useState(1);
  const [endSurah, setEndSurah] = useState(1);

  // Target Text & State
  const [expectedText, setExpectedText] = useState('');
  const [loadingText, setLoadingText] = useState(false);
  const [hideTargetText, setHideTargetText] = useState(false);
  const [textError, setTextError] = useState('');

  // Batch Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [analyserNode, setAnalyserNode] = useState(null);

  // AI Grading Results State
  const [evaluationResult, setEvaluationResult] = useState(null);

  const recorderRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Whenever Juz selection changes, apply exact math formula
  useEffect(() => {
    if (rangeMode === 'juz') {
      const range = getJuzPageRange(selectedJuz);
      setFromPage(range.startPage);
      setToPage(range.endPage);
    }
  }, [selectedJuz, rangeMode]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (recorderRef.current) recorderRef.current.cleanup();
    };
  }, []);

  // Fetch Reference Target Text from backend /api/tasmee_target
  const fetchTasmeeTarget = async () => {
    setLoadingText(true);
    setTextError('');
    setEvaluationResult(null);

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

    try {
      const res = await fetch(`/api/tasmee_target?mode=${modeParam}&start_val=${startVal}&end_val=${endVal}`);
      const data = await res.json();

      if (data.error) {
        setTextError(data.error);
        setExpectedText('');
      } else {
        setExpectedText(data.expected_text || '');
      }
    } catch (err) {
      console.error("Tasmee target fetch error:", err);
      setTextError("Failed to connect to backend server.");
    } finally {
      setLoadingText(false);
    }
  };

  // 1. INITIATE RECITATION (Batch Mode)
  const initiateRecitation = async () => {
    if (!expectedText) {
      alert("Please fetch target recitation text before initiating audio recording.");
      return;
    }

    try {
      const recorder = new BatchAudioRecorder();
      recorderRef.current = recorder;

      await recorder.startRecording();
      setAnalyserNode(recorder.getAnalyser());
      setIsRecording(true);
      setEvaluationResult(null);
      setElapsedSeconds(0);

      // Start live timer
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      alert(err.message || "Failed to start microphone recording.");
    }
  };

  // 2. CONCLUDE RECITATION & SEND ENTIRE AUDIO BLOB TO BACKEND /transcribe_and_compare
  const concludeRecitation = async () => {
    if (!recorderRef.current || !isRecording) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    try {
      setIsRecording(false);
      setIsAnalyzing(true);

      // Stop recorder and get single batch Audio Blob
      const audioBlob = await recorderRef.current.stopRecording();

      // Construct FormData payload for /transcribe_and_compare
      const formData = new FormData();
      formData.append('file', audioBlob, 'tasmee_recitation.wav');
      formData.append('expected_text', expectedText);

      // Send to backend endpoint
      const response = await fetch('/transcribe_and_compare', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP status ${response.status}`);
      }

      const resultData = await response.json();
      setEvaluationResult(resultData);
    } catch (err) {
      console.error("Recitation evaluation error:", err);
      alert("Failed to grade recitation: " + err.message);
    } finally {
      setIsAnalyzing(false);
      setAnalyserNode(null);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Metrics summary
  const matchCount = evaluationResult?.comparison?.filter(c => c.status === 'match').length || 0;
  const mistakeCount = evaluationResult?.comparison?.filter(c => c.status === 'mistake').length || 0;
  const totalWords = evaluationResult?.comparison?.length || 0;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Range Configuration Card */}
      <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/30 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-gold-400" /> Select Recitation Range
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose Juz Module or custom page/surah parameters for memorization testing
            </p>
          </div>

          {/* Mode Tabs */}
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

        {/* Dynamic Inputs based on mode */}
        <div className="flex flex-wrap items-center gap-6">
          {rangeMode === 'juz' && (
            <div className="flex items-center gap-4 flex-1 min-w-[280px]">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Select Juz Module (1 to 30):
                </label>
                <select
                  value={selectedJuz}
                  onChange={(e) => setSelectedJuz(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 text-gold-300 font-bold text-sm rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-amber-500"
                >
                  {JUZ_LIST.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.displayLabel}
                    </option>
                  ))}
                </select>
              </div>

              {/* Exact Math Display Badge */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-gold-500/30 text-center">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Calculated Range</span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  Page {fromPage} → {toPage}
                </span>
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

          {/* Fetch Target Text Button */}
          <button
            onClick={fetchTasmeeTarget}
            disabled={loadingText}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-gold-glow transition-all disabled:opacity-50 ml-auto"
          >
            {loadingText ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            <span>Fetch Reference Text</span>
          </button>
        </div>
      </div>

      {/* 2. Target Text & Audio Recording Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Reference Text Container */}
        <div className="glass-panel rounded-2xl p-6 border border-gold-500/20 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-gold-400" /> Target Quran Text for Recitation
            </h3>
            {expectedText && (
              <button
                onClick={() => setHideTargetText(!hideTargetText)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 text-xs font-semibold text-slate-300 border border-slate-700 hover:border-gold-500/40 transition-all"
              >
                {hideTargetText ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-amber-400" /> Reveal Text
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-slate-400" /> Hide (Memory Test)
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex-1 min-h-[220px] flex items-center justify-center p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            {loadingText ? (
              <div className="flex items-center gap-2 text-gold-400 text-xs font-semibold">
                <RefreshCw className="w-4 h-4 animate-spin" /> Fetching target text from database...
              </div>
            ) : textError ? (
              <div className="text-center text-red-400 text-xs font-semibold space-y-1">
                <AlertCircle className="w-6 h-6 mx-auto" />
                <p>{textError}</p>
              </div>
            ) : expectedText ? (
              <div className={`w-full text-right leading-loose font-arabic text-2xl p-2 transition-all ${
                hideTargetText ? 'filter blur-md select-none opacity-40' : 'text-amber-100'
              }`}>
                {expectedText}
              </div>
            ) : (
              <div className="text-center text-slate-400 text-xs space-y-1">
                <p>Click "Fetch Reference Text" above to load the expected Quran passage for recitation.</p>
              </div>
            )}
          </div>

          {expectedText && (
            <div className="text-xs text-slate-400 flex items-center justify-between px-1">
              <span>Passage Length: <strong className="text-gold-300">{expectedText.split(' ').length}</strong> words</span>
              <span className="text-emerald-400 font-medium">Ready for Batch Recitation</span>
            </div>
          )}
        </div>

        {/* Right Card: Batch Recording & Audio Controls */}
        <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/30 shadow-xl flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Mic className="w-4 h-4 text-gold-400" /> Batch Recitation Controls
              </h3>
              {isRecording && (
                <span className="font-mono text-xs font-bold text-red-400 bg-red-950 px-2 py-0.5 rounded border border-red-800 animate-pulse">
                  REC: {formatTime(elapsedSeconds)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Click <strong>"Initiate Recitation"</strong>, recite the entire passage uninterrupted, and click <strong>"Conclude Recitation"</strong> to submit audio.
            </p>
          </div>

          {/* Live Audio Visualizer */}
          <AudioVisualizer analyser={analyserNode} isRecording={isRecording} className="h-28" />

          {/* Batch Controls Action Buttons */}
          <div className="space-y-3">
            {!isRecording && !isAnalyzing ? (
              <button
                onClick={initiateRecitation}
                disabled={!expectedText}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40"
              >
                <Mic className="w-5 h-5" />
                <span>Initiate Recitation</span>
              </button>
            ) : isRecording ? (
              <button
                onClick={concludeRecitation}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 animate-pulse transition-all"
              >
                <MicOff className="w-5 h-5" />
                <span>Conclude Recitation & Grade</span>
              </button>
            ) : (
              <div className="py-4 rounded-xl bg-slate-900 border border-gold-500/40 text-center text-gold-300 text-xs font-semibold flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-gold-400" />
                <span>Analyzing audio with Whisper AI...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. AI Evaluation & Grade Report Card */}
      {evaluationResult && (
        <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/40 shadow-2xl space-y-6 animate-fadeIn">
          {/* Grade Summary Header */}
          <div className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-extrabold text-2xl flex items-center justify-center shadow-gold-glow">
                {evaluationResult.score}%
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-100">Recitation Assessment Score</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    evaluationResult.score >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {evaluationResult.score >= 90 ? 'Excellent Recitation' : evaluationResult.score >= 75 ? 'Good Recitation' : 'Needs Practice'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Batch audio transcribed and verified against Uthmani text standard.
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
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

          {/* Word-by-Word Color-Coded Comparison */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Word-by-Word Analysis (Green = Match, Red = Mistake)</span>
              <span className="text-gold-400 font-arabic text-sm">التدقيق الحرفي</span>
            </h4>

            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap flex-row-reverse gap-3 text-right leading-loose font-arabic text-2xl">
              {evaluationResult.comparison?.map((item, idx) => {
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
