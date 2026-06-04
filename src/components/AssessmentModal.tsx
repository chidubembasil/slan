import React, { useState } from 'react';

type Option = { text: string; isCorrect: boolean };
type Question = { id: string; text: string; type: 'Multiple Choice' | 'True/False' | 'Short Answer'; options: Option[] };
type Errors = Record<string, string>;

const API_URL = '/api/assessments';

export default function CreateAssessmentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [importType, setImportType] = useState<string>('auto');
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    courseId: '',
    type: 'Quiz',
    description: '',
    passMark: 60,
    attemptsAllowed: 3,
  });

  const [questions, setQuestions] = useState<Question[]>([
    { id: crypto.randomUUID(), text: '', type: 'Multiple Choice', options: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ]},
  ]);

  const courses = [
    { id: '', name: 'Select Course' },
    { id: 'course_1', name: 'Strategic Leadership' },
    { id: 'course_2', name: 'Digital Marketing' },
    { id: 'course_3', name: 'Project Management' },
  ];

  const updateForm = (k: string, v: any) => setForm(prev => ({...prev, [k]: v }));

  // ===== DOCUMENT PARSER =====
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      let parsed: Question[] = [];

      if (file.name.endsWith('.json')) {
        parsed = parseJSON(text);
      } else if (file.name.endsWith('.csv')) {
        parsed = parseCSV(text);
      } else {
        parsed = parseTXT(text);
      }

      if (parsed.length > 0) {
        setQuestions(parsed);
        alert(`Imported ${parsed.length} questions successfully!`);
      } else {
        alert('No valid questions found in file');
      }
    } catch (err) {
      alert('Failed to parse file. Check format.');
      console.error(err);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const parseJSON = (text: string): Question[] => {
  const data = JSON.parse(text);
  const items = Array.isArray(data)? data : (data.questions || []);

  return items.map((q: any): Question => ({
    id: crypto.randomUUID(),
    text: q.text || q.question || '',
    type: (q.type || (importType!== 'auto'? importType : 'Multiple Choice')) as Question['type'],
    options: (q.options || []).map((opt: any): Option => ({
      text: typeof opt === 'string'? opt : (opt.text?? ''),
      // FIX: force boolean
      isCorrect: typeof opt === 'object'
       ? Boolean(opt.isCorrect?? opt.correct)
        : false,
    })),
  }));
};

const parseCSV = (text: string): Question[] => {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const qIdx = headers.indexOf('question');
  const typeIdx = headers.indexOf('type');
  const correctIdx = headers.indexOf('correct');

  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const questionText = cols[qIdx] || '';
    const qType = typeIdx >= 0? cols[typeIdx] : importType;
    const correct = correctIdx >= 0? cols[correctIdx] : '';

    const options: Option[] = cols.slice(2, 6).filter(Boolean).map((opt, i) => {
      // FIX:!!correct makes it boolean
      const isCorrect =!!correct && (
        correct.toLowerCase() === opt.toLowerCase() ||
        correct === String(i+1) ||
        correct.toUpperCase() === ['A','B','C','D'][i]
      );
      return {
        text: opt.replace('*', ''),
        isCorrect: opt.includes('*') || isCorrect // now always boolean
      };
    });

    return {
      id: crypto.randomUUID(),
      text: questionText,
      type: (qType as Question['type']) || 'Multiple Choice',
      options: options.length? options : [{text:'',isCorrect:false},{text:'',isCorrect:false}]
    };
  }).filter(q => q.text);
};

  const parseTXT = (text: string): Question[] => {
  const blocks = text.split(/\n\s*\n/);
  return blocks.map(block => {
    const lines = block.split('\n').filter(l => l.trim());
    const qLine = lines.find(l => l.match(/^q:|^question:/i));
    const questionText = qLine? qLine.replace(/^q:|^question:/i, '').trim() : lines[0];

    const options: Option[] = lines.slice(1)
     .filter(l => l.match(/^[a-d]\)|^[0-9]\./i))
     .map(line => ({
        text: line.replace(/^[a-d]\)|^[0-9]\./i, '').replace('*', '').replace('(correct)', '').trim(),
        isCorrect: line.includes('*') || line.toLowerCase().includes('(correct)'), // boolean
      }));

    return {
      id: crypto.randomUUID(),
      text: questionText,
      type: (importType!== 'auto'? importType : (options.length? 'Multiple Choice' : 'Short Answer')) as Question['type'],
      options,
    };
  }).filter(q => q.text);
};

  // VALIDATION
  const validateBasic = (): boolean => {
    const e: Errors = {};
    if (!form.title.trim() || form.title.trim().length < 3) e.title = 'Title is required (min 3 chars)';
    if (!form.courseId) e.courseId = 'Please select a course';
    if (isNaN(form.passMark) || form.passMark < 0 || form.passMark > 100) e.passMark = 'Pass mark must be 0-100';
    if (isNaN(form.attemptsAllowed) || form.attemptsAllowed < 1) e.attemptsAllowed = 'Attempts must be 1-10';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateQuestions = (): boolean => {
    const e: Errors = {};
    if (questions.length === 0) {
      e.questions = 'Add at least one question';
      setErrors(e);
      return false;
    }
    questions.forEach((q, qi) => {
      if (!q.text.trim()) e[`q${qi}_text`] = `Question ${qi+1}: text required`;
      if (q.type === 'Multiple Choice' && q.options.filter(o => o.text.trim()).length < 2) {
        e[`q${qi}_opts`] = `Question ${qi+1}: at least 2 options`;
      }
      if ((q.type === 'Multiple Choice' || q.type === 'True/False') &&!q.options.some(o => o.isCorrect)) {
        e[`q${qi}_correct`] = `Question ${qi+1}: select at least one correct answer`;
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 0 &&!validateBasic()) return;
    if (step === 1 &&!validateQuestions()) return;
    setStep(s => Math.min(2, s + 1));
  };
  const prev = () => setStep(s => Math.max(0, s - 1));

  // QUESTION HANDLERS
  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    setQuestions(qs => qs.map((q, i) => i === idx? {...q,...patch } : q));
  };
  const updateOption = (qIdx: number, oIdx: number, text: string) => {
    setQuestions(qs => qs.map((q, i) => i === qIdx? {
    ...q, options: q.options.map((o, j) => j === oIdx? {...o, text } : o)
    } : q));
  };
  const toggleCorrect = (qIdx: number, oIdx: number) => {
    setQuestions(qs => qs.map((q, i) => i === qIdx? {
    ...q, options: q.options.map((o, j) => j === oIdx? {...o, isCorrect:!o.isCorrect} :
       q.type === 'True/False'? {...o, isCorrect: false} : o)
    } : q));
  };
  const addQuestion = () => {
    setQuestions(qs => [...qs, { id: crypto.randomUUID(), text: '', type: 'Multiple Choice', options: [
      { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }
    ]}]);
  };
  const removeQuestion = (idx: number) => setQuestions(qs => qs.filter((_, i) => i!== idx));

  // SUBMIT
  const publish = async () => {
    if (!validateBasic() ||!validateQuestions()) { setStep(0); return; }
    setLoading(true);
    try {
      const payload = {
        title: form.title.trim(),
        courseId: form.courseId,
        type: form.type,
        description: form.description.trim(),
        passMark: Number(form.passMark),
        attemptsAllowed: Number(form.attemptsAllowed),
        questions: questions.map(q => ({
          text: q.text.trim(),
          type: q.type,
          options: q.options.filter(o => o.text.trim()).map(o => ({ text: o.text.trim(), isCorrect: o.isCorrect }))
        }))
      };

      const token = localStorage.getItem('token');
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        ...(token? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to publish');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-150 overflow-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold">Create New Assessment</h2>
          <button onClick={onClose} className="text-2xl leading-none hover:text-gray-600">×</button>
        </div>

        <div className="grid grid-cols-3 gap-3 p-6">
          {['Basic Info', 'Questions', 'Review'].map((label, i) => (
            <div key={label} className={`text-center py-2.5 rounded-xl font-medium ${i === step? 'bg-[#004900] text-white' : i < step? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {label}
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          {step === 0 && (
            <div className="space-y-4">
              {/*... basic info fields unchanged... */}
              <div>
                <label className="text-sm font-medium text-[#004900]">Assessment Title</label>
                <input value={form.title} onChange={e => updateForm('title', e.target.value)} placeholder="e.g., Strategic Leadership Module Assessment" className="w-full mt-1 border rounded-lg px-3 py-2.5"/>
                {errors.title && <p className="text-red-600 text-xs mt-1">{errors.title}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#004900]">Course/Module</label>
                  <select value={form.courseId} onChange={e => updateForm('courseId', e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2.5 bg-white" aria-label='items'>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#004900]">Assessment Type</label>
                  <select value={form.type} onChange={e => updateForm('type', e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2.5 bg-white" aria-label='items'>
                    <option>Quiz</option><option>Exam</option><option>Assignment</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#004900]">Description</label>
                <textarea value={form.description} onChange={e => updateForm('description', e.target.value)} rows={3} className="w-full mt-1 border rounded-lg px-3 py-2.5" aria-label='items'/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Pass Mark (%)</label>
                  <input type="number" value={form.passMark} onChange={e => updateForm('passMark', Number(e.target.value))} className="w-full mt-1 border rounded-lg px-3 py-2.5" aria-label='items'/>
                </div>
                <div>
                  <label className="text-sm font-medium">Attempts Allowed</label>
                  <input type="number" value={form.attemptsAllowed} onChange={e => updateForm('attemptsAllowed', Number(e.target.value))} className="w-full mt-1 border rounded-lg px-3 py-2.5" aria-label='items'/>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              {/* NEW: Document Upload */}
              <div className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl p-5">
                <h3 className="font-medium text-[#004900] mb-3">Import Questions from Document</h3>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-gray-600">Upload File</label>
                    <input
                      type="file"
                      accept=".json,.csv,.txt"
                      onChange={handleFileUpload}
                      disabled={importing}
                      className="w-full mt-1 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#004900] file:text-white hover:file:bg-[#004900]"
                      aria-label='items'
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Question Type</label>
                    <select value={importType} onChange={e => setImportType(e.target.value)} className="mt-1 border rounded-lg px-3 py-2 bg-white" aria-label='items'>
                      <option value="auto">Auto-detect</option>
                      <option value="Multiple Choice">Multiple Choice</option>
                      <option value="True/False">True/False</option>
                      <option value="Short Answer">Short Answer</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Supports: <strong>JSON</strong> [{'{text, options:[{text, isCorrect}]}'}], <strong>CSV</strong> (question,option1,option2,correct), <strong>TXT</strong> (mark correct with * )
                </p>
                {importing && <p className="text-sm text-blue-600 mt-2">Parsing document...</p>}
              </div>

              <div className="flex justify-between items-center">
                <h3 className="font-medium">Questions ({questions.length})</h3>
                <button onClick={addQuestion} className="text-sm text-[#004900] font-medium hover:underline">+ Add Manually</button>
              </div>

              {questions.map((q, qi) => (
                <div key={q.id} className="border rounded-xl p-4 bg-gray-50/50">
                  <div className="flex justify-between mb-3">
                    <h4 className="font-medium text-[#004900]">Question {qi + 1}</h4>
                    {questions.length > 1 && <button onClick={() => removeQuestion(qi)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>}
                  </div>

                  <textarea value={q.text} onChange={e => updateQuestion(qi, { text: e.target.value })} placeholder="Enter question..." className="w-full border rounded-lg px-3 py-2 bg-white mb-3" rows={2}/>

                  <select value={q.type} onChange={e => updateQuestion(qi, { type: e.target.value as any })} className="w-full border rounded-lg px-3 py-2 bg-white mb-3 text-sm" aria-label='items'>
                    <option>Multiple Choice</option><option>True/False</option><option>Short Answer</option>
                  </select>

                  {(q.type === 'Multiple Choice' || q.type === 'True/False') && (
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-3">
                          <input
                            type={q.type === 'True/False'? 'radio' : 'checkbox'}
                            name={`q-${qi}`}
                            checked={opt.isCorrect}
                            onChange={() => toggleCorrect(qi, oi)}
                            className="w-4 h-4"
                            aria-label='items'
                          />
                          <input
                            value={opt.text}
                            onChange={e => updateOption(qi, oi, e.target.value)}
                            placeholder={`Option ${oi + 1}`}
                            className="flex-1 border rounded-lg px-3 py-1.5 bg-white text-sm"
                          />
                        </div>
                      ))}
                      {q.type === 'Multiple Choice' && (
                        <button onClick={() => updateQuestion(qi, { options: [...q.options, {text:'',isCorrect:false}] })} className="text-xs text-blue-600 hover:underline">+ Add option</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-5 space-y-2 text-sm">
                <div><span className="text-gray-500">Title:</span> <span className="font-medium">{form.title}</span></div>
                <div><span className="text-gray-500">Questions:</span> <span className="font-medium">{questions.length} ({questions.filter(q => q.options.some(o => o.isCorrect)).length} with answers)</span></div>
              </div>
              <div className="bg-green-50 text-green-700 rounded-xl p-3 text-sm border border-green-200">✓ Ready to publish to backend</div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t sticky bottom-0 bg-white">
          <button onClick={prev} disabled={step === 0} className="px-6 py-2.5 border rounded-xl disabled:opacity-50">Previous</button>
          {step < 2? (
            <button onClick={next} className="flex-1 bg-[#004900] text-white py-2.5 rounded-xl font-medium">Next</button>
          ) : (
            <button onClick={publish} disabled={loading} className="flex-1 bg-[#004900] text-white py-2.5 rounded-xl font-medium disabled:opacity-60">
              {loading? 'Publishing...' : 'Publish Assessment'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}