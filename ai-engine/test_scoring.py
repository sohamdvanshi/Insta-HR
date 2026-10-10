"""Pure scoring regression tests; the FastAPI app registration is stubbed, no server runs."""
import importlib.util
from pathlib import Path
import sys
import types
import unittest

# FastAPI isn't needed to validate these deterministic scoring functions.
class App:
    def add_middleware(self, *args, **kwargs): pass
    def get(self, *args, **kwargs): return lambda fn: fn
    def post(self, *args, **kwargs): return lambda fn: fn
fastapi = types.ModuleType('fastapi')
fastapi.FastAPI = App
cors = types.ModuleType('fastapi.middleware.cors')
cors.CORSMiddleware = object
sys.modules['fastapi'] = fastapi
sys.modules['fastapi.middleware'] = types.ModuleType('fastapi.middleware')
sys.modules['fastapi.middleware.cors'] = cors
spec = importlib.util.spec_from_file_location('audit_ai', Path(__file__).with_name('main.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ScoringTests(unittest.TestCase):
    def test_skill_names_require_boundaries(self):
        skills = module.extract_skills('JavaScript, C++, C#, Python and machine learning')
        self.assertIn('javascript', skills)
        self.assertIn('c++', skills)
        self.assertIn('c#', skills)
        self.assertNotIn('java', skills)
        self.assertNotIn('php', module.extract_skills('phpunit'))

    def test_profile_text_and_nullable_names_are_used(self):
        blank = module.calculate_match_score(['python'], 'python engineer', 0, {'skills': ['Python']})
        filled = module.calculate_match_score(['python'], 'python engineer', 0, {'skills': ['Python'], 'summary': 'Python engineer', 'firstName': None, 'lastName': None})
        self.assertGreater(filled['matchScore'], blank['matchScore'])
        self.assertEqual(filled['name'], '')

    def test_fractional_experience_requirement_is_preserved(self):
        request = module.MatchRequest(job_skills=['python'], job_description='engineer', job_experience_min=1.5, candidates=[])
        self.assertEqual(request.job_experience_min, 1.5)
        score = module.calculate_match_score(['python'], 'engineer', request.job_experience_min, {'skills': ['python'], 'yearsOfExperience': 1})
        self.assertAlmostEqual(score['expScore'], 66.7, places=1)

if __name__ == '__main__': unittest.main()
