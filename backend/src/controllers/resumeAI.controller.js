const { Groq } = require('groq-sdk')

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

const clean = (value) => String(value || '').trim()

const getGroqClient = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is missing in backend environment')
  }

  return new Groq({
    apiKey: process.env.GROQ_API_KEY
  })
}

const safeJsonParse = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const buildResumeContext = (payload = {}) => {
  const {
    personalInfo = {},
    experience = [],
    education = [],
    projects = [],
    skills = [],
    certifications = [],
    languages = [],
    targetJobTitle = '',
    targetJobDescription = ''
  } = payload

  return {
    personalInfo,
    experience,
    education,
    projects,
    skills,
    certifications,
    languages,
    targetJobTitle,
    targetJobDescription
  }
}

const generateResumeSummary = async (req, res) => {
  try {
    const client = getGroqClient()
    const context = buildResumeContext(req.body)

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an expert resume writer. Return ONLY valid JSON. No markdown. No explanation. No extra keys. Return exactly this shape: {"summary":"string","keywordsUsed":["string"]}. Write a concise ATS-friendly professional summary tailored to the target role if provided. Keep it factual and do not invent metrics, employers, certifications, or tools.'
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Generate a professional summary for this resume.',
            rules: [
              'Keep it between 55 and 95 words',
              'Use natural ATS keywords where relevant',
              'Be concise, strong, and specific',
              'Do not exaggerate or fabricate facts'
            ],
            resume: context
          })
        }
      ]
    })

    const text = completion.choices?.[0]?.message?.content || '{}'
    const parsed = safeJsonParse(text)

    if (!parsed || typeof parsed.summary !== 'string') {
      throw new Error('Invalid JSON returned for resume summary')
    }

    return res.status(200).json({
      success: true,
      message: 'Resume summary generated successfully',
      data: {
        summary: parsed.summary,
        keywordsUsed: Array.isArray(parsed.keywordsUsed) ? parsed.keywordsUsed : []
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate resume summary'
    })
  }
}

const generateExperienceBullets = async (req, res) => {
  try {
    const client = getGroqClient()

    const {
      experienceItem = {},
      skills = [],
      targetJobTitle = '',
      targetJobDescription = ''
    } = req.body

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an expert resume writer. Return ONLY valid JSON. No markdown. No explanation. No extra keys. Return exactly this shape: {"bullets":["string"],"keywordsUsed":["string"]}. Rewrite one experience entry into strong ATS-friendly bullet points. Each bullet must start with a strong action verb. Do not invent fake numbers, tools, technologies, or achievements.'
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Generate 3 to 5 strong resume bullet points for one experience entry.',
            rules: [
              'Each bullet should be concise and resume-friendly',
              'Highlight ownership, execution, process, collaboration, tools, and outcomes where supported',
              'Tailor to the target role if provided',
              'Do not fabricate measurable results unless clearly supported by the input'
            ],
            experienceItem,
            skills,
            targetJobTitle,
            targetJobDescription
          })
        }
      ]
    })

    const text = completion.choices?.[0]?.message?.content || '{}'
    const parsed = safeJsonParse(text)

    if (!parsed || !Array.isArray(parsed.bullets)) {
      throw new Error('Invalid JSON returned for experience bullets')
    }

    return res.status(200).json({
      success: true,
      message: 'Experience bullets generated successfully',
      data: {
        bullets: parsed.bullets,
        keywordsUsed: Array.isArray(parsed.keywordsUsed) ? parsed.keywordsUsed : []
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate experience bullets'
    })
  }
}

const generateATSOptimization = async (req, res) => {
  try {
    const client = getGroqClient()
    const context = buildResumeContext(req.body)

    if (!clean(context.targetJobTitle) && !clean(context.targetJobDescription)) {
      return res.status(400).json({
        success: false,
        message: 'Target job title or job description is required for ATS optimization'
      })
    }

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an ATS resume optimizer. Return ONLY valid JSON. No markdown. No explanation. No extra keys. Return exactly this shape: {"topKeywords":["string"],"missingKeywords":["string"],"recommendedSkills":["string"],"summarySuggestions":["string"],"bulletSuggestions":["string"]}. Extract role-specific keywords from the target role and compare them against the resume. Keep suggestions practical and specific.'
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Analyze this resume against the target role and provide ATS optimization suggestions.',
            rules: [
              'Prioritize role title, tools, frameworks, platforms, methods, domain terms, and certifications',
              'List missing or underrepresented keywords only if relevant',
              'Keep suggestions practical and concise',
              'Avoid generic filler advice when specific advice is possible'
            ],
            resume: context
          })
        }
      ]
    })

    const text = completion.choices?.[0]?.message?.content || '{}'
    const parsed = safeJsonParse(text)

    if (!parsed) {
      throw new Error('Invalid JSON returned for ATS optimization')
    }

    return res.status(200).json({
      success: true,
      message: 'ATS suggestions generated successfully',
      data: {
        topKeywords: Array.isArray(parsed.topKeywords) ? parsed.topKeywords : [],
        missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
        recommendedSkills: Array.isArray(parsed.recommendedSkills) ? parsed.recommendedSkills : [],
        summarySuggestions: Array.isArray(parsed.summarySuggestions) ? parsed.summarySuggestions : [],
        bulletSuggestions: Array.isArray(parsed.bulletSuggestions) ? parsed.bulletSuggestions : []
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate ATS suggestions'
    })
  }
}

module.exports = {
  generateResumeSummary,
  generateExperienceBullets,
  generateATSOptimization
}