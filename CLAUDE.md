# Claude Instructions - Debate AI Project

## 🚨 CRITICAL RULES - ALWAYS FOLLOW

### Deployment & Git Rules
- **NEVER push to GitHub without explicit permission** - Always ask before `git push`
- **NEVER auto-deploy to Vercel** - Always ask before any deployment actions
- **ALWAYS ask before making commits** - Confirm before `git commit` commands
- **NO automatic CI/CD triggers** - User controls all deployments

### Code Changes
- **NEVER modify environment files** (.env.local, .env.production) without permission
- **ALWAYS test build locally** before any deployment suggestions
- **NO breaking changes** without explicit approval
- **PRESERVE user customizations** - Don't overwrite user-specific settings

### Communication Rules
- **ASK FIRST, ACT SECOND** - Always get permission for major actions
- **EXPLICIT CONFIRMATION** required for:
  - Git pushes
  - Deployments
  - Database changes
  - Environment variable modifications
  - Major refactoring

## 📋 Project-Specific Rules

### AI Features
- **OpenAI API calls** - Monitor usage and warn about costs
- **AI scoring consistency** - Always consider repetition detection
- **Position alignment** - Ensure arguments match assigned debate positions
- **Temperature settings** - Keep low (0.1-0.3) for consistent scoring

### UI/UX Guidelines
- **No automatic popups** - Results should display inline first
- **Preserve debate history** - Never hide completed debates
- **Consistent experience** - All users should see same analysis
- **Mobile responsive** - Always consider mobile layouts

### Firebase/Database
- **Firestore structure preservation** - Don't change existing schemas without approval
- **Authentication flows** - Maintain anonymous user support
- **Real-time listeners** - Ensure proper cleanup to prevent memory leaks

## 🎯 Development Workflow

### Before Any Major Change:
1. **Explain what you plan to do**
2. **Ask for confirmation**
3. **Test locally first**
4. **Show results before pushing**

### Commit Message Format:
```
Brief description of change

- Bullet point of what changed
- Another change
- Impact or reasoning

🤖 Generated with [Claude Code](https://claude.ai/code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

### Build & Test Sequence:
1. `npm run build` - Must pass
2. Test functionality locally
3. Ask permission before git operations
4. Wait for approval before deployment

## 🔧 Technical Preferences

### Code Style
- **TypeScript strict mode** - Fix type errors, don't ignore them
- **ESLint compliance** - Address warnings, change to warnings if needed for deployment
- **No console.logs in production** - Use proper logging
- **Comments only when necessary** - Code should be self-documenting

### Performance
- **Bundle size awareness** - Monitor and report large increases
- **Image optimization** - Suggest Next.js Image component when appropriate
- **Lazy loading** - For non-critical components

## 🚨 Security Guidelines

### API Keys & Secrets
- **NEVER log API keys** - Even in debug mode
- **Environment variables** - Keep sensitive data in .env files only
- **Client-side exposure** - Only NEXT_PUBLIC_ variables in frontend

### Authentication
- **Firebase Auth security** - Proper domain whitelisting
- **Anonymous user support** - Maintain for accessibility
- **Session management** - Proper cleanup on logout

## 📊 Monitoring & Debugging

### Error Handling
- **Graceful degradation** - App should work even if AI fails
- **User-friendly errors** - No raw error dumps to users
- **Detailed logging** - For debugging purposes only

### Performance Monitoring
- **Build size tracking** - Report significant increases
- **API response times** - Monitor OpenAI call duration
- **Database query efficiency** - Optimize Firestore reads

## 🎨 Design System

### UI Components
- **MUI consistency** - Stick to Material-UI components
- **Color scheme** - Maintain gradient themes
- **Responsive design** - Mobile-first approach
- **Accessibility** - WCAG compliance where possible

## 🤖 AI Integration Rules

### OpenAI Usage
- **Cost awareness** - Always mention potential costs
- **Rate limiting** - Handle 429 errors gracefully
- **Model consistency** - Use gpt-4o-mini unless specified otherwise
- **Prompt optimization** - Keep prompts concise but effective

### Scoring System
- **Consistency** - Same input should give similar scores
- **Fairness** - No bias toward position A or B
- **Transparency** - Users should understand how scoring works

## 📝 Documentation

### Code Documentation
- **README updates** - Keep project description current
- **API documentation** - Document all endpoints
- **Component props** - TypeScript interfaces for clarity

### User Documentation
- **Feature explanations** - Clear user-facing descriptions
- **Error messages** - Helpful, actionable error text
- **Help text** - Context-sensitive assistance

---

## 🎯 REMEMBER: ALWAYS ASK PERMISSION FOR:
- Git pushes
- Deployments
- Environment changes
- Database modifications
- Major refactoring
- API integrations
- Third-party service additions

**Last Updated**: January 2025
**Project**: Debate AI Platform
**Your Role**: Development Assistant (NOT Autonomous Deployer)