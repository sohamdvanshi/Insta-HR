# Insta-HR Frontend

This folder contains the **Next.js frontend application** for the Insta-HR platform.

## About Insta-HR

Insta-HR is an AI-powered job portal that connects employers and candidates with features like:

* AI-based resume screening
* Job posting and application system
* Candidate profile management
* Skill development and training modules
* Outsourcing workforce management

## Tech Stack

Frontend technologies used:

* **Next.js (App Router)**
* **React.js**
* **TypeScript**
* **Tailwind CSS**
* **REST API integration with backend**

## Project Structure

```
frontend/
│
├── app/              # Next.js App Router pages
├── components/       # Reusable UI components
├── public/           # Static assets
├── styles/           # Global styles
├── package.json      # Project dependencies
└── README.md
```

## Installation

Clone the repository:

```
git clone https://github.com/TomandJerry0811/Insta-HR.git
```

Navigate to frontend:

```
cd frontend
```

Install dependencies:

```
npm install
```

Run development server:

```
npm run dev
```

Open in browser:

```
http://localhost:3000
```

## Features (Planned)

* User authentication (JWT)
* Job listings and applications
* Resume upload and parsing
* AI-based candidate ranking
* Dashboard for employers and candidates

## Deployment

The frontend can be deployed using:

* **Vercel**
* **Netlify**
* **Docker**

## Related Modules

* `backend/` → Node.js + Express API
* `ai-engine/` → AI resume analysis and candidate ranking system
