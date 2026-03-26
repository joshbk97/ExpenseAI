import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Database, Sparkles, Bot, User } from "lucide-react";
import { queryApi } from "~/lib/api";

export default function AskAI() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your AI expense assistant. Ask me anything about your spending data in natural language.", sql: null, data: null }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userQuery = query.trim();
    setQuery("");
    setMessages(prev => [...prev, { role: "user", content: userQuery }]);
    setLoading(true);

    try {
      const res = await queryApi.ask(userQuery);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.data.answer,
        sql: res.data.sql_generated,
        data: res.data.data
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error trying to answer that. Please try again.",
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const sampleQueries = [
    "How much did I spend on dining last month?",
    "Show me my top 5 merchants by total spend",
    "What's my average receipt amount?",
    "List all my grocery expenses over $50"
  ];

  return (
    <div className="max-w-4xl mx-auto min-h-[calc(100vh-9rem)] flex flex-col animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          Ask AI <Sparkles className="w-5 h-5 text-primary-400" />
        </h2>
        <p className="text-gray-400">Query your expense data using natural language.</p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 glass-card overflow-hidden flex flex-col mb-4 min-h-[22rem]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex flex-shrink-0 items-center justify-center mt-1">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              
              <div className={`max-w-[80%] ${msg.role === "user" ? "order-1" : "order-2"}`}>
                <div className={`p-4 rounded-2xl ${
                  msg.role === "user" 
                    ? "bg-primary-600 text-white rounded-tr-sm" 
                    : msg.isError 
                      ? "bg-red-500/10 border border-red-500/20 text-red-400 rounded-tl-sm"
                      : "bg-surface-800 border border-white/5 text-gray-100 rounded-tl-sm"
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Show SQL and Data if available */}
                {msg.sql && (
                  <div className="mt-2 space-y-2 animate-fade-in">
                    <details className="group">
                      <summary className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer hover:text-primary-400 transition-colors">
                        <Database className="w-3 h-3" />
                        View Generated SQL
                      </summary>
                      <pre className="mt-2 p-3 rounded-xl bg-surface-900 border border-white/5 text-xs text-blue-300 overflow-x-auto font-mono">
                        {msg.sql}
                      </pre>
                    </details>
                    
                    {msg.data && msg.data.length > 0 && (
                      <details className="group">
                        <summary className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer hover:text-emerald-400 transition-colors">
                          <Database className="w-3 h-3" />
                          View Raw Data ({msg.data.length} rows)
                        </summary>
                        <div className="mt-2 max-h-60 overflow-y-auto border border-white/5 rounded-xl bg-surface-900">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-surface-800 sticky top-0">
                              <tr>
                                {Object.keys(msg.data[0]).map(k => (
                                  <th key={k} className="p-2 font-medium text-gray-400">{k}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {msg.data.map((row, i) => (
                                <tr key={i} className="hover:bg-white/5">
                                  {Object.values(row).map((v, m) => (
                                    <td key={m} className="p-2 text-gray-300">
                                      {typeof v === 'number' && v % 1 !== 0 ? v.toFixed(2) : String(v)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-surface-700 flex items-center justify-center mt-1 order-2">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
              )}
            </div>
          ))}
          
          {loading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center mt-1 animate-pulse">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-surface-800 border border-white/5 p-4 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce [animation-delay:-.15s]" />
                <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce [animation-delay:-.3s]" />
              </div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {messages.length === 1 && (
          <div className="px-6 py-4 flex flex-wrap gap-2 border-t border-white/5 bg-surface-800/50">
            {sampleQueries.map((q, i) => (
              <button
                key={i}
                onClick={() => setQuery(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-primary-500/20 text-primary-300 bg-primary-500/10 hover:bg-primary-500/20 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="sticky bottom-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about your expenses..."
          className="input-field w-full pl-5 pr-14 py-3 sm:py-4 rounded-2xl shadow-lg border-white/10 bg-surface-800"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-50 transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
