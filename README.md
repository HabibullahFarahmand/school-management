# 🏫 EduCore — School Management System

A full-stack School Management System with:
- **Authentication** (admin, teacher, student roles)
- **Student & Teacher Management**
- **Classes & Subjects**
- **Attendance Tracking**
- **Grades & Report Cards**
- **Fee Management**
- **Announcements**
- **Timetable Builder**

Built with: **Node.js + Express + SQLite (better-sqlite3) + Vanilla JS**

---

## 🚀 Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open browser
# http://localhost:3000
```

**Default Accounts:**
| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Teacher | `smith` | `teacher123` |
| Student | `alice` | `student123` |

---

## ☁️ Deployment Guide

### Option 1: Railway (Recommended - Free Tier)
Railway is the easiest way to deploy a Node.js app with a persistent filesystem.

1. **Create account** at [railway.app](https://railway.app)
2. **Push code to GitHub** (see GitHub setup below)
3. On Railway: **New Project → Deploy from GitHub repo**
4. Railway auto-detects Node.js and runs `npm start`
5. Set environment variables (optional):
   - `SESSION_SECRET` = any long random string
   - `PORT` = Railway sets this automatically
6. ✅ Your app is live at the Railway URL!

> **Note:** Railway's free tier includes persistent disk. Your SQLite database will survive restarts.

---

### Option 2: Render (Free Tier)
1. **Create account** at [render.com](https://render.com)
2. **New → Web Service → Connect GitHub repo**
3. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** Node
4. Add environment variable: `SESSION_SECRET=your-secret-key`
5. ✅ Deploy!

> **Warning:** Render's free tier has a 15-minute sleep. Use a paid plan or Railway for always-on.

---

### Option 3: Fly.io (Free Tier)
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch (from project folder)
fly launch

# Deploy
fly deploy
```

Create `fly.toml` in project root:
```toml
app = "your-school-app-name"
primary_region = "iad"

[build]
  builder = "heroku/buildpacks:20"

[http_service]
  internal_port = 3000
  force_https = true

[mounts]
  source = "school_data"
  destination = "/data"
```

And update `server.js` DB_PATH: `process.env.DB_PATH || '/data/school.db'`

---

### Option 4: GitHub Pages + Backend Split
> GitHub Pages only hosts static files (no Node.js). Use this for frontend-only demos.
> For a full app, use Railway/Render above.

---

## 📤 GitHub Setup

```bash
# In the project folder:
git init
git add .
git commit -m "Initial commit: EduCore School Management System"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/school-management.git
git branch -M main
git push -u origin main
```

---

## 🔒 Production Security Checklist

Before going live, update these in `server.js`:

```javascript
// 1. Use environment variable for session secret
secret: process.env.SESSION_SECRET || 'change-this-in-production',

// 2. Set secure cookies for HTTPS
cookie: { secure: process.env.NODE_ENV === 'production', maxAge: ... }
```

Change all default passwords immediately after first login.

---

## 📁 Project Structure

```
school-management/
├── server.js           # Express server entry point
├── package.json
├── db/
│   └── database.js     # SQLite schema + seeding
├── routes/
│   ├── auth.js         # Login/logout endpoints
│   └── api.js          # All data API endpoints
├── public/
│   └── index.html      # Full SPA frontend
└── school.db           # SQLite database (auto-created)
```

---

## 🛠️ Customization

**Add new fields:** Edit `db/database.js` schema and corresponding API routes.
**Change colors/theme:** Edit CSS variables in `public/index.html` `:root {}`.
**Add new pages:** Add a nav entry in `NAV_CONFIG` and a render function in the JS.

---

## 📊 Database Tables

| Table | Description |
|-------|-------------|
| `users` | All users (admin/teacher/student) |
| `students` | Student profiles linked to users |
| `classes` | Classes/sections |
| `subjects` | Subjects per class |
| `attendance` | Daily attendance records |
| `grades` | Exam grades |
| `fees` | Fee tracking |
| `announcements` | School announcements |
| `timetable` | Weekly schedule |
