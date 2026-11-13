import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Printer,
  Filter,
  RefreshCw,
  QrCode,
  School,
  Phone,
  User,
} from 'lucide-react';

export default function QrIdCards() {
  const [cards, setCards] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/classes');
        setClasses(res.data);
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    };
    fetchClasses();
  }, []);

  // Fetch printable cards
  const fetchCards = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedClass) params.classId = selectedClass;

      const res = await api.get('/students/cards', { params });
      setCards(res.data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to generate printable cards.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [selectedClass]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Non-printable Controls Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Printable Student QR ID Cards</h1>
          <p className="text-xs text-slate-500 mt-1">
            Print laminated identification cards with cryptographic QR tokens for rural student roll calls
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <Filter size={15} className="text-slate-400" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Classes ({cards.length} cards)</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}-{cls.section}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handlePrint}
            disabled={loading || cards.length === 0}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-xs disabled:opacity-50 transition"
          >
            <Printer size={15} />
            <span>Print All ({cards.length}) Cards</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center no-print">
          <RefreshCw className="animate-spin h-6 w-6 text-sky-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Generating printable QR ID cards...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-red-600 text-xs no-print">{error}</div>
      ) : cards.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs no-print">
          No students found to generate cards for.
        </div>
      ) : (
        /* Printable Area */
        <div id="printable-area" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => (
            <div
              key={card.id}
              className="p-5 rounded-2xl bg-white border-2 border-slate-300 shadow-sm flex flex-col justify-between break-inside-avoid relative overflow-hidden text-slate-800"
              style={{ minHeight: '260px' }}
            >
              {/* Header */}
              <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-900 text-white font-bold flex items-center justify-center text-xs">
                    ST
                  </div>
                  <div>
                    <h3 className="text-[11px] font-bold text-slate-900 uppercase leading-none">
                      {card.schoolName}
                    </h3>
                    <span className="text-[9px] text-slate-500 block mt-0.5">
                      Govt. of Rajasthan &bull; Code: {card.schoolCode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Body: Info + QR Code */}
              <div className="py-3 flex items-center justify-between gap-3">
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">
                      Student Name
                    </span>
                    <strong className="text-sm font-extrabold text-slate-900 leading-tight block">
                      {card.name}
                    </strong>
                  </div>

                  <div className="flex space-x-3 text-[11px]">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-medium">Class</span>
                      <strong className="text-slate-800 font-bold">{card.className}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-medium">Roll No</span>
                      <strong className="text-slate-800 font-bold">{card.rollNumber || '-'}</strong>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 block font-medium">Admission No</span>
                    <strong className="font-mono text-xs text-sky-800 font-bold">
                      {card.admissionNumber}
                    </strong>
                  </div>

                  {card.guardianPhone && (
                    <div className="text-[10px] text-slate-500 flex items-center space-x-1 pt-0.5">
                      <Phone size={10} className="text-slate-400" />
                      <span>{card.guardianPhone}</span>
                    </div>
                  )}
                </div>

                {/* QR Code */}
                <div className="shrink-0 p-1.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <img src={card.qrDataUrl} alt="QR Code" className="w-24 h-24 object-contain" />
                  <span className="text-[8px] font-mono text-slate-400 block mt-0.5">
                    {card.qrToken.slice(0, 11)}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[9px] text-slate-400">
                <span>Academic Year: {card.academicYear}</span>
                <span className="font-semibold text-slate-500">ShikshaTrack Verified</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

