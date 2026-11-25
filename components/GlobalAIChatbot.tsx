import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Sparkles, Bot } from 'lucide-react';
import { aiService } from '../services/geminiService';

const GlobalAIChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string; modeLabel?: string }[]>([
    {
      role: 'ai',
      text: 'Hello! I am the CivicConnect Assistant. Ask me how to report an issue, track a complaint ID, or understand SLA escalation.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: textToSend }]);
    setIsLoading(true);
    try {
      const res = await aiService.chatAssistant(textToSend);
      setMessages((prev) => [...prev, { role: 'ai', text: res.suggestion, modeLabel: res.modeLabel }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: 'Unable to reach the assistant service right now. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-navy-900 hover:bg-teal-600 text-white rounded-2xl flex items-center justify-center shadow-xl border border-white/15 transition-all hover:scale-105 active:scale-95"
          aria-label="Open CivicConnect AI Assistant"
        >
          <MessageSquare size={24} />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-teal-400 rounded-full border-2 border-white" />
        </button>
      )}

      {isOpen && (
        <div className="bg-white w-[360px] max-w-[92vw] h-[500px] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-slideUp">
          <div className="bg-navy-900 px-5 py-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-none">CivicConnect Assistant</h3>
                <span className="text-[11px] text-teal-300 flex items-center gap-1 mt-1">
                  <Sparkles size={10} /> Grievance & SLA Help
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-navy-900 text-white rounded-br-sm'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
                {msg.modeLabel && (
                  <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.modeLabel}</span>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-2xl">
                  <Loader2 size={15} className="animate-spin text-teal-600" />
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-2 bg-white border-t border-slate-100 flex gap-2 overflow-x-auto scrollbar-hide">
            {['How to report?', 'Track complaint', 'How escalation works?'].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                className="whitespace-nowrap px-3 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-[11px] font-medium text-slate-600 rounded-full transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              className="flex-1 bg-slate-50 border border-slate-200 focus:border-teal-600 rounded-xl px-3.5 py-2.5 text-xs outline-none"
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-colors"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default GlobalAIChatbot;
