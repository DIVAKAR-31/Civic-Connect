import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  MapPin,
  Send,
  Loader2,
  CheckCircle2,
  Sparkles,
  Mic,
  MicOff,
  AlertTriangle,
  Trash2,
  BrainCircuit,
  AlertCircle,
  ShieldAlert,
  FileCheck,
} from 'lucide-react';
import { AIAnalyzeResponse, Grievance, IssueCategory, IssuePriority, Location } from '../types';
import { aiService } from '../services/geminiService';
import { apiClient } from '../services/apiClient';
import LiveTrackingMap from '../components/LiveTrackingMap';

interface ReportPageProps {
  onAdded?: (g: Grievance) => void;
  embedded?: boolean;
  onDoneRedirect?: () => void;
}

const CATEGORIES = [
  IssueCategory.POTHOLE,
  IssueCategory.ROAD_DAMAGE,
  IssueCategory.GARBAGE,
  IssueCategory.STREET_LIGHT,
  IssueCategory.WATER,
  IssueCategory.WATER_CONTAMINATION,
  IssueCategory.DRAINAGE,
  IssueCategory.SANITATION,
  IssueCategory.SEWAGE_OVERFLOW,
  IssueCategory.WATER_LOGGING,
  IssueCategory.OPEN_MANHOLE,
  IssueCategory.EXPOSED_WIRES,
  IssueCategory.HANGING_CABLES,
  IssueCategory.TREE_FALLEN,
  IssueCategory.STRAY_ANIMALS,
  IssueCategory.TRAFFIC_SIGNAL,
  IssueCategory.NOISE_POLLUTION,
  IssueCategory.OTHERS,
];

const ReportPage: React.FC<ReportPageProps> = ({ onAdded, embedded = false, onDoneRedirect }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Auto');
  const [priority, setPriority] = useState<string>('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [locationMode, setLocationMode] = useState<'map' | 'manual'>('map');
  const [mapLocation, setMapLocation] = useState<Location | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [manualArea, setManualArea] = useState('');
  const [manualVillage, setManualVillage] = useState('');
  const [manualTaluk, setManualTaluk] = useState('');
  const [manualDistrict, setManualDistrict] = useState('Chennai');

  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalyzeResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdComplaint, setCreatedComplaint] = useState<Grievance | null>(null);

  const buildEffectiveLocation = (): Location | null => {
    if (locationMode === 'map' && mapLocation) {
      return {
        ...mapLocation,
        address: manualAddress.trim() || mapLocation.address,
        area: manualArea.trim() || mapLocation.area || 'Municipal Ward',
        village: manualVillage.trim() || mapLocation.village || mapLocation.area || '',
        taluk: manualTaluk.trim() || mapLocation.taluk || '',
        district: manualDistrict.trim() || mapLocation.district || 'Chennai',
      };
    }
    if (manualAddress.trim() && manualDistrict.trim()) {
      return {
        latitude: mapLocation?.latitude || 13.0827,
        longitude: mapLocation?.longitude || 80.2707,
        address: manualAddress.trim(),
        area: manualArea.trim() || manualVillage.trim() || manualDistrict.trim(),
        village: manualVillage.trim() || manualArea.trim() || '',
        taluk: manualTaluk.trim() || '',
        district: manualDistrict.trim(),
      };
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      setError('Voice input is not supported in this browser.');
      return;
    }
    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.start();
  };

  const handleRunAI = async () => {
    setError(null);
    if (description.trim().length < 10) {
      setError('Please enter at least 10 characters in the issue description to run AI analysis.');
      return;
    }
    setAnalyzing(true);
    try {
      const res = await aiService.analyzeComplaint({
        title,
        description,
        category: category === 'Auto' ? '' : category,
        location: buildEffectiveLocation(),
      });
      setAiResult(res);
      if (category === 'Auto') {
        setCategory(res.category);
      }
      if (!priority) {
        setPriority(res.priority);
      }
    } catch (err: any) {
      setError(err.message || 'AI analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (description.trim().length < 10) {
      setError('Please describe the civic issue in at least 10 characters.');
      return;
    }

    const loc = buildEffectiveLocation();
    if (!loc) {
      setError('Please pick a location on the map / GPS or enter a street address & district manually.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.createComplaint({
        title: title.trim(),
        category,
        priority: priority || undefined,
        description: description.trim(),
        image: image || undefined,
        location: loc,
        isAnonymous,
        isEmergency,
      });
      setCreatedComplaint(res.complaint);
      onAdded?.(res.complaint);
    } catch (err: any) {
      setError(err.message || 'Failed to submit complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdComplaint) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 animate-fadeIn">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-10 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-900">
            Complaint Registered Successfully
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            Your issue has been saved to the CivicConnect ledger, prioritized by AI, and routed to the{' '}
            <strong>{createdComplaint.currentTier}</strong>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-7 text-left">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Unique Tracking ID
              </span>
              <span className="text-2xl font-extrabold text-navy-900 font-mono">{createdComplaint.id}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                AI Priority & Department
              </span>
              <span className="text-sm font-bold text-teal-700 block mt-1">
                {createdComplaint.priority} • {createdComplaint.assignedDepartment}
              </span>
            </div>
            <div className="sm:col-span-2 bg-navy-900 text-white rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
                  AI Triage Summary
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-200">
                  {createdComplaint.aiMode === 'live-ai' ? 'Live Gemini AI' : 'Demo AI Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{createdComplaint.aiSummary}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => navigate(`/track?id=${encodeURIComponent(createdComplaint.id)}`)}
              className="flex-1 py-3.5 bg-navy-900 hover:bg-teal-600 text-white rounded-xl font-bold text-sm transition-colors"
            >
              View Live Timeline
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatedComplaint(null);
                setTitle('');
                setDescription('');
                setImage('');
                setAiResult(null);
                if (onDoneRedirect) onDoneRedirect();
              }}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-navy-900 rounded-xl font-bold text-sm transition-colors"
            >
              {onDoneRedirect ? 'Back to My Complaints' : 'Report Another Issue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fadeIn'}>
      {!embedded && (
        <div className="mb-8">
          <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Citizen Grievance Form</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 mt-1">Report a Civic Issue</h1>
          <p className="text-sm text-slate-600 mt-1">
            Provide issue details, photo evidence, and location. AI assists with categorization, priority, and duplicate checks.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-8">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}

        {/* Section 1: Issue Details & AI Analysis */}
        <div className="space-y-5">
          <h2 className="text-base font-bold text-navy-900 border-b border-slate-100 pb-2">
            1. Issue Description & Category
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Complaint Title <span className="text-slate-400 font-normal">(optional — auto-filled if blank)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Deep pothole near Main Market junction"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Issue Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white outline-none text-sm"
              >
                <option value="Auto">Auto-Detect via AI Analysis</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Detailed Description <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={startListening}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  isListening ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700'
                }`}
              >
                {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                {isListening ? 'Listening...' : 'Voice Input'}
              </button>
            </div>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the exact problem, severity, nearby landmark, and how long it has persisted..."
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 focus:bg-white outline-none text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRunAI}
              disabled={analyzing || description.trim().length < 10}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-teal-600 disabled:opacity-50 text-white text-xs font-bold transition-colors"
            >
              {analyzing ? <Loader2 size={15} className="animate-spin" /> : <BrainCircuit size={15} />}
              {analyzing ? 'Running AI Analysis...' : 'Analyze with AI (Category, Priority & Duplicates)'}
            </button>

            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-rose-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <ShieldAlert size={14} /> Mark as Life-Safety Emergency
              </label>
            </div>
          </div>

          {aiResult && (
            <div className="bg-slate-50 border border-teal-200 rounded-2xl p-5 space-y-3 animate-slideUp">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-navy-900">
                  <Sparkles size={15} className="text-teal-600" /> AI Complaint Analysis
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    aiResult.mode === 'live-ai'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {aiResult.modeLabel}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block">Detected Category</span>
                  <strong className="text-navy-900">{aiResult.category}</strong>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block">Priority Level</span>
                  <strong className="text-teal-700">{isEmergency ? IssuePriority.CRITICAL : aiResult.priority}</strong>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block">Suggested Department</span>
                  <strong className="text-navy-900">{aiResult.department}</strong>
                </div>
              </div>

              <p className="text-xs text-slate-700">
                <strong>AI Summary:</strong> {aiResult.summary}
              </p>

              {aiResult.duplicateCheck?.isDuplicate && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-bold">Potential Duplicate Detected</p>
                    <p>{aiResult.duplicateCheck.reasoning}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 2: Photo Evidence */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-navy-900 border-b border-slate-100 pb-2">
            2. Upload Issue Photograph
          </h2>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-64 h-40 rounded-2xl border-2 border-dashed border-slate-300 hover:border-teal-500 bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-teal-700 transition-colors overflow-hidden"
            >
              {image ? (
                <img src={image} alt="Uploaded civic issue" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Camera size={28} />
                  <span className="text-xs font-bold">Upload PNG / JPG (max 5 MB)</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </button>

            <div className="space-y-2 text-xs text-slate-600">
              <p className="font-semibold text-navy-900">Why attach a photograph?</p>
              <p>Images are securely stored on the server and displayed to the Village/City President, Taluk Officer, and Admin for faster verification.</p>
              {image && (
                <button
                  type="button"
                  onClick={() => setImage('')}
                  className="inline-flex items-center gap-1.5 text-red-600 font-bold hover:underline pt-1"
                >
                  <Trash2 size={14} /> Remove Image
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Location (GPS / Map OR Manual Entry) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2">
            <h2 className="text-base font-bold text-navy-900">3. Location (GPS Map or Manual Entry)</h2>
            <div className="inline-flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setLocationMode('map')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  locationMode === 'map' ? 'bg-navy-900 text-white' : 'text-slate-600'
                }`}
              >
                GPS & Interactive Map
              </button>
              <button
                type="button"
                onClick={() => setLocationMode('manual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  locationMode === 'manual' ? 'bg-navy-900 text-white' : 'text-slate-600'
                }`}
              >
                Enter Address Manually
              </button>
            </div>
          </div>

          {locationMode === 'map' && (
            <div className="space-y-3">
              <LiveTrackingMap
                mode="picker"
                initialLocation={mapLocation}
                onLocationSelect={(loc) => {
                  setMapLocation(loc);
                  if (loc.address && !loc.address.startsWith('Click map')) setManualAddress(loc.address);
                  if (loc.area) setManualArea(loc.area);
                  if (loc.village) setManualVillage(loc.village);
                  if (loc.taluk) setManualTaluk(loc.taluk);
                  if (loc.district) setManualDistrict(loc.district);
                }}
                className="h-[360px]"
              />
              {mapLocation && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 text-xs">
                  <span className="text-teal-900 font-semibold flex items-center gap-1.5">
                    <MapPin size={14} className="text-teal-600 shrink-0" />
                    {mapLocation.address || 'Selected Map Location'}
                  </span>
                  <span className="font-mono font-bold text-navy-900 bg-white px-2.5 py-1 rounded-lg border border-teal-200">
                    Lat: {mapLocation.latitude.toFixed(5)} | Lng: {mapLocation.longitude.toFixed(5)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Street Address / Landmark {locationMode === 'manual' && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="e.g., 42 Royapettah High Road, near Bus Stop"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ward / Village</label>
              <input
                type="text"
                value={manualVillage}
                onChange={(e) => {
                  setManualVillage(e.target.value);
                  setManualArea(e.target.value);
                }}
                placeholder="e.g., Royapettah"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Taluk</label>
              <input
                type="text"
                value={manualTaluk}
                onChange={(e) => setManualTaluk(e.target.value)}
                placeholder="e.g., Mambalam"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                District {locationMode === 'manual' && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={manualDistrict}
                onChange={(e) => setManualDistrict(e.target.value)}
                placeholder="e.g., Chennai"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 outline-none text-sm"
              />
            </div>
            <div className="sm:col-span-3 flex items-end pb-1">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded text-teal-600"
                />
                Submit Anonymously (hide my name from public tracking feed)
              </label>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileCheck size={16} className="text-teal-600" />
            Unique Tracking ID & SLA deadline will be assigned automatically upon submission.
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-8 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            {submitting ? 'Submitting Complaint...' : 'Submit Civic Complaint'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportPage;
