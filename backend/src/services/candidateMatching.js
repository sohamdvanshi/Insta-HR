const strings = value => Array.isArray(value) ? value.filter(v => typeof v === 'string').map(v => v.trim()).filter(Boolean) : [];
const words = value => new Set(String(value || '').toLowerCase().match(/[\p{L}\p{N}_]+/gu) || []);
const round = value => Math.round(value * 10) / 10;
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function basicMatch(job, candidate) {
  const required = [...new Set(strings(job.requiredSkills).map(s => s.toLowerCase()))];
  const listed = new Set(strings(candidate.skills).map(s => s.toLowerCase()));
  const resumeText = [candidate.resumeText, candidate.summary, candidate.headline, ...(candidate.experience || []).map(e => [e?.title, e?.jobTitle, e?.company, e?.description].filter(Boolean).join(' '))].filter(Boolean).join(' ').toLowerCase();
  const matchedSkills = required.filter(skill => listed.has(skill) || new RegExp(`(?<![\\w+#.])${escape(skill)}(?![\\w+#.])`, 'i').test(resumeText));
  const missingSkills = required.filter(skill => !matchedSkills.includes(skill));
  const skillScore = required.length ? matchedSkills.length / required.length * 100 : 0;
  const minimum = Math.max(0, Number(job.minExperienceYears) || 0), experience = Math.max(0, Number(candidate.yearsOfExperience) || 0);
  const expScore = minimum === 0 ? 100 : Math.min(100, experience / minimum * 100);
  const jobWords = words(job.description), resumeWords = words(resumeText);
  const textScore = jobWords.size ? [...jobWords].filter(word => resumeWords.has(word)).length / jobWords.size * 100 : 0;
  return { candidateId: candidate.userId, name: [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || candidate.email || '', matchScore: round(skillScore * 0.4 + expScore * 0.3 + textScore * 0.3), skillScore: round(skillScore), expScore: round(expScore), matchedSkills, missingSkills };
}
async function matchCandidates(job, candidates, { timeoutMs = 4000 } = {}) {
  const addApplication = match => {
    const candidate = candidates.find(c => String(c.userId) === String(match.candidateId));
    return { ...match, applicationId: candidate?.applicationId || null, applicationStatus: candidate?.applicationStatus || null };
  };
  if (!candidates.length) return { data: [], matchingMode: 'basic' };
  const results = [];
  try {
    const url = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');
    for (let offset = 0; offset < candidates.length; offset += 250) {
      const batch = candidates.slice(offset, offset + 250);
      const response = await fetch(`${url}/match-candidates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({ job_skills: strings(job.requiredSkills), job_description: job.description || '', job_experience_min: Number(job.minExperienceYears) || 0,
          candidates: batch.map(({ userId, firstName, lastName, skills, yearsOfExperience, summary, headline, experience, resumeText }) => ({ userId, firstName, lastName, skills, yearsOfExperience, summary, headline, experience, resumeText })) })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json(), ids = new Set(batch.map(c => String(c.userId)));
      if (!body.success || !Array.isArray(body.data) || body.data.length !== batch.length) throw new Error('Incomplete AI response');
      for (const match of body.data) {
        if (!ids.delete(String(match.candidateId)) || ['matchScore', 'skillScore', 'expScore'].some(key => typeof match[key] !== 'number' || !Number.isFinite(match[key]) || match[key] < 0 || match[key] > 100)) throw new Error('Invalid AI scores');
        const candidate = batch.find(c => String(c.userId) === String(match.candidateId));
        results.push({ ...basicMatch(job, candidate), matchScore: match.matchScore, skillScore: match.skillScore, expScore: match.expScore, matchedSkills: strings(match.matchedSkills), missingSkills: strings(match.missingSkills) });
      }
    }
    return { data: results.map(addApplication).sort((a, b) => b.matchScore - a.matchScore), matchingMode: 'ai' };
  } catch (error) {
    console.warn('AI matching unavailable; using basic matching:', error.name);
    return { data: candidates.map(c => addApplication(basicMatch(job, c))).sort((a, b) => b.matchScore - a.matchScore), matchingMode: 'basic', fallback: true };
  }
}
module.exports = { matchCandidates, basicMatch };
