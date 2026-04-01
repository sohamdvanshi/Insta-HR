const fs = require('fs');

let navbar = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

// Fix: wrap the two candidate links in a Fragment
navbar = navbar.replace(
  `{user?.role === 'candidate' && (
            <Link href="/applications" className="hover:text-blue-600 transition-colors">My Applications</Link>
            <Link href="/saved-jobs" className="hover:text-blue-600 transition-colors">Saved Jobs</Link>
          )}`,
  `{user?.role === 'candidate' && (
            <>
              <Link href="/applications" className="hover:text-blue-600 transition-colors">My Applications</Link>
              <Link href="/saved-jobs" className="hover:text-blue-600 transition-colors">Saved Jobs</Link>
            </>
          )}`
);

// Fix mobile nav too if same issue exists
navbar = navbar.replace(
  `{user?.role === 'candidate' && (
          <Link href="/applications" className="text-gray-700 font-medium">My Applications</Link>
          <Link href="/saved-jobs" className="text-gray-700 font-medium">Saved Jobs</Link>
          )}`,
  `{user?.role === 'candidate' && (
            <>
              <Link href="/applications" className="text-gray-700 font-medium">My Applications</Link>
              <Link href="/saved-jobs" className="text-gray-700 font-medium">Saved Jobs</Link>
            </>
          )}`
);

fs.writeFileSync('src/components/Navbar.tsx', navbar);
console.log('✅ Navbar JSX fixed!');