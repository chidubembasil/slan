import React, { useState, useEffect, useCallback } from 'react';
import CreateAssessmentModal from '../components/AssessmentModal';
import { Clock, CheckCircle2, AlertTriangle, Eye, Search, Plus } from 'lucide-react';

interface AssessmentSubmission {
  id: string;
  learner: {
    id: string;
    name: string;
    email: string;
  };
  module: {
    id: string;
    title: string;
    type: string;
  };
  assessmentType: string;
  status: 'Pending' | 'Reviewed' | 'Flagged';
  submittedAt: string;
  score?: number;
  totalScore?: number;
  submissionContent?: string;
}

const AssessmentReviewQueue: React.FC = () => {
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<AssessmentSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Stats
  const pending = submissions.filter(s => s.status === 'Pending').length;
  const reviewed = submissions.filter(s => s.status === 'Reviewed').length;
  const flagged = submissions.filter(s => s.status === 'Flagged').length;

  // Fetch submissions
  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter!== 'All') params.append('status', statusFilter);

      const token = localStorage.getItem('token');

      const response = await fetch(
        `/api/assessments/submissions/review-queue?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
           ...(token? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const submissionsData = Array.isArray(data)? data : data.data || [];

      setSubmissions(submissionsData);

      if (submissionsData.length > 0 &&!selectedSubmission) {
        setSelectedSubmission(submissionsData[0]);
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, selectedSubmission]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchSubmissions();
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchTerm, statusFilter]);

  const handleModalSuccess = () => {
    setShowCreateModal(false);
    fetchSubmissions();
  };

  const stats = [
    { label: 'Pending Review', value: pending, Icon: Clock, color: 'text-orange-500 bg-orange-50' },
    { label: 'Reviewed', value: reviewed, Icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
    { label: 'Flagged', value: flagged, Icon: AlertTriangle, color: 'text-red-500 bg-red-50' },
    { label: 'Total', value: submissions.length, Icon: Eye, color: 'text-gray-600 bg-gray-50' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-8 max-w-7xl mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-4xl font-semibold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <stat.Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search, Filter + Create Button */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search by learner or module..."
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e2e5a]/20 focus:border-[#1e2e5a] bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
          </div>

          <select
            className="px-5 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e2e5a]/20 focus:border-[#1e2e5a] bg-white min-w-"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            title='all status'
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Flagged">Flagged</option>
          </select>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#004900] hover:bg-[#003500] text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Create Assessment
          </button>
        </div>

        {/* Submissions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {loading? (
            <div className="col-span-3 text-center py-12">Loading submissions...</div>
          ) : submissions.length === 0? (
            <div className="col-span-3 text-center py-12 text-gray-500">No submissions found</div>
          ) : (
            submissions.map((sub) => (
              <div
                key={sub.id}
                onClick={() => setSelectedSubmission(sub)}
                className={`bg-white border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md ${
                  selectedSubmission?.id === sub.id? 'border-[#1e2e5a] shadow-md ring-1 ring-[#1e2e5a]/20' : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-semibold text-gray-900">{sub.learner.name}</p>
                    <p className="text-sm text-gray-500">{sub.learner.email}</p>
                  </div>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-medium ${
                      sub.status === 'Pending'
                       ? 'bg-orange-100 text-orange-700'
                        : sub.status === 'Reviewed'
                       ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {sub.status}
                  </span>
                </div>

                <p className="font-medium text-gray-800">{sub.module.title}</p>
                <p className="text-sm text-gray-500">{sub.assessmentType}</p>

                <div className="mt-4 text-xs text-gray-400">
                  Submitted: {new Date(sub.submittedAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Review Panel */}
        {selectedSubmission && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-2xl font-semibold mb-6 text-gray-900">Review Assessment</h2>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Learner</p>
                <p className="font-semibold text-gray-900">{selectedSubmission.learner.name}</p>
                <p className="text-sm text-gray-500">{selectedSubmission.learner.email}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Module</p>
                <p className="font-semibold text-gray-900">{selectedSubmission.module.title}</p>
                <p className="text-sm text-gray-500">{selectedSubmission.assessmentType}</p>
              </div>
            </div>

            <div className="mt-8">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Submission Content</p>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 min-h-">
                {selectedSubmission.submissionContent? (
                  <p className="text-gray-700">{selectedSubmission.submissionContent}</p>
                ) : (
                  <p className="text-gray-400 italic">
                    [Learner's assessment submission would be displayed here - could be text, PDF, or document content]
                  </p>
                )}
              </div>
            </div>

            {selectedSubmission.score!== undefined && (
              <div className="mt-8 bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <p className="text-green-800 font-medium">Review Completed</p>
                  <p className="text-green-700 text-sm mt-0.5">Outstanding performance.</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-green-700">
                    {selectedSubmission.score}/{selectedSubmission.totalScore}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showCreateModal && (
        <CreateAssessmentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
};

export default AssessmentReviewQueue;