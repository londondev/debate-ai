# Debate AI - Command Reference

## 📋 Table of Contents
- [Development Commands](#development-commands)
- [Git Commands](#git-commands)
- [Deployment Commands](#deployment-commands)
- [Firebase Commands](#firebase-commands)
- [Debug Commands](#debug-commands)
- [Build & Test Commands](#build--test-commands)
- [Environment Setup](#environment-setup)

---

## 🛠️ Development Commands

### Start Development Server
```bash
npm run dev
# Starts Next.js dev server on http://localhost:3000
# Auto-reloads on file changes
```

### Install Dependencies
```bash
npm install
# Installs all packages from package.json
```

### Add New Dependencies
```bash
npm install <package-name>
npm install --save-dev <dev-package-name>
```

---

## 🔧 Git Commands

### Basic Git Flow
```bash
# Check status
git status

# Add files
git add .
git add <specific-file>

# Commit changes
git commit -m "Your commit message"

# Push to GitHub
git push origin main

# Pull latest changes
git pull origin main
```

### Git History & Info
```bash
# View commit history
git log --oneline

# View recent commits
git log --oneline -10

# Check differences
git diff
git diff <file-name>

# Check which branch you're on
git branch
```

### Undo Commands
```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard all local changes
git reset --hard HEAD

# Stash changes temporarily
git stash
git stash pop
```

---

## 🚀 Deployment Commands

### Build for Production
```bash
npm run build
# Creates optimized production build
# Must pass before deploying to Vercel
```

### Start Production Server (Local)
```bash
npm run start
# Runs the built production version locally
```

### Vercel Deployment
```bash
# Install Vercel CLI (if needed)
npm install -g vercel

# Deploy to Vercel
vercel --prod

# Check deployment status
vercel ls
```

---

## 🔥 Firebase Commands

### Firebase CLI Setup
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase project
firebase init
```

### Firebase Database Commands
```bash
# View Firestore data
firebase firestore:indexes

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Backup Firestore data
firebase firestore:export gs://your-bucket/backup
```

---

## 🐛 Debug Commands

### View Logs
```bash
# View Next.js build logs
npm run build 2>&1 | tee build.log

# View development logs
npm run dev > dev.log 2>&1

# Check logs in real-time
tail -f dev.log
```

### Find Files & Code
```bash
# Find files by name
find . -name "*.tsx" -type f

# Search for text in files
grep -r "search-term" src/

# Search with line numbers
grep -rn "search-term" src/

# Find large files
find . -size +1M -type f
```

### Check Dependencies
```bash
# Check outdated packages
npm outdated

# Check security vulnerabilities
npm audit

# Fix security issues
npm audit fix
```

---

## 🧪 Build & Test Commands

### Linting & Type Checking
```bash
# Run ESLint
npm run lint

# Fix auto-fixable lint issues
npm run lint -- --fix

# Type check with TypeScript
npx tsc --noEmit
```

### Build Variations
```bash
# Build with verbose output
npm run build -- --verbose

# Build and analyze bundle
npm run build && npx @next/bundle-analyzer

# Check build size
npm run build && ls -la .next/static/
```

---

## 🔧 Environment Setup

### Environment Files
```bash
# Copy environment template
cp .env.example .env.local

# View environment variables
cat .env.local

# Edit environment variables
nano .env.local
# or
code .env.local
```

### Required Environment Variables
```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# OpenAI API
OPENAI_API_KEY=sk-your_openai_api_key

# Environment
NODE_ENV=development
```

---

## 📊 Monitoring Commands

### Performance Monitoring
```bash
# Check bundle size
npx next build && npx next export
du -sh out/

# Analyze bundle composition
npm run build
npx @next/bundle-analyzer .next/static/chunks/*.js
```

### System Resources
```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check disk space
df -h

# Check memory usage
free -h  # Linux
top      # macOS/Linux
```

---

## 🎯 Common Workflows

### New Feature Development
```bash
# 1. Pull latest changes
git pull origin main

# 2. Start development server
npm run dev

# 3. Make changes, then test
npm run build

# 4. Commit and push
git add .
git commit -m "Add new feature: description"
git push origin main
```

### Quick Deployment
```bash
# 1. Test build locally
npm run build

# 2. Commit changes
git add . && git commit -m "Ready for deployment"

# 3. Push to trigger Vercel auto-deploy
git push origin main
```

### Debug Production Issues
```bash
# 1. Build production locally
npm run build
npm run start

# 2. Check Vercel function logs
vercel logs <deployment-url>

# 3. Check build output
cat .next/trace
```

---

## 🆘 Emergency Commands

### Reset Everything
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Reset git to last commit
git reset --hard HEAD

# Clear Next.js cache
rm -rf .next
npm run dev
```

### Quick Fixes
```bash
# Fix permission issues
chmod +x scripts/*.sh

# Fix line ending issues (Windows)
git config core.autocrlf true

# Force push (use with caution!)
git push --force-with-lease origin main
```

---

## 📝 Notes

- Always run `npm run build` before deploying to catch errors early
- Use `git status` frequently to track your changes
- Keep environment variables secure and never commit them
- Test locally before pushing to production
- Use meaningful commit messages for better project history

---

**Last Updated**: January 2025
**Project**: Debate AI Platform
**Live URL**: https://debate-ai-liart.vercel.app