'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type QuizQuestion = {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  marks?: number;
  sortOrder?: number;
};

type QuizData = {
  id: string;
  title: string;
  description?: string;
  passPercentage: number;
  questions: QuizQuestion[];
};

type QuizResult = {
  id?: string;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  passPercentage: number;
  attemptedAt?: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export default function CourseQuizPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const totalQuestions = quiz?.questions?.length || 0;
  const answeredCount = useMemo(
    () => Object.keys(answers).filter((key) => answers[key]).length,
    [answers]
  );

  useEffect(() => {
    if (!courseId) return;
    fetchQuiz();
  }, [courseId]);

  const getToken = () => {
    if (typeof window === 'undefined') return null;
    return (
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('instahire_token')
    );
  };

  const fetchQuiz = async () => {
    try {
      setLoading(true);
      setError('');

      const token = getToken();

      const res = await fetch(`${API_BASE}/training/${courseId}/quiz`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        cache: 'no-store'
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load quiz');
      }

      setQuiz(data.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (questionId: string, selectedOption: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: selectedOption
    }));
  };

  const handleSubmitQuiz = async () => {
    try {
      setSubmitting(true);
      setError('');
      setSuccessMessage('');

      if (!quiz) {
        throw new Error('Quiz not found');
      }

      if (answeredCount !== totalQuestions) {
        throw new Error('Please answer all questions before submitting');
      }

      const token = getToken();

      const payload = {
        answers: quiz.questions.map((q) => ({
          questionId: q.id,
          selectedOption: answers[q.id]
        }))
      };

      const res = await fetch(`${API_BASE}/training/${courseId}/quiz/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit quiz');
      }

      setResult(data.data);
      setSuccessMessage(data.message || 'Quiz submitted successfully');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setAnswers({});
    setError('');
    setSuccessMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error && !quiz && !result) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Course Quiz</h1>
          <p className="mt-4 text-sm text-red-600">{error}</p>

          <div className="mt-6 flex gap-3">
            <button
              onClick={fetchQuiz}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Retry
            </button>

            <button
              onClick={() => router.push(`/training/${courseId}`)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Back to Course
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm">
          <div
            className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              result.passed
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {result.passed ? 'Passed' : 'Failed'}
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            Quiz Result
          </h1>

          {successMessage ? (
            <p className="mt-2 text-sm text-slate-600">{successMessage}</p>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Score</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {result.score} / {result.totalMarks}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Percentage</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {result.percentage}%
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Pass Mark</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {result.passPercentage}%
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Status</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  result.passed ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {result.passed ? 'Qualified' : 'Not Qualified'}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {result.passed ? (
              <>
                <button
                  onClick={() => router.push(`/training/${courseId}/certificate`)}
                  className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700"
                >
                  View Certificate
                </button>

                <button
                  onClick={() => router.push(`/training/${courseId}`)}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Back to Course
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleRetry}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Try Again
                </button>

                <button
                  onClick={() => router.push(`/training/${courseId}`)}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Back to Course
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-6 border-b border-slate-200 pb-4">
            <h1 className="text-3xl font-bold text-slate-900">
              {quiz?.title || 'Course Quiz'}
            </h1>

            {quiz?.description ? (
              <p className="mt-2 text-sm text-slate-600">{quiz.description}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Questions: {totalQuestions}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Pass Mark: {quiz?.passPercentage}%
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Answered: {answeredCount}/{totalQuestions}
              </span>
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="space-y-6">
            {quiz?.questions?.map((question, index) => (
              <div
                key={question.id}
                className="rounded-2xl border border-slate-200 p-5"
              >
                <h2 className="text-lg font-semibold text-slate-900">
                  Q{index + 1}. {question.question}
                </h2>

                <div className="mt-4 space-y-3">
                  {[
                    { key: 'A', value: question.optionA },
                    { key: 'B', value: question.optionB },
                    { key: 'C', value: question.optionC },
                    { key: 'D', value: question.optionD }
                  ].map((option) => (
                    <label
                      key={option.key}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                        answers[question.id] === option.key
                          ? 'border-slate-900 bg-slate-100'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={option.key}
                        checked={answers[question.id] === option.key}
                        onChange={() =>
                          handleOptionChange(question.id, option.key)
                        }
                        className="mt-1 h-4 w-4"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Option {option.key}
                        </p>
                        <p className="text-sm text-slate-600">{option.value}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={handleSubmitQuiz}
              disabled={submitting}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>

            <button
              onClick={() => router.push(`/training/${courseId}`)}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Back to Course
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}