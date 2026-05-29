# docs/rules.md

# Escape_AI Project Rules

## General Rules

* Keep code clean, modular, and scalable
* Avoid duplicate code
* Use meaningful names for variables, functions, files, and folders
* Write readable and maintainable code
* Add comments only when necessary
* Keep functions and components focused on a single responsibility

---

# Branching Rules

## Protected Branches

### `main`

* Production-ready stable code only

### `dev`

* Shared integration and testing branch

---

## Developer Branches

Each developer works in their own branch.

### Examples

```text
sahil-dev
vanshaj-dev
```

---

## Development Flow

```text
developer-branch
    ↓
dev
    ↓
main
```

---

# Git Rules

## Before Starting Work

Always pull latest changes from `dev`.

```bash
git checkout dev
git pull origin dev
```

---

## Commit Rules

Use meaningful commit messages.

### Correct

```text
feat: added chatbot API
fix: resolved login bug
docs: updated setup documentation
```

### Wrong

```text
update
changes
fixed stuff
```

---

## Push Rules

* Never push broken code
* Test features before pushing
* Keep your branch updated with `dev`
* Do not push directly to `main`

---

# Naming Conventions

## Folder Naming

Use `camelCase`.

### Correct

```text
authService
chatController
userProfile
aiEngine
```

### Wrong

```text
Auth_Service
chat-controller
UserProfile
AIENGINE
```

---

## React Component Files

Use `PascalCase`.

### Correct

```text
ChatWindow.jsx
Navbar.jsx
LoginForm.jsx
```

### Wrong

```text
chatwindow.jsx
navbar.jsx
login_form.jsx
```

---

## Utility / Service Files

Use `camelCase`.

### Correct

```text
authService.js
chatHelpers.js
apiClient.js
```

---

## Variable Naming

Use `camelCase`.

### Correct

```javascript
const userMessage
const chatHistory
const isAuthenticated
```

---

## Function Naming

Use `camelCase`.

### Correct

```javascript
function generateResponse()
function fetchUserData()
```

---

## Constant Naming

Use `UPPER_SNAKE_CASE`.

### Correct

```javascript
const API_BASE_URL
const MAX_RETRY_COUNT
```

---

## Database Naming

Use lowercase plural names.

### Correct

```text
users
messages
sessions
```

---

## API Route Naming

Use lowercase with hyphens.

### Correct

```text
/api/chat-response
/api/user-profile
```

---

# File Structure Rules

Recommended structure:

```text
Escape_AI/
├── frontend/
├── backend/
├── docs/
```

Avoid unnecessary files in the root directory.

---

# Frontend Rules

* Use reusable components
* Keep components small and modular
* Separate UI logic from business logic
* Avoid large monolithic components

---

# Backend Rules

* Use proper folder separation
* Keep controllers and services separate
* Validate all API inputs
* Handle errors properly

---

# Security Rules

* Never commit `.env`
* Never expose API keys
* Use environment variables for secrets
* Validate backend inputs
* Sanitize user-generated data

---

# Documentation Rules

Whenever major features are added:
* update architecture documentation if needed

---

# Collaboration Rules

* Respect branch ownership
* Do not overwrite another developer’s work
* Discuss major architecture changes before implementation
* Keep communication clear during merges

---

# AI Usage Rules

* AI-generated code must be reviewed before merging
* Never blindly copy generated code
* Verify scalability and security manually

---

# Future Team Rules

As the project grows:

* introduce pull request reviews
* add automated testing
* implement CI/CD pipelines
* enforce linting and formatting
