import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, ShieldAlert, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../services/apiClient';

const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Complaint Status Inquiry');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiClient.sendContact({ name, email, subject, message });
      setSent(true);
      setName('');
      setEmail('');
      setMessage('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit inquiry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 animate-fadeIn">
      <div className="bg-navy-900 text-white py-16 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-teal-400">Municipal Support</span>
          <h1 className="text-4xl font-extrabold mt-2">Contact CivicConnect Desk</h1>
          <p className="text-slate-300 mt-3 text-sm sm:text-base">
            Need help with a complaint Tracking ID, escalation status, or municipal office verification? Reach out below.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-navy-900">Official Channels</h2>
              <div className="flex items-start gap-3">
                <Mail className="text-teal-600 shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-xs font-bold text-navy-900">Support Email</p>
                  <p className="text-sm text-slate-600">support@civicconnect.gov.in</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="text-teal-600 shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-xs font-bold text-navy-900">Citizen Helpline</p>
                  <p className="text-sm text-slate-600">1912 / 1800-425-0191</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="text-teal-600 shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-xs font-bold text-navy-900">Municipal Oversight HQ</p>
                  <p className="text-sm text-slate-600">101 Civic Plaza, Chennai & Madurai, TN</p>
                </div>
              </div>
            </div>

            <div className="bg-navy-900 text-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm mb-2">
                <ShieldAlert size={18} /> Emergency Services
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                For immediate life-safety emergencies (live downed wires, structural collapse, fire), call direct hotlines:
              </p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white/10 rounded-xl p-2.5">
                  <span className="text-[10px] text-slate-300 block">Fire / Medical</span>
                  <span className="font-extrabold text-base">101 / 108</span>
                </div>
                <div className="bg-white/10 rounded-xl p-2.5">
                  <span className="text-[10px] text-slate-300 block">Police</span>
                  <span className="font-extrabold text-base">100 / 112</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-navy-900 mb-6">Send a Message</h2>

            {sent ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
                <CheckCircle2 size={40} className="text-emerald-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-emerald-900">Message Logged Successfully</h3>
                <p className="text-sm text-emerald-700 mt-1">
                  Your inquiry has been saved in the municipal support database.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="mt-5 px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={15} /> {error}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 outline-none text-sm"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 outline-none text-sm"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 outline-none text-sm"
                  >
                    <option>Complaint Status Inquiry</option>
                    <option>SLA Escalation Review</option>
                    <option>Authority Account Assistance</option>
                    <option>Technical Feedback</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Message</label>
                  <textarea
                    rows={5}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-600 outline-none text-sm"
                    placeholder="Describe how we can assist you..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 bg-navy-900 hover:bg-teal-600 text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-60"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {loading ? 'Sending...' : 'Submit Inquiry'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
