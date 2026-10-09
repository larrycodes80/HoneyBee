# TraceForge — GitHub Collaboration Policy

**Purpose:** Keep concurrent development predictable, reduce merge conflicts, and maintain a runnable application throughout the hackathon.

**Applies to:** All contributors to the TraceForge repository.

---

## 1. Core Rules

1. Never commit directly to `main`.
2. Every task must be implemented on a feature branch.
3. Every commit must represent a coherent, reviewable change.
4. Do not commit secrets, credentials, local databases, generated build output, or unnecessary dependencies.
5. Pull the latest `main` before creating a new branch.
6. Integrate early and frequently.
7. Do not change shared API contracts without informing affected developers.
8. The application must remain runnable after every merge.
9. Use conventional commit messages.
10. Freeze nonessential features before the final demo.

For a three-hour hackathon, reviews should be fast. The purpose of this policy is to prevent integration failures, not to introduce heavyweight enterprise process.

---

## 2. Branch Strategy

Use a lightweight branch strategy with `main` as the integration branch.

### Permanent branch

```text
main
```

`main` must contain the latest integrated, runnable version of TraceForge.

### Feature branches

Use the format:

```text
feat/<scope>-<short-description>
fix/<scope>-<short-description>
test/<scope>-<short-description>
docs/<scope>-<short-description>
refactor/<scope>-<short-description>
```

Examples:

```text
feat/backend-trace-recorder
feat/backend-replay-engine
feat/frontend-trace-timeline
feat/frontend-diff-view
feat/core-first-divergence
test/core-replay-assertions
docs/project-readme
fix/backend-fixture-matching
```

Keep branches narrowly scoped. Avoid a single branch containing the entire backend, frontend, and documentation unless the change is genuinely inseparable.

### Branch ownership

- Developer A primarily owns `backend/*` implementation branches.
- Developer B primarily owns `frontend/*` implementation branches.
- Developer C primarily owns `core/*`, `test/*`, and integration-related branches.

These are ownership conventions, not access restrictions. Shared contract changes must be coordinated.

---

## 3. Commit Message Convention

Use Conventional Commits.

Format:

```text
<type>(<scope>): <imperative description>
```

Examples:

```text
feat(backend): add trace recording
feat(backend): implement scenario replay
feat(core): detect first trace divergence
feat(core): evaluate required tool ordering
feat(frontend): add trace timeline
feat(frontend): render baseline replay diff
fix(backend): reject unmatched tool fixtures
fix(frontend): handle failed replay requests
test(core): cover tool ordering assertions
docs: add backend implementation specification
chore: configure frontend tooling
```

### Allowed commit types

| Type       | Use                                                     |
| ---------- | ------------------------------------------------------- |
| `feat`     | New functionality                                       |
| `fix`      | Bug fix                                                 |
| `test`     | Tests                                                   |
| `docs`     | Documentation                                           |
| `refactor` | Internal restructuring without intended behavior change |
| `chore`    | Tooling, configuration, maintenance                     |
| `style`    | Formatting-only changes without behavior changes        |

### Commit message rules

- Use the imperative mood: `add`, `fix`, `implement`, `document`.
- Keep the subject concise.
- Identify the component in the scope when useful.
- Do not use vague messages such as `updates`, `changes`, `stuff`, or `final code`.
- Do not combine unrelated work into one commit.

A good commit answers: **What changed, and which part of TraceForge did it affect?**

---

## 4. Commit Size and Frequency

Prefer small commits that represent a logical milestone.

Example backend progression:

```text
feat(backend): initialize SQLite schema
feat(backend): add trace recorder
feat(backend): persist agent runs
feat(backend): implement controlled replay
test(backend): cover replay fixture matching
```

Example frontend progression:

```text
feat(frontend): scaffold app shell
feat(frontend): add runs list
feat(frontend): render trace timeline
feat(frontend): add replay controls
feat(frontend): display trace diff
```

Commit when a logical unit is complete and the code is in a coherent state.

Do not wait until the end of the hackathon to make the first commit.

---

## 5. Pull Request Policy

All changes should enter `main` through a pull request where the repository workflow permits it.

### Pull request title

Use the same convention as commit messages.

Example:

```text
feat(core): add first-divergence detection
```

### Pull request description

Use this template:

```markdown
## Summary

- What changed?
- Why is the change needed?

## Implementation

- Important implementation details.

## Testing

- Commands or scenarios executed.
- Results observed.

## Integration impact

- API changes?
- Shared schema changes?
- New dependencies?

## Checklist

- [ ] No secrets or local artifacts committed.
- [ ] Change follows the agreed API contract.
- [ ] Relevant tests pass.
- [ ] Application remains runnable.
- [ ] Documentation updated if required.
```

### Review expectations

Reviewers should check:

- Correctness.
- API and schema compatibility.
- Whether the code performs its advertised behavior.
- Whether tests or a reproducible manual test exist.
- Whether the change breaks another developer's work.

During the hackathon, a brief review by another developer is sufficient. Do not require lengthy review cycles.

If the team is blocked by repository permissions or time, a direct merge may be used as an exception after another developer checks the change.

---

## 6. Merge Policy

Use merge commits or squash merges consistently. For this small project, **squash merging pull requests** is a reasonable default because it keeps the integration history concise.

Before merging:

1. Fetch the latest `main`.
2. Resolve any conflicts on the feature branch.
3. Verify the branch matches the current API contract.
4. Run relevant tests or the corresponding manual workflow.
5. Ensure the change does not break application startup.
6. Merge and push the updated `main`.

After merging:

- Delete the feature branch if it is no longer needed.
- Notify developers whose work depends on the merged changes.
- Update local branches before beginning the next integration-sensitive task.

Do not force-push to `main`.

---

## 7. Shared File and Contract Policy

The following files and structures are shared integration boundaries:

- `BACKEND.md`
- `FRONTEND.md`
- `PRODUCT.md`
- Pydantic API schemas.
- TypeScript API interfaces.
- Trace event types.
- Endpoint paths and payloads.
- Database schema.
- Replay policy.
- Diff response format.

### Rules

1. Agree on changes before editing a shared contract.
2. Keep backend Pydantic schemas and frontend TypeScript interfaces synchronized.
3. Update both sides when a contract changes.
4. Communicate breaking changes before merging.
5. Do not introduce undocumented response fields that the frontend depends on.
6. Do not silently change endpoint names or status values.
7. Treat `BACKEND.md` as the backend contract reference and update it when implementation decisions materially change.

If a contract change is necessary, the responsible developer should announce it and make the corresponding updates together where possible.

---

## 8. Repository Hygiene

### Required repository files

```text
PRODUCT.md
BACKEND.md
FRONTEND.md
TEAM_TASKS.md
github_policy.md
README.md
LICENSE
.gitignore
```

Include the application source and tests as they are implemented.

### Recommended `.gitignore`

```gitignore
# Python
__pycache__/
*.py[cod]
.venv/
venv/
.pytest_cache/
.coverage

# Local configuration and secrets
.env
.env.*
!.env.example

# Local databases and generated data
*.db
*.sqlite
*.sqlite3
data/

# Node
node_modules/
dist/
coverage/

# Operating system and editor
.DS_Store
.idea/
.vscode/

# Logs
*.log
```

Review the `.env` exceptions carefully. Commit `.env.example` only when it contains placeholders and no real credentials.

If a required sample database is intentionally part of the project, store it separately as an explicitly reviewed fixture rather than committing a live development database.

### Never commit

- API keys or access tokens.
- Passwords or private keys.
- Real customer data or private user traces.
- Large model weights.
- Unnecessary generated files.
- Build artifacts.
- Local dependency directories.
- Personal machine configuration.
- Unreviewed recorded traces containing sensitive information.

Before every push, inspect the staged changes with:

```bash
git status
git diff --cached
```

If a secret is committed, removing it in a later commit does not make it safe. Revoke or rotate the credential immediately and follow the repository's incident response process.

---

## 9. Dependency Management

### Backend

Use the repository's chosen Python dependency manager and commit its lockfile if one is generated.

Avoid adding libraries when the standard library already solves the problem adequately.

### Frontend

Use `pnpm` consistently.

Commit `pnpm-lock.yaml`.

Do not mix npm, Yarn, and pnpm lockfiles in the same project unless there is a deliberate migration.

### Dependency policy

Before adding a dependency, consider:

- Does the MVP actually require it?
- Will installation fit the time limit?
- Does it introduce runtime or compatibility risks?
- Can the same functionality be implemented with existing dependencies?

Do not introduce a new framework during the final integration phase unless it fixes a blocking defect.

---

## 10. Testing Before Integration

Run the checks relevant to the modified component.

### Backend

```bash
cd backend
uv run pytest
```

If the project does not use `uv`, use the equivalent command from the repository's chosen Python environment.

### Frontend

```bash
cd frontend
pnpm build
```

### Integration

Verify the complete workflow:

1. Start the backend.
2. Start the frontend.
3. Execute the baseline scenario.
4. Inspect the persisted trace.
5. Replay the scenario.
6. View the diff.
7. Confirm the assertion result.

A successful frontend build does not prove the integration works. At least one end-to-end run is required before the final demo.

---

## 11. Integration and Feature Freeze

Because the hackathon lasts only three hours, integration must happen continuously.

### First 20 minutes

- Create the repository and branches.
- Agree on shared contracts.
- Make the initial scaffold commit.

### By minute 70

- A baseline trace must be recordable and retrievable.

### By minute 100

- Replay and diff must work independently of UI polish.

### By minute 130

- The full frontend/backend workflow must work.

### By minute 155

- Freeze nonessential features.
- Fix critical defects only.

### Final 25 minutes

- Verify setup instructions.
- Verify license and repository visibility.
- Run the complete demo.
- Ensure `main` is stable.
- Avoid large refactors and dependency changes.

These are target deadlines, not reasons to merge broken code. If a milestone slips, cut optional scope and preserve the core workflow.

---

## 12. Recommended Git Workflow

### Initial setup

```bash
git clone <repository-url>
cd traceforge
git switch main
git pull --ff-only origin main
```

### Start a feature

```bash
git switch -c feat/backend-trace-recorder
```

### Stage and review

```bash
git status
git diff
git add backend/
git diff --cached
```

Stage only the files relevant to the task. Avoid `git add .` when unrelated or sensitive files may be present.

### Commit

```bash
git commit -m "feat(backend): add trace recorder"
```

### Push

```bash
git push -u origin feat/backend-trace-recorder
```

### Update before integration

```bash
git fetch origin
git merge origin/main
```

Resolve conflicts, run the relevant tests, and push the updated branch before merging.

Use the repository's chosen pull-request process to integrate the change.

### After integration

```bash
git switch main
git pull --ff-only origin main
```

Start the next feature from the updated `main`.

These commands are examples; replace the branch name and paths with those appropriate to the task.

---

## 13. Handling Merge Conflicts

If a conflict occurs:

1. Stop and inspect the conflicting files.
2. Identify the intended behavior on each branch.
3. Coordinate with the owner of the affected module.
4. Resolve the conflict without silently discarding another developer's implementation.
5. Re-run relevant tests.
6. Verify API contracts remain consistent.
7. Commit the resolution on the feature branch.

Pay particular attention to shared files such as `schemas.py`, TypeScript interfaces, API client modules, and database definitions.

Never resolve a conflict by blindly choosing one entire side when both sides contain required functionality.

---

## 14. Definition of a Healthy Repository

At all times, the repository should have:

- A runnable `main` branch.
- Clear, scoped commits.
- No committed credentials.
- Consistent dependency management.
- Documented API contracts.
- Trace events and diff results based on actual execution.
- Relevant tests for the core logic.
- Setup instructions that match the implementation.

The goal is predictable collaboration under time pressure.

**A good Git workflow minimizes uncertainty: every branch has a purpose, every commit describes a change, and every merge leaves the project closer to a working demo.**
