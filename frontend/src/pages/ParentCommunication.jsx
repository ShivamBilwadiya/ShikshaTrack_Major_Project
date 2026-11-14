import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  MessageSquare,
  Bell,
  Send,
  PlusCircle,
  Search,
  Filter,
  Check,
  CheckCheck,
  Paperclip,
  ExternalLink,
  User,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
  Clock,
  ChevronRight,
  Inbox,
  SendHorizontal,
} from 'lucide-react';

const ANNOUNCEMENT_CATEGORIES = ['ALL', 'GENERAL', 'ACADEMIC', 'ATTENDANCE', 'FEES', 'EVENTS', 'URGENT'];
const MESSAGE_CATEGORIES = ['ALL', 'GENERAL', 'ACADEMIC', 'ATTENDANCE', 'FEES', 'URGENT'];

export default function ParentCommunication() {
  const { user, isAdmin, isTeacher, isParent } = useAuth();
  const [activeSection, setActiveSection] = useState('announcements'); // 'announcements' | 'messages'

  // ================= Announcements State =================
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementCategory, setAnnouncementCategory] = useState('ALL');
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postForm, setPostForm] = useState({
    title: '',
    content: '',
    category: 'GENERAL',
    priority: 'NORMAL',
    targetAudience: 'ALL',
    classId: '',
    attachmentUrl: '',
  });
  const [classesList, setClassesList] = useState([]);

  // ================= Messages State =================
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageBox, setMessageBox] = useState('inbox'); // 'inbox' | 'sent'
  const [messageCategory, setMessageCategory] = useState('ALL');
  const [messageSearch, setMessageSearch] = useState('');
  const [activeThread, setActiveThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [composeSubmitting, setComposeSubmitting] = useState(false);
  const [composeForm, setComposeForm] = useState({
    receiverId: '',
    subject: '',
    content: '',
    category: 'GENERAL',
    studentId: '',
    attachmentUrl: '',
  });
  const [recipientsList, setRecipientsList] = useState([]);
  const [parentChildren, setParentChildren] = useState([]);

  // Fetch Announcements
  const fetchAnnouncements = async () => {
    try {
      setAnnouncementsLoading(true);
      const params = {};
      if (announcementCategory !== 'ALL') params.category = announcementCategory;
      if (announcementSearch.trim()) params.search = announcementSearch.trim();

      const res = await api.get('/communication/announcements', { params });
      setAnnouncements(res.data?.announcements || []);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  // Fetch Messages
  const fetchMessages = async () => {
    try {
      setMessagesLoading(true);
      const params = { box: messageBox };
      if (messageCategory !== 'ALL') params.category = messageCategory;
      if (messageSearch.trim()) params.search = messageSearch.trim();

      const res = await api.get('/communication/messages', { params });
      setMessages(res.data?.messages || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Fetch Thread Details
  const fetchThread = async (threadId) => {
    try {
      setThreadLoading(true);
      const res = await api.get(`/communication/messages/threads/${threadId}`);
      setActiveThread(res.data);
    } catch (err) {
      console.error('Failed to load message thread:', err);
    } finally {
      setThreadLoading(false);
    }
  };

  // Load auxiliary data for compose / announcements
  useEffect(() => {
    if (activeSection === 'announcements') {
      fetchAnnouncements();
    } else {
      fetchMessages();
    }
  }, [activeSection, announcementCategory, announcementSearch, messageBox, messageCategory, messageSearch]);

  // Load classes for teachers/admins
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        if (isAdmin || isTeacher) {
          const classRes = await api.get('/classes');
          setClassesList(classRes.data?.classes || classRes.data || []);
        }

        // Load linked children for parents
        if (isParent) {
          const childRes = await api.get('/parents/my-children');
          setParentChildren(childRes.data || []);
        }

        // Load potential message recipients (teachers / admin)
        const teachersRes = await api.get('/teachers');
        setRecipientsList(teachersRes.data?.teachers || teachersRes.data || []);
      } catch (err) {
        // Non-fatal
      }
    };
    loadMetadata();
  }, [isAdmin, isTeacher, isParent]);

  // Handle Mark Announcement Read
  const handleMarkAnnouncementRead = async (announcementId) => {
    try {
      await api.post(`/communication/announcements/${announcementId}/read`);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === announcementId ? { ...a, isRead: true } : a))
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Create Announcement
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      setPostSubmitting(true);
      await api.post('/communication/announcements', {
        title: postForm.title.trim(),
        content: postForm.content.trim(),
        category: postForm.category,
        priority: postForm.priority,
        targetAudience: postForm.targetAudience,
        classId: postForm.targetAudience === 'CLASS' ? postForm.classId : null,
        attachmentUrl: postForm.attachmentUrl ? postForm.attachmentUrl.trim() : null,
      });
      setPostModalOpen(false);
      setPostForm({
        title: '',
        content: '',
        category: 'GENERAL',
        priority: 'NORMAL',
        targetAudience: 'ALL',
        classId: '',
        attachmentUrl: '',
      });
      fetchAnnouncements();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to post announcement.');
    } finally {
      setPostSubmitting(false);
    }
  };

  // Handle Send Direct Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!composeForm.receiverId || !composeForm.subject || !composeForm.content) {
      alert('Please select a recipient, subject, and message content.');
      return;
    }

    try {
      setComposeSubmitting(true);
      await api.post('/communication/messages', {
        receiverId: composeForm.receiverId,
        subject: composeForm.subject.trim(),
        content: composeForm.content.trim(),
        category: composeForm.category,
        studentId: composeForm.studentId || null,
        attachmentUrl: composeForm.attachmentUrl ? composeForm.attachmentUrl.trim() : null,
      });

      setComposeModalOpen(false);
      setComposeForm({
        receiverId: '',
        subject: '',
        content: '',
        category: 'GENERAL',
        studentId: '',
        attachmentUrl: '',
      });
      setMessageBox('sent');
      fetchMessages();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send message.');
    } finally {
      setComposeSubmitting(false);
    }
  };

  // Handle Send Reply
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim() || !activeThread) return;

    try {
      setReplySubmitting(true);
      await api.post(`/communication/messages/threads/${activeThread.threadId}/reply`, {
        content: replyContent.trim(),
      });
      setReplyContent('');
      fetchThread(activeThread.threadId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send reply.');
    } finally {
      setReplySubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-sky-600 text-xs font-semibold uppercase tracking-wider mb-1">
            <MessageSquare className="w-4 h-4" />
            <span>School Communication Hub</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Announcements & Guardian Messaging
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified circulars, class updates, and direct staff-to-parent conversations.
          </p>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center space-x-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1">
            <button
              onClick={() => setActiveSection('announcements')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                activeSection === 'announcements'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-sky-600" />
              <span>Announcements</span>
            </button>
            <button
              onClick={() => setActiveSection('messages')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                activeSection === 'messages'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
              <span>Direct Messages</span>
            </button>
          </div>

          {activeSection === 'announcements' && (isAdmin || isTeacher) && (
            <button
              onClick={() => setPostModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 shadow-xs transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Post Announcement</span>
            </button>
          )}

          {activeSection === 'messages' && (
            <button
              onClick={() => setComposeModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Compose Message</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= SECTION 1: ANNOUNCEMENTS ================= */}
      {activeSection === 'announcements' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {ANNOUNCEMENT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAnnouncementCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    announcementCategory === cat
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search circulars..."
                value={announcementSearch}
                onChange={(e) => setAnnouncementSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Announcements Feed Grid */}
          {announcementsLoading ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" />
              Loading announcements...
            </div>
          ) : announcements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className={`bg-white rounded-xl border p-5 shadow-xs transition hover:shadow-md ${
                    ann.priority === 'URGENT'
                      ? 'border-rose-200 bg-rose-50/20'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          ann.priority === 'URGENT'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {ann.category}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        Audience: {ann.targetAudience} {ann.className ? `(${ann.className})` : ''}
                      </span>
                    </div>

                    {!ann.isRead && (
                      <button
                        onClick={() => handleMarkAnnouncementRead(ann.id)}
                        className="text-[10px] font-semibold text-sky-600 hover:text-sky-800 flex items-center space-x-1"
                        title="Mark as read"
                      >
                        <Check className="w-3 h-3" />
                        <span>Mark read</span>
                      </button>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mb-2">{ann.title}</h3>
                  <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                    {ann.content}
                  </p>

                  {ann.attachmentUrl && (
                    <a
                      href={ann.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center space-x-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>View Official Attachment</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Posted by {ann.author?.name} ({ann.author?.role})
                    </span>
                    <span>
                      {new Date(ann.publishedAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              No circulars or announcements match the current filter.
            </div>
          )}
        </div>
      )}

      {/* ================= SECTION 2: DIRECT MESSAGES ================= */}
      {activeSection === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Messages List Pane */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Box Switcher & Search */}
            <div className="p-3.5 border-b border-slate-100 space-y-2.5">
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setMessageBox('inbox')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 text-xs font-semibold rounded-md transition ${
                    messageBox === 'inbox'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Inbox className="w-3.5 h-3.5" />
                  <span>Inbox</span>
                </button>
                <button
                  onClick={() => setMessageBox('sent')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 text-xs font-semibold rounded-md transition ${
                    messageBox === 'sent'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <SendHorizontal className="w-3.5 h-3.5" />
                  <span>Sent</span>
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Messages Thread List */}
            {messagesLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs">Loading messages...</div>
            ) : messages.length > 0 ? (
              <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
                {messages.map((m) => {
                  const isCurrent = activeThread?.threadId === m.threadId;
                  return (
                    <div
                      key={m.id}
                      onClick={() => fetchThread(m.threadId)}
                      className={`p-3.5 text-xs cursor-pointer transition ${
                        isCurrent
                          ? 'bg-indigo-50/70 border-l-4 border-indigo-600'
                          : !m.isRead && messageBox === 'inbox'
                          ? 'bg-sky-50/40 hover:bg-slate-50 font-semibold'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-semibold text-slate-800 truncate">
                          {messageBox === 'inbox' ? m.sender?.name : `To: ${m.receiver?.name}`}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(m.createdAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <h4 className="text-slate-900 font-medium truncate">{m.subject}</h4>
                      <p className="text-slate-500 truncate mt-0.5">{m.content}</p>

                      {m.student && (
                        <span className="inline-block mt-1.5 text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          Ward: {m.student.name} ({m.student.className})
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                No messages in {messageBox}.
              </div>
            )}
          </div>

          {/* Right Column: Active Conversation Pane */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col min-h-[500px]">
            {activeThread ? (
              <div className="flex-1 flex flex-col">
                {/* Thread Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{activeThread.subject}</h3>
                    <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                      <span className="font-medium text-slate-600">
                        Category: {activeThread.category}
                      </span>
                      {activeThread.student && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-600 font-medium">
                            Student: {activeThread.student.name} ({activeThread.student.admissionNumber})
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Conversation History */}
                <div className="flex-1 p-4 space-y-3.5 overflow-y-auto max-h-[420px] bg-slate-50/50">
                  {activeThread.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.isOutgoing ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mb-1">
                        <span className="font-semibold text-slate-600">{msg.sender?.name}</span>
                        <span>•</span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div
                        className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed ${
                          msg.isOutgoing
                            ? 'bg-indigo-600 text-white rounded-br-xs shadow-xs'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs shadow-xs'
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.content}</p>
                        {msg.attachmentUrl && (
                          <a
                            href={msg.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`mt-2 inline-flex items-center space-x-1 text-[11px] underline ${
                              msg.isOutgoing ? 'text-indigo-100' : 'text-indigo-600'
                            }`}
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>Attachment</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reply Composer */}
                <form onSubmit={handleSendReply} className="p-3 border-t border-slate-100 flex items-center space-x-2 bg-white">
                  <input
                    type="text"
                    required
                    placeholder="Type your reply to this conversation..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={replySubmitting || !replyContent.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center space-x-1.5 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-xs">
                Select a message thread from the left or compose a new message to start a conversation.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post Announcement Modal */}
      {postModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 relative">
            <button
              onClick={() => setPostModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">Post Official Announcement</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Publish circulars and broadcasts to students, faculty, and guardians.
            </p>

            <form onSubmit={handleCreateAnnouncement} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Announcement Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Annual Sports Day & Parent-Teacher Meeting"
                  value={postForm.title}
                  onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={postForm.category}
                    onChange={(e) => setPostForm({ ...postForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="GENERAL">General Notice</option>
                    <option value="ACADEMIC">Academic / Exams</option>
                    <option value="ATTENDANCE">Attendance Alert</option>
                    <option value="FEES">Fee Notice</option>
                    <option value="EVENTS">Events & Activities</option>
                    <option value="URGENT">Urgent Alert</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Audience</label>
                  <select
                    value={postForm.targetAudience}
                    onChange={(e) => setPostForm({ ...postForm, targetAudience: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="ALL">Entire School (All)</option>
                    <option value="PARENTS">Guardians Only</option>
                    <option value="TEACHERS">Faculty / Teachers Only</option>
                    <option value="CLASS">Specific Class</option>
                  </select>
                </div>
              </div>

              {postForm.targetAudience === 'CLASS' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Class</label>
                  <select
                    required
                    value={postForm.classId}
                    onChange={(e) => setPostForm({ ...postForm, classId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">-- Choose Class --</option>
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}-{c.section} ({c.academicYear})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Announcement Body</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Detailed content of the announcement..."
                  value={postForm.content}
                  onChange={(e) => setPostForm({ ...postForm, content: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Attachment Link <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={postForm.attachmentUrl}
                  onChange={(e) => setPostForm({ ...postForm, attachmentUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPostModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postSubmitting}
                  className="px-4 py-2 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-700 disabled:opacity-50 transition"
                >
                  {postSubmitting ? 'Publishing...' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Compose Message Modal */}
      {composeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 relative">
            <button
              onClick={() => setComposeModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">Compose Direct Message</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Send a private message to teachers, faculty, or school administration.
            </p>

            <form onSubmit={handleSendMessage} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Recipient</label>
                <select
                  required
                  value={composeForm.receiverId}
                  onChange={(e) => setComposeForm({ ...composeForm, receiverId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select Recipient --</option>
                  {recipientsList.map((r) => (
                    <option key={r.id || r.userId} value={r.id || r.userId}>
                      {r.name} ({r.role || 'Staff'}) {r.email ? `- ${r.email}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {isParent && parentChildren.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Student Context <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <select
                    value={composeForm.studentId}
                    onChange={(e) => setComposeForm({ ...composeForm, studentId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- No specific student --</option>
                    {parentChildren.map((c) => (
                      <option key={c.studentId} value={c.studentId}>
                        {c.name} ({c.className})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={composeForm.category}
                    onChange={(e) => setComposeForm({ ...composeForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="GENERAL">General Inquiry</option>
                    <option value="ACADEMIC">Academic Discussion</option>
                    <option value="ATTENDANCE">Attendance Query</option>
                    <option value="FEES">Fee Matters</option>
                    <option value="URGENT">Urgent Concern</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="Subject of message..."
                    value={composeForm.subject}
                    onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Message Body</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Write your message clearly..."
                  value={composeForm.content}
                  onChange={(e) => setComposeForm({ ...composeForm, content: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Attachment Link <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={composeForm.attachmentUrl}
                  onChange={(e) => setComposeForm({ ...composeForm, attachmentUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setComposeModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={composeSubmitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {composeSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
