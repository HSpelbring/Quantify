---
trigger: always_on
---

# Quantify Agent Operating Rules

## Activation
Always On

---

## Purpose
These rules define how the Agent should operate when assisting with the Fastback system. The Agent must understand the system’s UI surface areas, backend subsystems, logging endpoints, and security posture in order to give precise, low-friction guidance.

---

## System Topology Overview

Quantify consists of:
- A user-facing UI with multiple functional pages
- A backend control and analytics layer
- Explicit logging endpoints acting as sources of truth

The Agent must reason about issues and changes **in the context of the correct subsystem**.

---

## Authoritative Data Sources

### Logging & Runtime State (Primary Sources of Truth)

The Agent MUST prefer these endpoints when reasoning about system behavior:

#### Backend / Core System
- Runtime state, execution flow, errors, permissions, and failures:
  http://localhost:10350/r/backend/overview

#### Analytics / Intelligence Layer
- Aggregations, metrics, signal processing, scoring logic, derived insights:
  http://localhost:10350/r/analytics/overview

#### Frontend / UI Telemetry
- UI-side errors, request failures, rendering issues, interaction tracking:
  http://localhost:10350/r/frontend/overview

Rules:
- Prefer logs over assumptions
- Correlate issues across layers when possible
- Ask for excerpts if behavior is ambiguous
- Treat backend logs as authoritative over frontend perception

---

## User Interface Surface Areas

The Agent must understand the intent and responsibility of each UI page and tailor guidance accordingly.

### `/dashboard`
- High-level system overview
- Summary metrics and system health
- Entry point for operators
- Should not contain destructive or configuration-heavy actions

### `/news`
- News ingestion, filtering, tagging, and source categorization
- Agent recommendations here must consider:
  - article source types
  - filters
  - tagging accuracy
  - performance of ingestion pipelines

### `/insights`
- Derived analytics, signals, correlations, and higher-order interpretations
- Must align with analytics backend behavior
- Avoid suggesting raw data manipulation here

### `/lookup`
- Direct asset or entity inspection
- Deterministic, query-driven behavior
- Agent should prioritize correctness, caching, and repeatability

### `/portfolio`
- User-specific or system-tracked asset collections
- Actions may have higher impact
- Agent must consider attribution, auditability, and state persistence

### `/settings`
- Configuration, permissions, access control, system behavior
- High-risk surface area
- Agent must:
  - explicitly call out security implications
  - avoid casual or implicit changes
  - recommend confirmation or approval flows

### UI Root
- Base URL:
  http://localhost:4200/dashboard
- Assume SPA-style routing
- Agent should not invent routes or hidden pages

---

## Behavioral Constraints

### Assumptions
- No internet access unless explicitly stated
- No cloud dependencies by default
- LAN-first, offline-capable operation
- UI access implies control-plane access

### Security Posture
- Fail closed
- Prefer explicit allowlists
- Treat LAN as hostile unless proven otherwise
- No silent privilege escalation

---

## Permissions & Roles

The Agent must distinguish between:
- Viewer (read-only)
- Operator (execute approved actions)
- Approver (authorize changes)
- Administrator (system-level control)

Rules:
- Separation of duties is preferred
- If role boundaries are unclear, ask before proposing changes
- Sensitive actions must require explicit permission context

---

## Change Management Guidance

When proposing changes:
- Clearly separate:
  - design intent
  - implementation detail
  - security impact
- Identify blast radius
- Prefer reversible or staged changes
- Call out when UI and backend changes must be coordinated

---

## Debugging & Investigation Workflow

When diagnosing issues:
1. Identify the affected UI page
2. Check the corresponding log layer(s):
   - frontend for UI issues
   - backend for execution or permission issues
   - analytics for signal/data issues
3. Correlate timestamps and actions
4. Avoid speculative fixes
5. Recommend next steps grounded in evidence

---

## Communication Style

- Structured and concise
- Bullet points over prose
- No filler or conversational language
- Ask clarifying questions only when blocking progress
- Prefer concrete recommendations

---

## Output Expectations

Responses should include:
- Explicit assumptions
- Reasoning
- Tradeoffs
- Clear next actions

---

## Prohibited Behavior

The Agent must NOT:
- Invent endpoints, routes, or services
- Assume WAN trust
- Bypass access control considerations
- Suggest weakening security for convenience
- Treat analytics output as ground truth without backend validation

---

## Escalation

If requirements are underspecified or conflicting:
- Pause implementation guidance
- Request clarification
- Explicitly state risk of proceeding