# HoneyBee — DigitalOcean Gemma 4 Inference & Workflow Setup

This document details the configuration, security boundaries, and operational lifecycle for the DigitalOcean-hosted Gemma 4 inference service and the HoneyBee Workflow Management Engine (Phase 4A).

---

## 1. Architecture & Security Boundaries

- **Strict Backend Isolation:** All inference calls to DigitalOcean are executed strictly from the HoneyBee backend service.
- **Zero Secret Leakage:** The `DIGITALOCEAN_INFERENCE_API_KEY` / `DIGITALOCEAN_TOKEN` is never returned in API payloads, never transmitted to the frontend, and never exposed to the client SDK.
- **Structured Schema Enforcement:** Model completions are enforced via JSON response schemas and validated with strict Pydantic models (`ClarificationQuestionsOutput`, `WorkflowSpecification`).
- **No False Approval:** Inference failures never automatically approve workflows or fabricate successful verdicts.

---

## 2. Environment Configuration

Configure the following variables in `backend/.env`:

```bash
# Provider Selection
# Set to 'digitalocean' to enable live inference, or 'fake' for offline deterministic testing
HONEYBEE_LLM_PROVIDER=digitalocean

# DigitalOcean Credentials
DIGITALOCEAN_INFERENCE_API_KEY=dop_v1_your_digitalocean_token_here
# Alias supported: DIGITALOCEAN_TOKEN=...

# Inference Service Endpoint
DIGITALOCEAN_INFERENCE_BASE_URL=https://inference.do-ai.run

# Target Model Identifier
DIGITALOCEAN_INFERENCE_MODEL=gemma-4-it

# Network Timeout
DIGITALOCEAN_INFERENCE_TIMEOUT_SECONDS=60
```

---

## 3. Workflow Interview Lifecycle

The workflow management system transitions developer intent into immutable specifications across 7 stages:

1. **Create Draft (`POST /api/workflows`):**
   - Developer supplies high-level natural language intent (e.g. *"Check transactions for fraud. If flagged, do not refund and route to manual review. Only refund if safe."*).
   - Initializes workflow record in `draft` status.

2. **Generate Clarification Questions (`POST /api/workflows/{id}/questions`):**
   - Gemma 4 analyzes the intent and extracts edge cases, safety invariants, and ambiguities.
   - Categorizes questions (`safety_boundary`, `edge_case`, `failure_handling`, `tradeoff`).

3. **Submit Answers (`POST /api/workflows/{id}/answers`):**
   - Developer answers the clarification interview questions.
   - Transitions draft to `in_review`.

4. **Synthesize Structured Specification (`POST /api/workflows/{id}/generate-spec`):**
   - Gemma 4 synthesizes the structured specification conforming to `WorkflowSpecification`:
     - `goal`
     - `required_outcomes`
     - `required_conditions`
     - `forbidden_actions`
     - `safety_invariants`
     - `acceptable_alternatives`
     - `failure_handling_requirements`
     - `success_criteria`
     - `external_side_effects`
     - `unresolved_assumptions`
     - `hard_requirements` (mandatory constraints)
     - `preferences` (separated from safety requirements)

5. **Manual Review & Editing (`PUT /api/workflows/{id}`):**
   - Developer reviews and modifies any specification field directly.

6. **Explicit Approval (`POST /api/workflows/{id}/approve`):**
   - Developer explicitly commits the workflow.
   - Locks the current specification snapshot into an immutable `WorkflowVersion` record (e.g. `v1`, `v2`).
   - Workflows are **never** auto-approved.

7. **Historical Version Inspection:**
   - `GET /api/workflows/{id}/versions` lists all historical versions.
   - `GET /api/workflows/{id}/versions/{version_num}` retrieves an exact immutable historical snapshot.
   - Editing an approved workflow creates a new draft that must be re-approved, leaving past versions unaltered.

---

## 4. Testing & Offline Operation

When `HONEYBEE_LLM_PROVIDER=fake` (or when no live token is present), HoneyBee automatically utilizes `FakeGemmaProvider`:
- Zero external network dependency.
- Deterministic questions and specifications generated for tests.
- Simulated error modes available to verify resilience against timeouts, rate limits, and 502 Bad Gateway responses.
