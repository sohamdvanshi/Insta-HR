// Profile identity, verification and uploaded asset identifiers are server-owned.
const pick = (body, fields) => Object.fromEntries(fields.filter(key => Object.hasOwn(body || {}, key)).map(key => [key, body[key]]));
const candidateFields = body => pick(body, ['firstName', 'lastName', 'headline', 'summary', 'skills', 'experience', 'education', 'currentLocation', 'expectedSalary', 'yearsOfExperience', 'isResumePublic', 'industry']);
const employerFields = body => pick(body, ['companyName', 'tagline', 'about', 'industry', 'companySize', 'website', 'email', 'phone', 'address', 'city', 'state', 'country', 'linkedinUrl', 'twitterUrl', 'foundedYear']);
module.exports = { candidateFields, employerFields };
