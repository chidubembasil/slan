import { useAuthGuard } from "../hooks/useAuthGuard";
import { MessageSquare, Send, Search, Clock, Sparkles, Inbox } from "lucide-react";

export default function Messages() {
  useAuthGuard();
  return (
    <div className="w-full space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#004900] via-[#003d00] to-[#0a5c00] p-5 sm:p-6 md:p-7 shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur border border-white/20 shrink-0">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Messages</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur border border-white/10">
                  <Sparkles size={12} /> Inbox
                </span>
              </div>
              <p className="mt-1 text-sm text-white/80 max-w-xl">Direct messages with learners and staff — all conversations in one place.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-[#004900] shadow-sm">
              <Inbox size={14} /> 0 unread
            </span>
          </div>
        </div>
      </div>

      {/* Search + empty state */}
      <div className="bg-white rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3 border-b border-gray-100">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search messages..."
              className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] focus:bg-white transition-all"
            />
          </div>
          <button className="inline-flex items-center justify-center gap-2 bg-[#004900] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#003d00] transition-colors shrink-0 w-full sm:w-auto">
            <Send size={14} /> New Message
          </button>
        </div>

        <div className="p-8 sm:p-12 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto">
            <MessageSquare size={28} className="text-gray-400 sm:w-8 sm:h-8" />
          </div>
          <h3 className="mt-4 text-base sm:text-lg font-semibold text-gray-900">No messages yet</h3>
          <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">When you message learners or staff, your conversations will appear here. Responsive on mobile, tablet and desktop.</p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              <Clock size={12} /> Last synced just now
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
