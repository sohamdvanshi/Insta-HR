const fs = require('fs');
const pdf = require('pdf-parse');

const cleanExtractedText = text => {
  return String(text || '')
    .replace(/\r/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractResumeText = async filePath => {
  try {
    if (!filePath) {
      throw new Error('File path is required');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error('Resume file not found');
    }

    const fileBuffer = fs.readFileSync(filePath);
    const parsed = await pdf(fileBuffer);
    const cleanedText = cleanExtractedText(parsed.text);

    if (!cleanedText) {
      throw new Error('No text could be extracted from the resume PDF');
    }

    return cleanedText;
  } catch (error) {
    console.error('extractResumeText error:', error);
    throw new Error(error.message || 'Failed to extract resume text');
  }
};

module.exports = {
  extractResumeText
};