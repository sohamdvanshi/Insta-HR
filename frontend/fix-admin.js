const fs = require('fs');
let content = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

// Remove old duplicate manage buttons block
content = content.replace(`              <div className="flex flex-wrap gap-3 mb-6">
              <a href="/admin/courses" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">📚 Manage Courses</a>
              <a href="/post-job" className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700">➕ Post Job</a>
              <a href="/subscription" className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700">💳 Pricing Plans</a>
            </div>
            <h2 className="font-bold text-gray-900 mb-4 text-lg">Platform Overview</h2>
            <div className="flex flex-wrap gap-3 mb-6">
              <a href="/admin/courses" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">📚 Manage Courses</a>
              <a href="/post-job" className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700">➕ Post Job</a>
              <a href="/subscription" className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700">💳 Pricing Plans</a>
            </div>`,
  `              <h2 className="font-bold text-gray-900 mb-4 text-lg">Platform Overview</h2>
            <div className="flex flex-wrap gap-3 mb-6">
              <a href="/admin/courses" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">📚 Manage Courses</a>
              <a href="/post-job" className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700">➕ Post Job</a>
              <a href="/subscription" className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700">💳 Pricing Plans</a>
            </div>`);

fs.writeFileSync('src/app/admin/page.tsx', content);
console.log('Fixed!');