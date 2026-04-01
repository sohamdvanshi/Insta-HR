const fs = require('fs');

let navbar = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

// Find line 119-122 area and fix it - the mobile nav candidate section
// Replace any variant of the broken pattern
const broken = navbar.match(/\{user\?\.role === 'candidate' && \(\s*<Link href="\/applications"[^>]*>My Applications<\/Link>\s*<Link href="\/saved-jobs"[^>]*>Saved Jobs<\/Link>\s*\)\}/);

if (broken) {
  navbar = navbar.replace(broken[0], `{user?.role === 'candidate' && (
            <>
              <Link href="/applications" className="text-gray-700 font-medium">My Applications</Link>
              <Link href="/saved-jobs" className="text-gray-700 font-medium">Saved Jobs</Link>
            </>
          )}`);
  console.log('✅ Mobile nav fixed with regex match');
} else {
  // Manual line-by-line fix
  const lines = navbar.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('/applications') && lines[i].includes('text-gray-700') && 
        lines[i+1] && lines[i+1].includes('/saved-jobs')) {
      // Found the problematic area - check if already wrapped
      if (!lines[i-1].includes('<>')) {
        // Find the opening ( line
        for (let j = i - 1; j >= 0; j--) {
          if (lines[j].includes("role === 'candidate'")) {
            lines[j] = lines[j].replace('(', '(<>');
            break;
          }
        }
        // Find the closing ) line
        for (let j = i + 2; j < lines.length; j++) {
          if (lines[j].trim() === ')}') {
            lines[j] = lines[j].replace(')}', '</>)}');
            break;
          }
        }
        console.log('✅ Mobile nav fixed with line fix at line', i+1);
      }
      break;
    }
  }
  navbar = lines.join('\n');
}

fs.writeFileSync('src/components/Navbar.tsx', navbar);

// Verify no more bare sibling Links
const remaining = navbar.match(/<Link[^>]*>[^<]*<\/Link>\s*\n\s*<Link/g);
if (remaining) {
  console.log('⚠️  Still found sibling Links - printing lines around issue:');
  navbar.split('\n').forEach((line, i) => {
    if (line.includes('saved-jobs') || line.includes('applications')) {
      console.log(`Line ${i+1}: ${line}`);
    }
  });
} else {
  console.log('✅ All sibling Link issues resolved!');
}