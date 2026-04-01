from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Skills list
SKILLS = [
    "python", "javascript", "react", "node.js", "nodejs", "java", "c++", "c#",
    "php", "ruby", "swift", "kotlin", "flutter", "dart", "typescript",
    "html", "css", "tailwind", "bootstrap", "vue", "angular",
    "sql", "postgresql", "mysql", "mongodb", "redis", "firebase",
    "aws", "azure", "docker", "kubernetes", "git", "linux",
    "machine learning", "deep learning", "tensorflow", "pytorch",
    "data analysis", "power bi", "tableau", "excel",
    "project management", "agile", "scrum", "jira",
    "finance", "accounting", "tally", "sap",
    "autocad", "solidworks", "catia", "ansys",
    "civil engineering", "structural", "construction",
    "electrical", "mechanical", "automation", "plc", "scada"
]

class MatchRequest(BaseModel):
    job_skills: List[str]
    job_description: str
    job_experience_min: int
    candidates: List[dict]

class KeywordRequest(BaseModel):
    text: str

def extract_skills(text: str) -> List[str]:
    text_lower = text.lower()
    found = []
    for skill in SKILLS:
        if skill in text_lower:
            found.append(skill)
    return found

def calculate_match_score(job_skills, job_desc, job_exp_min, candidate):
    score = 0
    matched_skills = []
    missing_skills = []

    # Skill matching (40%)
    candidate_skills = [s.lower() for s in (candidate.get("skills") or [])]
    job_skills_lower = [s.lower() for s in job_skills]

    for skill in job_skills_lower:
        if skill in candidate_skills:
            matched_skills.append(skill)
        else:
            missing_skills.append(skill)

    skill_score = (len(matched_skills) / len(job_skills_lower) * 100) if job_skills_lower else 0

    # Experience matching (30%)
    candidate_exp = float(candidate.get("yearsOfExperience") or 0)
    if candidate_exp >= job_exp_min:
        exp_score = 100
    elif candidate_exp > 0:
        exp_score = (candidate_exp / job_exp_min) * 100
    else:
        exp_score = 0

    # Text matching (30%)
    resume_text = (candidate.get("resumeText") or "").lower()
    job_words = set(re.findall(r'\w+', job_desc.lower()))
    resume_words = set(re.findall(r'\w+', resume_text))
    common = job_words.intersection(resume_words)
    text_score = (len(common) / len(job_words) * 100) if job_words else 0

    # Final score
    final_score = (skill_score * 0.4) + (exp_score * 0.3) + (text_score * 0.3)

    return {
        "candidateId": candidate.get("userId"),
        "name": f"{candidate.get('firstName', '')} {candidate.get('lastName', '')}".strip(),
        "matchScore": round(final_score, 1),
        "skillScore": round(skill_score, 1),
        "expScore": round(exp_score, 1),
        "matchedSkills": matched_skills,
        "missingSkills": missing_skills
    }

@app.get("/")
def root():
    return {"message": "InstaHire AI Engine Running! 🤖"}

@app.post("/match-candidates")
def match_candidates(req: MatchRequest):
    results = []
    for candidate in req.candidates:
        result = calculate_match_score(
            req.job_skills,
            req.job_description,
            req.job_experience_min,
            candidate
        )
        results.append(result)

    results.sort(key=lambda x: x["matchScore"], reverse=True)
    return {"success": True, "data": results}

@app.post("/extract-keywords")
def extract_keywords(req: KeywordRequest):
    skills = extract_skills(req.text)
    return {"success": True, "skills": skills}
