import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  BrainCircuit,
  Sparkles,
  Send,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  MessageSquare,
  Bot,
  User,
  RefreshCw,
  Lightbulb,
} from 'lucide-react';

export default function AiInsights() {
  const [insightsData, setInsightsData] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Ask ShikshaTrack Chat State
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([
    {
      sender: 'bot',
      text: "Namaste! I am your ShikshaTrack AI Assistant. You can ask me natural language questions about student attendance, classes with declining participation, low-attendance alerts (< 75%), or today's Mid-Day Meal counts.",
    },
  ]);
  const [asking, setAsking] = useState(false);

  const fetchAiData = async () => {
    try {
      setLoading(true);
      const [insightsRes, anomaliesRes] = await Promise.all([
        api.get('/ai/insights'),
        api.get('/analytics/anomalies'),
      ]);
      setInsightsData(insightsRes.data);
      setAnomalies(anomaliesRes.data);
    } catch (err) {
      console.error('Failed to load AI data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAiData();
  }, []);

  const handleAskSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || asking) return;

    const userText = query.trim();
    setQuery('');
    setChatHistory((prev) => [...prev, { sender: 'user', text: userText }]);
    setAsking(true);

    try {
      const res = await api.post('/ai/ask', { query: userText });
      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: res.data.answer,
          intent: res.data.intent,
          data: res.data.data,
        },
      ]);
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `Apologies, I encountered an issue querying the database: ${err.message}`,
        },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const handleChipClick = (sampleQuery) => {
    setQuery(sampleQuery);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-sky-950 via-slate-900 to-indigo-950 text-white shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold uppercase tracking-wider mb-2 border border-sky-400/30">
            <Sparkles size={12} className="text-sky-300" />
            <span>AI Analytical Engine</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">AI Insights & Natural Language Assistant</h1>
          <p className="text-xs text-sky-200 mt-1">
            Aggregated intelligence, verified database natural querying, and statistical anomaly detection
          </p>
        </div>
        <button
          onClick={fetchAiData}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw size={14} />
          <span>Regenerate Insights</span>
        </button>
      </div>

      {/* FEATURE B: Ask ShikshaTrack Natural Language Interface */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Bot size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Ask ShikshaTrack</h2>
              <p className="text-[11px] text-slate-400">
                Natural-language to verified database query mapping (strictly non-destructive)
              </p>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            Safe Query Engine Active
          </span>
        </div>

        {/* Chat History Box */}
        <div className="h-64 overflow-y-auto space-y-3 p-3 bg-slate-50/70 rounded-xl border border-slate-200/60 text-xs">
          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start space-x-2 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'bot' && (
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 text-[10px] font-bold">
                  AI
                </div>
              )}
              <div
                className={`max-w-[80%] p-3 rounded-2xl leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-sky-600 text-white rounded-tr-none'
                    : 'bg-white border border-slate-200/80 text-slate-800 shadow-2xs rounded-tl-none'
                }`}
              >
                <p className="font-medium whitespace-pre-wrap">{msg.text}</p>
                {msg.intent && (
                  <span className="inline-block mt-1 text-[9px] font-mono text-slate-400">
                    Intent: {msg.intent}
                  </span>
                )}
              </div>
            </div>
          ))}
          {asking && (
            <div className="flex items-center space-x-2 text-xs text-slate-400 pl-8">
              <RefreshCw size={14} className="animate-spin text-sky-600" />
              <span>Interpreting intent and querying PostgreSQL...</span>
            </div>
          )}
        </div>

        {/* Sample Question Chips */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Suggested Administrative Queries:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Which students have attendance below 75%?',
              'Which class had the highest attendance this month?',
              'How many students were absent today?',
              'Compare this month attendance with last month',
              'What is today Mid-Day Meal headcount?',
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleChipClick(q)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-600 text-[11px] font-medium transition text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Query Input */}
        <form onSubmit={handleAskSubmit} className="flex gap-2 pt-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question in plain English (e.g. 'How many students were absent today?')..."
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="submit"
            disabled={!query.trim() || asking}
            className="flex items-center space-x-1.5 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-xs disabled:opacity-40 transition"
          >
            <Send size={14} />
            <span>Send</span>
          </button>
        </form>
      </div>

      {/* FEATURE A: AI Attendance Insights Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Lightbulb size={18} className="text-amber-500" />
            <span>Automated Attendance Observations & Action Items</span>
          </h2>
          <span className="text-[10px] text-slate-400 font-mono">
            Mode: {insightsData?.provider || 'Active'}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <RefreshCw className="animate-spin h-6 w-6 text-sky-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Synthesizing insights...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insightsData?.insights?.map((item, index) => (
              <div
                key={index}
                className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-start space-x-3.5"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    item.category === 'POSITIVE_TREND' || item.category === 'TOP_PERFORMER'
                      ? 'bg-emerald-50 text-emerald-600'
                      : item.category === 'CLASS_DECLINE' || item.category === 'ATTENTION_NEEDED'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-indigo-50 text-indigo-600'
                  }`}
                >
                  {item.category === 'POSITIVE_TREND' || item.category === 'TOP_PERFORMER' ? (
                    <TrendingUp size={20} />
                  ) : item.category === 'CLASS_DECLINE' ? (
                    <TrendingDown size={20} />
                  ) : (
                    <AlertTriangle size={20} />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FEATURE D: Statistical Anomaly Detection Section */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <ShieldAlert size={18} className="text-rose-600" />
            <span>Attendance Anomaly Detection (Statistical Rules)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Algorithmic identification of repeated weekday absence clusters and sudden attendance decline
          </p>
        </div>

        {anomalies.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No anomalous absence patterns flagged in recent sessions.
          </p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Class</th>
                  <th className="py-2.5 px-4">Pattern Flagged</th>
                  <th className="py-2.5 px-4">Severity</th>
                  <th className="py-2.5 px-4">Administrative Action Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {anomalies.map((anom, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{anom.studentName}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{anom.className}</td>
                    <td className="py-3 px-4 text-slate-800">{anom.description}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          anom.severity === 'HIGH'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {anom.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-[11px] italic">
                      {anom.suggestedAction}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

