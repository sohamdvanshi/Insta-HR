require('dotenv').config();
const sequelize = require('./src/config/database');
const Training = require('./src/models/Training');

const courses = [
  {
    title: 'Full Stack Web Development',
    description: 'Master React, Node.js, PostgreSQL and build real-world projects from scratch.',
    category: 'IT', type: 'video', price: 4999, isFree: false,
    duration: '12 weeks', emoji: '💻', enrollmentCount: 1240, rating: 4.8,
    skills: ['React', 'Node.js', 'PostgreSQL'], status: 'active'
  },
  {
    title: 'Data Science with Python',
    description: 'Learn data analysis, machine learning and visualization using Python and real datasets.',
    category: 'IT', type: 'video', price: 3999, isFree: false,
    duration: '10 weeks', emoji: '📊', enrollmentCount: 980, rating: 4.7,
    skills: ['Python', 'Pandas', 'ML'], status: 'active'
  },
  {
    title: 'Finance & Accounting Fundamentals',
    description: 'Understand financial statements, budgeting, and accounting principles for business.',
    category: 'Finance', type: 'video', price: 0, isFree: true,
    duration: '6 weeks', emoji: '💰', enrollmentCount: 560, rating: 4.6,
    skills: ['Accounting', 'Tally', 'GST'], status: 'active'
  },
  {
    title: 'Live: Advanced React & Next.js',
    description: 'Live interactive sessions with industry experts. Build production-grade apps with Next.js 14.',
    category: 'IT', type: 'live', price: 6999, isFree: false,
    duration: '8 weeks', emoji: '🔴', enrollmentCount: 320, rating: 4.9,
    skills: ['React', 'Next.js', 'TypeScript'], status: 'active'
  },
  {
    title: 'HR Management & Recruitment',
    description: 'Learn modern HR practices, talent acquisition, performance management and labor laws.',
    category: 'HR', type: 'video', price: 2999, isFree: false,
    duration: '4 weeks', emoji: '👥', enrollmentCount: 430, rating: 4.5,
    skills: ['HR', 'Recruitment', 'Labor Law'], status: 'active'
  },
  {
    title: 'Live: Digital Marketing Masterclass',
    description: 'Live sessions covering SEO, social media marketing, paid ads and content strategy.',
    category: 'Marketing', type: 'live', price: 3499, isFree: false,
    duration: '6 weeks', emoji: '📱', enrollmentCount: 750, rating: 4.7,
    skills: ['SEO', 'Social Media', 'Google Ads'], status: 'active'
  },
  {
    title: 'AutoCAD & Civil Engineering Design',
    description: 'Master AutoCAD, structural design principles and construction project management.',
    category: 'Civil', type: 'video', price: 3999, isFree: false,
    duration: '8 weeks', emoji: '🏗️', enrollmentCount: 290, rating: 4.6,
    skills: ['AutoCAD', 'Structural Design', 'BIM'], status: 'active'
  },
  {
    title: 'Spoken English & Communication',
    description: 'Improve your English communication skills, interview confidence and professional writing.',
    category: 'Soft Skills', type: 'video', price: 0, isFree: true,
    duration: '4 weeks', emoji: '🗣️', enrollmentCount: 1850, rating: 4.8,
    skills: ['English', 'Communication', 'Interview'], status: 'active'
  },
  {
    title: 'Live: Stock Market & Trading',
    description: 'Live sessions on fundamental analysis, technical analysis and building a portfolio.',
    category: 'Finance', type: 'live', price: 4499, isFree: false,
    duration: '5 weeks', emoji: '📈', enrollmentCount: 610, rating: 4.7,
    skills: ['Trading', 'Technical Analysis', 'Portfolio'], status: 'active'
  },
];

async function seed() {
  try {
    await sequelize.authenticate();
    // Drop and recreate Trainings table cleanly
    await sequelize.query('DROP TABLE IF EXISTS "Trainings" CASCADE');
    await Training.sync({ force: true });
    await Training.bulkCreate(courses);
    console.log('✅ ' + courses.length + ' courses seeded successfully!');
    process.exit();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

seed();