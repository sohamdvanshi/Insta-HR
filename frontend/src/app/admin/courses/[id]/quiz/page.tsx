'use client'
import { API_BASE } from '@/lib/api'
import { tr, trError, useLocale } from '@/lib/localization'


import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'


type Question = {
  question: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: 'A' | 'B' | 'C' | 'D'
  marks: number
  sortOrder: number
}

export default function AdminCourseQuizPage() {
  useLocale()

  const params = useParams()
  const router = useRouter()
  const courseId = params?.id as string

  const [isTrainer, setIsTrainer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [course, setCourse] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [title, setTitle] = useState('Final Course Quiz')
  const [description, setDescription] = useState('')
  const [passPercentage, setPassPercentage] = useState(70)
  const [questions, setQuestions] = useState<Question[]>([
    {
      question: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctOption: 'A',
      marks: 1,
      sortOrder: 1
    }
  ])

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (!user) {
      router.replace('/login')
      return
    }

    const parsed = JSON.parse(user)
    if (!['admin', 'super_admin', 'trainer'].includes(parsed.role)) {
      router.replace('/dashboard')
      return
    }

    setIsTrainer(parsed.role === 'trainer')
    if (!courseId) return
    fetchCourseAndQuiz()
  }, [courseId, router])

  const getToken = () => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('token')
  }

  const fetchCourseAndQuiz = async () => {
    try {
      setLoading(true)
      setError('')

      const token = getToken()

      const courseRes = await fetch(API_BASE + '/training/' + courseId, {
        headers: {
          Authorization: 'Bearer ' + token
        }
      })
      const courseData = await courseRes.json()

      if (courseData.success) {
        setCourse(courseData.data)
      }

      const quizRes = await fetch(API_BASE + '/training/' + courseId + '/quiz/admin', {
        headers: {
          Authorization: 'Bearer ' + token
        }
      })

      const quizData = await quizRes.json()
      if (quizRes.status === 401 || quizRes.status === 403) { setCourse(null); setError(quizData.message || 'Access denied'); return }

      if (quizRes.ok && quizData.success && quizData.data) {
        setTitle(quizData.data.title || 'Final Course Quiz')
        setDescription(quizData.data.description || '')
        setPassPercentage(Number(quizData.data.passPercentage || 70))

        if (Array.isArray(quizData.data.questions) && quizData.data.questions.length > 0) {
          setQuestions(
            quizData.data.questions.map((q: any, index: number) => ({
              question: q.question || '',
              optionA: q.optionA || '',
              optionB: q.optionB || '',
              optionC: q.optionC || '',
              optionD: q.optionD || '',
              correctOption: q.correctOption || 'A',
              marks: Number(q.marks || 1),
              sortOrder: Number(q.sortOrder || index + 1)
            }))
          )
        }
      }
    } catch {
      setError('Failed to load quiz data')
    } finally {
      setLoading(false)
    }
  }

  const handleQuestionChange = (
    index: number,
    field: keyof Question,
    value: string | number
  ) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index
          ? {
              ...q,
              [field]: value
            }
          : q
      )
    )
  }

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        question: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctOption: 'A',
        marks: 1,
        sortOrder: prev.length + 1
      }
    ])
  }

  const removeQuestion = (index: number) => {
    if (questions.length === 1) return

    const updated = questions
      .filter((_, i) => i !== index)
      .map((q, i) => ({
        ...q,
        sortOrder: i + 1
      }))

    setQuestions(updated)
  }

  const validateForm = () => {
    if (!title.trim()) {
      setError('Quiz title is required')
      return false
    }

    if (!questions.length) {
      setError('At least one question is required')
      return false
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]

      if (!q.question.trim()) {
        setError(`Question ${i + 1} is required`)
        return false
      }

      if (!q.optionA.trim() || !q.optionB.trim() || !q.optionC.trim() || !q.optionD.trim()) {
        setError(`All options are required for question ${i + 1}`)
        return false
      }
    }

    return true
  }

  const handleSaveQuiz = async () => {
    try {
      setError('')
      setMessage('')

      if (!validateForm()) return

      setSaving(true)

      const token = getToken()

      const payload = {
        title,
        description,
        passPercentage: Number(passPercentage),
        isActive: true,
        questions: questions.map((q, index) => ({
          ...q,
          marks: Number(q.marks || 1),
          sortOrder: index + 1
        }))
      }

      const res = await fetch(API_BASE + '/training/' + courseId + '/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to save quiz')
      }

      setMessage('Quiz saved successfully')
    } catch (err: any) {
      setError(err.message || 'Failed to save quiz')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteQuiz = async () => {
    const confirmed = window.confirm('Are you sure you want to delete this quiz?')
    if (!confirmed) return

    try {
      setError('')
      setMessage('')

      const token = getToken()

      const res = await fetch(API_BASE + '/training/' + courseId + '/quiz', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + token
        }
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete quiz')
      }

      setMessage('Quiz deleted successfully')
      setTitle('Final Course Quiz')
      setDescription('')
      setPassPercentage(70)
      setQuestions([
        {
          question: '',
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: '',
          correctOption: 'A',
          marks: 1,
          sortOrder: 1
        }
      ])
    } catch (err: any) {
      setError(err.message || 'Failed to delete quiz')
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 px-6">
        <div className="max-w-5xl mx-auto bg-white rounded-2xl p-6 shadow-sm">
          <p className="text-gray-500">{tr("Loading quiz editor...")}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <Link
            href={isTrainer ? '/trainer/courses' : '/admin/courses'}
            className="text-sm text-blue-600 hover:underline"
          >{tr("← Back to Courses")}</Link>

          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{tr("Manage Course Quiz")}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {course?.title || 'Course'}{tr(" — create or update the final quiz")}</p>
            </div>

            <button
              onClick={() => router.push('/training/' + courseId)}
              className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >{tr("Preview Course")}</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
          <h2 className="text-lg font-bold text-gray-900">{tr("Quiz Settings")}</h2>

          {message && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              {tr(message)}
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {trError(error)}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Quiz Title")}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                placeholder={tr("Final Course Quiz")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Pass Percentage")}</label>
              <input
                type="number"
                min="1"
                max="100"
                value={passPercentage}
                onChange={(e) => setPassPercentage(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              placeholder={tr("Answer all questions carefully")}
            />
          </div>
        </div>

        <div className="space-y-5">
          {questions.map((question, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900">{tr("Question ")}{index + 1}
                </h3>

                {questions.length > 1 && (
                  <button
                    onClick={() => removeQuestion(index)}
                    className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100"
                  >{tr("Remove")}</button>
                )}
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Question Text")}</label>
                  <textarea
                    value={question.question}
                    onChange={(e) =>
                      handleQuestionChange(index, 'question', e.target.value)
                    }
                    rows={3}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                    placeholder={tr("Enter the question")}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Option A")}</label>
                    <input
                      type="text"
                      value={question.optionA}
                      onChange={(e) =>
                        handleQuestionChange(index, 'optionA', e.target.value)
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Option B")}</label>
                    <input
                      type="text"
                      value={question.optionB}
                      onChange={(e) =>
                        handleQuestionChange(index, 'optionB', e.target.value)
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Option C")}</label>
                    <input
                      type="text"
                      value={question.optionC}
                      onChange={(e) =>
                        handleQuestionChange(index, 'optionC', e.target.value)
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Option D")}</label>
                    <input
                      type="text"
                      value={question.optionD}
                      onChange={(e) =>
                        handleQuestionChange(index, 'optionD', e.target.value)
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Correct Option")}</label>
                    <select
                      value={question.correctOption}
                      onChange={(e) =>
                        handleQuestionChange(
                          index,
                          'correctOption',
                          e.target.value as 'A' | 'B' | 'C' | 'D'
                        )
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                    >
                      <option value="A">{tr("Option A")}</option>
                      <option value="B">{tr("Option B")}</option>
                      <option value="C">{tr("Option C")}</option>
                      <option value="D">{tr("Option D")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Marks")}</label>
                    <input
                      type="number"
                      min="1"
                      value={question.marks}
                      onChange={(e) =>
                        handleQuestionChange(index, 'marks', Number(e.target.value))
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addQuestion}
            className="w-full rounded-2xl border-2 border-dashed border-blue-300 py-4 text-blue-600 font-semibold hover:bg-blue-50"
          >{tr("+ Add Another Question")}</button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSaveQuiz}
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {tr(saving ? 'Saving...' : 'Save Quiz')}
            </button>

            <button
              onClick={handleDeleteQuiz}
              className="px-6 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700"
            >{tr("Delete Quiz")}</button>

            <button
              onClick={() => router.push('/admin/courses')}
              className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
            >{tr("Back to Courses")}</button>
          </div>
        </div>
      </div>
    </main>
  )
}