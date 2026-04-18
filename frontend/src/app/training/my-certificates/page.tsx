
'use client'


import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'


export default function MyCertificatesPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<any[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, any>>({})
  const [certificateMap, setCertificateMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')


  useEffect(() => {
    const token = localStorage.getItem('token')


    if (!token) {
      router.push('/login')
      return
    }


    const fetchCertificates = async () => {
      try {
        const enrolledRes = await fetch('http://localhost:5000/api/v1/training/my/enrolled', {
          headers: {
            Authorization: 'Bearer ' + token
          }
        })


        const enrolledData = await enrolledRes.json()


        if (!enrolledData.success) {
          setError(enrolledData.message || 'Failed to load certificates')
          setLoading(false)
          return
        }


        const enrolledCourses = enrolledData.data || []
        setCourses(enrolledCourses)


        const progressResults: Record<string, any> = {}
        const certificateResults: Record<string, any> = {}


        await Promise.all(
          enrolledCourses.map(async (course: any) => {
            try {
              const progressRes = await fetch(
                'http://localhost:5000/api/v1/training/' + course.id + '/progress',
                {
                  headers: {
                    Authorization: 'Bearer ' + token
                  }
                }
              )


              const progressData = await progressRes.json()


              if (progressData.success) {
                progressResults[course.id] = progressData.data


                if (progressData.data?.completed) {
                  const certRes = await fetch(
                    'http://localhost:5000/api/v1/training/' + course.id + '/certificate',
                    {
                      headers: {
                        Authorization: 'Bearer ' + token
                      }
                    }
                  )


                  const certData = await certRes.json()


                  if (certData.success) {
                    certificateResults[course.id] = certData.data
                  }
                }
              }
            } catch {
            }
          })
        )


        setProgressMap(progressResults)
        setCertificateMap(certificateResults)
      } catch {
        setError('Failed to load certificates')
      } finally {
        setLoading(false)
      }
    }


    fetchCertificates()
  }, [router])


  const completedCourses = courses.filter((course) => {
    return !!certificateMap[course.id]
  })


  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">Loading your certificates...</p>
      </main>
    )
  }


  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 py-14 px-6">
        <div className="max-w-6xl mx-auto">
          <Link href="/training/my-learning" className="text-white/70 hover:text-white text-sm mb-4 inline-block">
            ← Back to My Learning
          </Link>


          <h1 className="text-4xl font-bold text-white mb-3">My Certificates</h1>
          <p className="text-green-100 text-lg mb-8">
            View and verify your earned course completion certificates
          </p>


          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-2xl p-5">
              <div className="text-2xl font-bold text-white">{completedCourses.length}</div>
              <div className="text-green-100 text-sm">Certificates Earned</div>
            </div>
            <div className="bg-white/10 rounded-2xl p-5">
              <div className="text-2xl font-bold text-white">{courses.length}</div>
              <div className="text-green-100 text-sm">Enrolled Courses</div>
            </div>
            <div className="bg-white/10 rounded-2xl p-5">
              <div className="text-2xl font-bold text-white">
                {courses.length - completedCourses.length}
              </div>
              <div className="text-green-100 text-sm">Still In Progress</div>
            </div>
          </div>
        </div>
      </div>


      <div className="max-w-6xl mx-auto px-6 py-10">
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl mb-6 border border-red-200">
            {error}
          </div>
        )}


        {completedCourses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No certificates earned yet</h2>
            <p className="text-gray-500 mb-6">
              Complete at least one course to generate your first certificate.
            </p>
            <Link
              href="/training/my-learning"
              className="inline-block px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors"
            >
              Continue Learning
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {completedCourses.map((course) => {
              const cert = certificateMap[course.id]
              const progress = progressMap[course.id]


              return (
                <div
                  key={course.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-5xl">🏆</div>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold">
                        Completed
                      </span>
                    </div>


                    <h2 className="text-xl font-bold mb-2">{course.title}</h2>
                    <p className="text-green-50 text-sm">{course.category || 'General'}</p>
                  </div>


                  <div className="p-6">
                    <div className="space-y-3 mb-5 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-500">Completion Date</span>
                        <span className="font-medium text-gray-900 text-right">
                          {cert?.completionDate
                            ? new Date(cert.completionDate).toLocaleDateString()
                            : '-'}
                        </span>
                      </div>


                      <div className="flex justify-between gap-4">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-medium text-gray-900">
                          {Math.round(Number(progress?.progressPercent || 0))}%
                        </span>
                      </div>


                      <div className="flex justify-between gap-4">
                        <span className="text-gray-500">Certificate ID</span>
                        <span className="font-medium text-gray-900 text-right break-all">
                          {cert?.certificateId}
                        </span>
                      </div>
                    </div>


                    {cert?.skills?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-5">
                        {cert.skills.slice(0, 4).map((skill: string) => (
                          <span
                            key={skill}
                            className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}


                    <div className="grid grid-cols-1 gap-3">
                      <Link
                        href={'/training/' + course.id + '/certificate'}
                        className="block w-full py-3 bg-green-600 text-white font-semibold rounded-xl text-center hover:bg-green-700 transition-colors"
                      >
                        View Certificate
                      </Link>


                      <Link
                        href={
                          '/training/certificate/verify?certificateId=' +
                          encodeURIComponent(cert.certificateId)
                        }
                        className="block w-full py-3 bg-white text-green-700 font-semibold rounded-xl text-center border border-green-200 hover:bg-green-50 transition-colors"
                      >
                        Verify Certificate
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

