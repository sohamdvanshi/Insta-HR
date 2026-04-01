const normalize = value => {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

const toArray = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (error) {
      return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const includesPhrase = (text, phrase) => {
  return normalize(text).includes(normalize(phrase));
};

const findMatches = (resumeText, skills = []) => {
  return skills.filter(skill => includesPhrase(resumeText, skill));
};

const findMissing = (allSkills = [], matchedSkills = []) => {
  return allSkills.filter(skill => !matchedSkills.includes(skill));
};

const estimateExperienceYears = resumeText => {
  const text = normalize(resumeText);

  const patterns = [
    /(\d+)\+?\s+years?/g,
    /(\d+)\+?\s+yrs?/g,
    /over\s+(\d+)\s+years?/g,
    /(\d+)\s+years?\s+of\s+experience/g,
    /experience\s+of\s+(\d+)\+?\s+years?/g
  ];

  let maxYears = 0;

  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const years = parseInt(match[1], 10);
      if (!Number.isNaN(years) && years > maxYears) {
        maxYears = years;
      }
    }
  }

  return maxYears;
};

const detectEducationLevel = text => {
  const normalized = normalize(text);

  if (
    normalized.includes('phd') ||
    normalized.includes('doctorate')
  ) {
    return 'phd';
  }

  if (
    normalized.includes('master') ||
    normalized.includes('m.tech') ||
    normalized.includes('mtech') ||
    normalized.includes('mba') ||
    normalized.includes('m.sc') ||
    normalized.includes('msc')
  ) {
    return 'masters';
  }

  if (
    normalized.includes('bachelor') ||
    normalized.includes('b.tech') ||
    normalized.includes('btech') ||
    normalized.includes('b.e') ||
    normalized.includes('be ') ||
    normalized.includes('b.sc') ||
    normalized.includes('bsc') ||
    normalized.includes('degree')
  ) {
    return 'bachelors';
  }

  if (
    normalized.includes('diploma')
  ) {
    return 'diploma';
  }

  return 'unknown';
};

const educationRank = level => {
  const ranks = {
    unknown: 0,
    diploma: 1,
    bachelors: 2,
    masters: 3,
    phd: 4
  };

  return ranks[level] || 0;
};

const getEducationScore = (resumeText, minimumEducation) => {
  if (!minimumEducation) {
    return {
      score: 5,
      resumeEducation: detectEducationLevel(resumeText),
      requiredEducation: 'not_specified',
      educationMeetsRequirement: true
    };
  }

  const resumeEducation = detectEducationLevel(resumeText);
  const requiredEducation = detectEducationLevel(minimumEducation);

  const meets = educationRank(resumeEducation) >= educationRank(requiredEducation);

  return {
    score: meets ? 5 : 0,
    resumeEducation,
    requiredEducation,
    educationMeetsRequirement: meets
  };
};

const getTargetExperience = job => {
  if (job && job.minExperienceYears !== undefined && job.minExperienceYears !== null) {
    const value = Number(job.minExperienceYears);
    if (!Number.isNaN(value)) return value;
  }

  const level = normalize(job?.experienceLevel || '');

  if (level === 'intern') return 0;
  if (level === 'junior') return 1;
  if (level === 'mid') return 3;
  if (level === 'senior') return 5;

  return 0;
};

const getExperienceScore = (resumeYears, targetYears) => {
  if (targetYears <= 0) {
    return 20;
  }

  if (resumeYears >= targetYears) {
    return 20;
  }

  const ratio = resumeYears / targetYears;
  return Math.max(0, Math.round(ratio * 20));
};

const getTitleAlignmentScore = (resumeText, jobTitle) => {
  if (!jobTitle) return 0;
  return includesPhrase(resumeText, jobTitle) ? 5 : 0;
};

const decideStatus = ({ aiScore, missingRequiredSkillsCount }) => {
  if (missingRequiredSkillsCount >= 3) return 'rejected';
  if (aiScore >= 80 && missingRequiredSkillsCount <= 1) return 'shortlisted';
  if (aiScore >= 55) return 'manual_review';
  return 'rejected';
};

const buildStrengths = ({
  matchedRequiredSkills,
  matchedPreferredSkills,
  resumeYears,
  targetYears,
  educationMeetsRequirement,
  jobTitleMatched
}) => {
  const strengths = [];

  if (matchedRequiredSkills.length > 0) {
    strengths.push(`Matched ${matchedRequiredSkills.length} required skills`);
  }

  if (matchedPreferredSkills.length > 0) {
    strengths.push(`Matched ${matchedPreferredSkills.length} preferred skills`);
  }

  if (resumeYears >= targetYears && targetYears > 0) {
    strengths.push(`Meets experience target with ${resumeYears} years`);
  }

  if (educationMeetsRequirement) {
    strengths.push('Education appears to meet the job requirement');
  }

  if (jobTitleMatched) {
    strengths.push('Resume appears aligned with the target role title');
  }

  return strengths;
};

const buildConcerns = ({
  missingRequiredSkills,
  missingPreferredSkills,
  resumeYears,
  targetYears,
  educationMeetsRequirement
}) => {
  const concerns = [];

  if (missingRequiredSkills.length > 0) {
    concerns.push(`Missing ${missingRequiredSkills.length} required skills`);
  }

  if (missingPreferredSkills.length > 0) {
    concerns.push(`Missing ${missingPreferredSkills.length} preferred skills`);
  }

  if (resumeYears < targetYears) {
    concerns.push(`Estimated experience is ${resumeYears} years, target is ${targetYears} years`);
  }

  if (!educationMeetsRequirement) {
    concerns.push('Education may not meet the stated minimum requirement');
  }

  return concerns;
};

const screenResumeAgainstJob = async (resumeText, job) => {
  const requiredSkills = toArray(job?.requiredSkills);
  const preferredSkills = toArray(job?.preferredSkills);

  const matchedRequiredSkills = findMatches(resumeText, requiredSkills);
  const missingRequiredSkills = findMissing(requiredSkills, matchedRequiredSkills);

  const matchedPreferredSkills = findMatches(resumeText, preferredSkills);
  const missingPreferredSkills = findMissing(preferredSkills, matchedPreferredSkills);

  const requiredSkillScore = requiredSkills.length
    ? Math.round((matchedRequiredSkills.length / requiredSkills.length) * 55)
    : 55;

  const preferredSkillScore = preferredSkills.length
    ? Math.round((matchedPreferredSkills.length / preferredSkills.length) * 15)
    : 10;

  const resumeYears = estimateExperienceYears(resumeText);
  const targetYears = getTargetExperience(job);
  const experienceScore = getExperienceScore(resumeYears, targetYears);

  const educationResult = getEducationScore(resumeText, job?.minimumEducation || '');
  const titleAlignmentScore = getTitleAlignmentScore(resumeText, job?.title || '');
  const jobTitleMatched = titleAlignmentScore > 0;

  const aiScore = Math.min(
    100,
    requiredSkillScore +
      preferredSkillScore +
      experienceScore +
      titleAlignmentScore +
      educationResult.score
  );

  const aiStatus = decideStatus({
    aiScore,
    missingRequiredSkillsCount: missingRequiredSkills.length
  });

  const strengths = buildStrengths({
    matchedRequiredSkills,
    matchedPreferredSkills,
    resumeYears,
    targetYears,
    educationMeetsRequirement: educationResult.educationMeetsRequirement,
    jobTitleMatched
  });

  const concerns = buildConcerns({
    missingRequiredSkills,
    missingPreferredSkills,
    resumeYears,
    targetYears,
    educationMeetsRequirement: educationResult.educationMeetsRequirement
  });

  const aiSummary =
    `Matched ${matchedRequiredSkills.length}/${requiredSkills.length} required skills, ` +
    `matched ${matchedPreferredSkills.length}/${preferredSkills.length} preferred skills, ` +
    `estimated ${resumeYears} years of experience, ` +
    `target is ${targetYears} years, decision: ${aiStatus}.`;

  return {
    aiScore,
    aiStatus,
    aiSummary,
    matchedSkills: matchedRequiredSkills,
    missingSkills: missingRequiredSkills,
    aiRawResponse: {
      jobTitle: job?.title || null,
      experienceLevel: job?.experienceLevel || null,
      minExperienceYears: targetYears,
      minimumEducation: job?.minimumEducation || null,
      requiredSkills,
      preferredSkills,
      matchedRequiredSkills,
      missingRequiredSkills,
      matchedPreferredSkills,
      missingPreferredSkills,
      resumeYears,
      education: {
        resumeEducation: educationResult.resumeEducation,
        requiredEducation: educationResult.requiredEducation,
        educationMeetsRequirement: educationResult.educationMeetsRequirement
      },
      scoreBreakdown: {
        requiredSkillScore,
        preferredSkillScore,
        experienceScore,
        titleAlignmentScore,
        educationScore: educationResult.score
      },
      strengths,
      concerns
    }
  };
};

module.exports = {
  screenResumeAgainstJob
};