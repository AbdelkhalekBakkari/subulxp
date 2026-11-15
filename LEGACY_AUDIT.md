# LEGACY_AUDIT — subul-platform

**Audited repository:** `subulai/subul-platform` (default branch, commit `8253ae4`)
**Audit date:** 2026-11-15
**Target product:** a human mentorship marketplace (Subul XP) with PFE (projet de fin d'études) milestone tracking and mentor session summaries.

This repository (`subulxp`) is only the static Subul XP landing page (one `index.html`, a lab-request form posting to an external endpoint, `robots.txt`, `sitemap.xml`, `CNAME`). It has no models, routes, auth or billing. Everything below describes `subul-platform`.

## Legend

| Tag | Meaning |
|---|---|
| **[KEEP]** | Reusable as-is (or with renaming) for a human mentorship marketplace. |
| **[REPURPOSE]** | The data shape or flow is sound but the domain is wrong; adapt it for PFE milestones, roadmaps, deliverables or session summaries. |
| **[DROP]** | Strictly tied to AI agent execution (LLM calls, RAG indexes, quotas, avatars, scrapers). A few items are also tagged DROP with the note *no fit* when they are not AI but have no place in a mentorship product (cloud sandboxes, vendor certification exams, cloud credential vaults). |

## Stack at a glance

| Layer | Technology | Verdict |
|---|---|---|
| API | NestJS 11, TypeORM 0.3, PostgreSQL (pgvector image), JWT via passport-jwt, Swagger | **[KEEP]** |
| Frontend | Next.js 16 App Router, React 19, Tailwind, `[locale]` i18n (fr/en), axios client | **[KEEP]** |
| Agents | 6 Python FastAPI services (quiz, roadmap, coach, cloud-tutor, cv-booster, job-search) on Azure OpenAI, Azure AI Search, Cosmos DB, Redis, Deepgram, Cartesia | **[DROP]** |
| Payments | Stripe, Flouci (Tunisia), PayPal, manual bank/D17 transfer, regional pricing TN/EU/US/MA/GB | **[KEEP]** |
| Mail | Microsoft Graph sendMail or SMTP via nodemailer | **[KEEP]** |
| Ops | docker-compose, EKS/AKS manifests, Prometheus/Grafana/Loki monitoring stack | **[KEEP]** (strip AI cost dashboards) |

## Summary counts

| Inventory | Total | KEEP | REPURPOSE | DROP |
|---|---|---|---|---|
| Database tables (TypeORM `@Entity`) | 73 | 33 | 17 | 23 |
| API routes (NestJS handlers) | 481 | 242 | 78 | 161 |
| Authentication flows | 15 | 12 | 1 | 2 |
| Billing / credit mechanisms | 18 | 14 | 1 | 3 |
| Frontend pages (`page.tsx`) | 138 | 80 | 25 | 33 |
| Python agent services | 8 | 0 | 0 | 8 |

---

## 1. Database models / tables

Source: 73 `@Entity` classes in `backend/api/src/**/entities/*.entity.ts` plus 41 migrations in `backend/api/src/migrations/`. Schema sync is also forced by `1712300000000-ForceSyncUserSchema`.

### 1.1 Identity, tenants and organisations

| Table | Module | What it holds | Verdict | Note |
|---|---|---|---|---|
| `users` | users | email, bcrypt `password_hash`, `role` (learner/admin/employer/university/university_owner/instructor/commercial/student), `status` (pending/active), `company_id`, `university_id`, **`mentor_id` → users, `mentor_title`**, phone/bio, verification + reset tokens, `has_completed_assessment`, `track` (cloud/cyber/ai), `agent_limit_override`, `sandbox_*_override` | **[KEEP]** | Mentor assignment columns are the seed of the marketplace. Drop `has_completed_assessment`, `track`, `agent_limit_override`, `sandbox_concurrent_override`, `sandbox_monthly_hours_override`. |
| `companies` | companies | name, sector, size, website, address, `status`, owner user, json contact lists | **[KEEP]** | Host companies for PFE internships. |
| `employer_candidates` | employer | employer, job, user, resume_url, cover_letter, pipeline status, notes | **[KEEP]** | Applicant tracking for PFE offers. |
| `employer_interviews` | employer | employer, candidate, job, `scheduled_at`, `duration_minutes`, `meeting_url`, status | **[KEEP]** | Already a meeting-booking record; generalise to mentor sessions. |
| `employer_employees` | employer | company staff roster | **[KEEP]** | Company-side supervisors. |
| `employer_certified_learners` | employer | learners a company tracks | **[REPURPOSE]** | Rename to company interns / PFE students. |
| `universities` | university | name, slug, status, contacts, `billing_email`, contract dates, `setup_token` | **[KEEP]** | School tenant that supervises PFE. |
| `university_departments` | university | per-university departments | **[KEEP]** | |
| `university_cohorts` | university | department, start/end dates, `plan_slug` | **[KEEP]** | PFE promotion / cohort. |
| `university_memberships` | university | user, role (owner/admin/coordinator/student), status, department, cohort | **[KEEP]** | Academic supervisor and student membership. |
| `university_invites` | university | email, token, role, program/department/cohort, resend count, expiry | **[KEEP]** | |
| `university_licenses` | university | plan, `seats_total/used`, validity, license_key, price, auto_renew | **[KEEP]** | B2B seat licensing. |
| `university_audit_logs` | university | actor, entity, action, old/new jsonb, ip | **[KEEP]** | |
| `university_programs` | university | name, description, `certification_id` | **[REPURPOSE]** | Replace certification link with a PFE programme / milestone template. |
| `university_program_enrollments` | university | user, program, status, invited/enrolled/completed dates, progress int | **[REPURPOSE]** | Student enrolment in a PFE programme with % progress. |
| `commercial_profiles` | commercial | sales partner user, status, currency, totals | **[KEEP]** | Ambassador / sales-partner programme. |
| `jobs` | jobs | title, description, location, contract_type, salary, skills jsonb, `company_id`, `employer_id`, moderation status (pending/published/rejected), admin notes, reviewed_by, published_at | **[KEEP]** | PFE / internship offer board with admin moderation. |
| `notifications` | notifications | recipient user or role, type, title, message, `job_id`, is_read | **[KEEP]** | |
| `quote_requests` | quote-requests | contact, number_of_users, `plan_type` (universite/entreprise), status | **[KEEP]** | B2B quote (devis) pipeline. |
| `platform_settings` | platform | key/value text store (only key today: `agent_limits`) | **[KEEP]** | Generic settings table; drop the `agent_limits` row. |

### 1.2 Mentorship, goals and progress

| Table | Module | What it holds | Verdict | Note |
|---|---|---|---|---|
| `vip_mentor_meetings` | vip-meetings | user, `scheduled_at`, duration, topic, `meeting_link`, status (scheduled/completed/cancelled), notes, created_by | **[KEEP]** | Core session object. Add `mentor_id`, a summary/notes-for-mentee field and attendance. |
| `vip_real_projects` | vip-real-projects | user, title, description, status (assigned/in_progress/completed), `resource_link`, notes | **[REPURPOSE]** | Becomes the PFE project record; attach milestones to it. |
| `goals` | goals | title, description, category, priority, `success_criteria`, due date, progress, status, `milestones` text, `completed_milestones` text, `source` (manual/ai) | **[REPURPOSE]** | Already has milestones; promote them to rows, drop `source=ai`. |
| `weekly_goals` | goals | title, week_number, year, progress/target | **[REPURPOSE]** | Weekly sprint check-ins between mentor and mentee. |
| `daily_goals` | goals | title, done flag, points, goal_date | **[REPURPOSE]** | Daily tasks on a milestone. |
| `user_roadmaps` | roadmap | user, `modules` jsonb, `profile` jsonb, progress counters | **[REPURPOSE]** | Ordered step list + per-step progress maps to a PFE roadmap once AI generation is removed. |
| `learner_content_assignments` | learner-assignments | user, content_type (course/lab/certification), content_ref, granted_by, expires_at, note | **[REPURPOSE]** | Mentor assigns deliverables/resources to a mentee. |
| `user_cvs` | user-cv | file path/name/size/mime, `extracted_data` jsonb, `ats_score`, last_analyzed_at | **[KEEP]** | Keep the file columns for mentee profile; drop `extracted_data` and `ats_score`. |

### 1.3 Billing and growth

| Table | Module | What it holds | Verdict | Note |
|---|---|---|---|---|
| `subscription_plans` | subscriptions | name, slug, type (free/standard/premium/vip/university/enterprise), visibility, badge, features text | **[KEEP]** | `vip` is already the Subul XP mentorship pass. |
| `plan_billing_options` | subscriptions | plan, region (TN/EU/US/MA/GB/DEFAULT), cycle (monthly/quarterly/semester/annual), `price_cents`, currency, `duration_months` | **[KEEP]** | XP tiers of 2/4/6 months are seeded here. |
| `user_subscriptions` | subscriptions | plan, status (trial/active/expired/cancelled/pending_payment/none), period, trial dates, provider, amount, auto_renew | **[KEEP]** | |
| `payment_transactions` | payments | provider (stripe/flouci/paypal), intent ids, amounts, discount, promo, country/ip, idempotency_key, webhook flags | **[KEEP]** | |
| `manual_payment_requests` | manual-payments | bank_transfer/d17, order_id, proof file, admin approval, activated subscription | **[KEEP]** | Important for the Tunisian market. |
| `promo_codes` | promo-codes | percentage/fixed, applicable_plans, max_uses, per_user_limit, dates, currency_scope, `commercial_id` | **[KEEP]** | |
| `promo_code_redemptions` | promo-codes | code × user × transaction | **[KEEP]** | |
| `referral_codes` | referrals | one code per user | **[KEEP]** | |
| `referrals` | referrals | referrer, referred (unique), status machine, fraud score/flags, waiting period, disqualification reason | **[KEEP]** | |
| `referral_rewards` | referrals | reward_block, milestone_target 5, amount 100 TND, status, rule_snapshot | **[KEEP]** | |
| `payout_accounts` | referrals | bank/d17 details jsonb | **[KEEP]** | Also reusable for mentor payouts. |
| `payout_requests` | referrals | total, reward_count, status, admin review | **[KEEP]** | Reusable for mentor payouts. |
| `payout_request_items` | referrals | request × reward | **[KEEP]** | |
| `referral_audit_log` | referrals | entity, action, old/new | **[KEEP]** | |

### 1.4 Learning content (courses, certifications, exams, labs)

| Table | Module | What it holds | Verdict | Note |
|---|---|---|---|---|
| `courses` | courses | course_id, title, provider, description, objectives json, duration, `certification_id`, `track`, Azure Search index columns | **[REPURPOSE]** | Course → PFE milestone template. Drop `azure_search_*`, `track`, `certification_id`. |
| `modules` | courses | course, order, title, level, duration, json lists | **[REPURPOSE]** | Module → milestone. |
| `lessons` | courses | module, order, title, content, key_points, comparison_table | **[REPURPOSE]** | Lesson → deliverable / checklist item. |
| `lesson_translations` | courses | lesson × locale translated fields | **[REPURPOSE]** | fr/en content for milestone templates. |
| `user_course_progress` | courses | current module/lesson, completed_* json, overall_progress, status, timestamps | **[REPURPOSE]** | Direct analogue of milestone progress per mentee. |
| `course_labs` | courses | labs attached to modules, evaluation_criteria, learning_objectives | **[DROP]** | *no fit* (hands-on cloud labs). |
| `certification_paths` | certifications | certification, step_order, step_type, step_ref, title | **[REPURPOSE]** | Ordered step path → PFE roadmap template. |
| `issued_certificates` | certifications | user, certification, course, `verification_code`, issued_at, json | **[REPURPOSE]** | Verifiable PFE completion attestation. |
| `course_completion_certificates` | certifications | user, course, `cert_hash`, title | **[REPURPOSE]** | Same as above for a single milestone. |
| `certifications` | certifications | vendor cert catalogue (AWS/Azure/GCP exam codes, passing score, Azure Search columns) | **[DROP]** | *no fit*. |
| `exams`, `exam_questions`, `exam_attempts`, `user_exam_streaks` | exams | timed exam engine with streak bonus | **[DROP]** | *no fit*. |
| `practice_exams`, `practice_exam_questions`, `practice_exam_attempts` | practice-exams | certification practice exams, Azure Search indexed | **[DROP]** | *no fit*. |
| `labs`, `lab_progress` | labs | cloud lab catalogue (aws/azure/gcp/nvidia/opensource) and per-task progress | **[DROP]** | *no fit*. |
| `lab_access_sessions`, `lab_cloud_credentials` | lab-access | shared cloud console credentials (plaintext access/secret keys) and timed grants | **[DROP]** | *no fit*; also a security liability. |
| `cloud_sandboxes`, `sandbox_sessions`, `sandbox_action_log`, `sandbox_usage_monthly` | cloud-sandbox | AWS/Azure sandbox provisioning, cost_to_date_usd, monthly hour quota | **[DROP]** | *no fit*. |

### 1.5 AI agent state

| Table | Module | What it holds | Verdict | Note |
|---|---|---|---|---|
| `job_search_chat_messages` | agents | chat transcript with the job-search agent | **[DROP]** | AI agent. |
| `user_agent_state` | agents | per-agent jsonb state | **[DROP]** | AI agent. |
| `agent_usage_monthly` | platform | user × agent_key × year_month × count | **[DROP]** | AI quota ledger. The (user, key, month, count) shape could be reused for session credits, but rebuild rather than inherit. |
| `assessment_results` | quiz-results | profile quiz answers, primary/hybrid profiles, attempt number | **[DROP]** | AI onboarding assessment. |
| `quiz_level_results` | quiz-results | level quiz scores jsonb | **[DROP]** | AI quiz. |
| `quiz_feedback` | quiz-feedback | learner reports on generated questions | **[DROP]** | AI quiz. |

---

## 2. Authentication flows

Source: `backend/api/src/auth/`, `backend/api/src/university/university-auth.controller.ts`, `frontend/proxy.ts`, `frontend/contexts/AuthContext.tsx`, `frontend/lib/auth/*`.

| # | Flow | How it works today | Verdict | Note |
|---|---|---|---|---|
| 1 | Local registration | `POST /api/auth/register` → bcrypt hash, user `status=pending`, hashed email-verification token mailed, response has no access token | **[KEEP]** | |
| 2 | Email verification | `POST /api/auth/verify-email`, `GET /api/auth/verify-email/:token` (redirect), resend + alias, `email_verified_at` audit | **[KEEP]** | |
| 3 | Login | `POST /api/auth/login` → JWT signed with `JWT_SECRET`, payload `{sub,email,role,hasCompletedAssessment,isEmailVerified}` | **[KEEP]** | Remove the `hasCompletedAssessment` claim (AI onboarding quiz). |
| 4 | Bearer JWT guard | passport-jwt `LocalJwtStrategy` reads `Authorization: Bearer`, loads user by `sub`; `JwtAuthGuard` honours `@SkipAuth` | **[KEEP]** | |
| 5 | Role authorisation | `@Roles()` + `RolesGuard`, `AdminGuard`; roles: learner, admin, employer, university, university_owner, instructor, commercial, student | **[KEEP]** | Add an explicit `mentor` role; `instructor` is the nearest existing one. |
| 6 | Subscription gate | `SubscriptionGuard` → `learnerDashboardAllowed()`; students and non-learners bypass | **[KEEP]** | Gate mentee features behind an active XP pass. |
| 7 | Password reset | `forgot-password-email` → hashed token → `reset-password`; admin `send-reset-password` and `PATCH users/:id/password` | **[KEEP]** | |
| 8 | Change email | `POST /api/auth/change-email` re-triggers verification | **[KEEP]** | |
| 9 | Admin approval | `POST /api/admin/users/:id/approve`, `PATCH users/:id/status`, `GET /api/admin/auth-stats` | **[KEEP]** | Use for mentor vetting. |
| 10 | University workspace setup | Admin creates university → `setup_token` mailed → `GET/POST /api/auth/university/setup` sets owner password, returns JWT | **[KEEP]** | |
| 11 | University invite | `GET/POST /api/auth/university/invite`: token validates, accepts by creating or linking an account with role student/staff, decrements seats | **[KEEP]** | Reuse for academic-supervisor invites. |
| 12 | Frontend session handling | token in `localStorage` mirrored to `access_token` cookie (`lib/auth/token.ts`); `proxy.ts` decodes the cookie, enforces locale and role-prefixed dashboards, redirects logged-in users away from auth pages; `AuthContext` fetches `/api/auth/me`; `logoutSync` broadcasts logout across tabs | **[KEEP]** | |
| 13 | Onboarding assessment gate | `has_completed_assessment` forces the AI profile quiz before the learner dashboard; `PATCH users/me/track` stores the detected track | **[REPURPOSE]** | Replace with a mentee intake form (PFE topic, school, deadline). |
| 14 | `SessionAuthGuard` | HMAC-signed `auth_session` cookie verified with `SESSION_SECRET`; no controller uses it | **[DROP]** | Dead legacy path. |
| 15 | Auth0 remnants | `frontend/auth0-actions/add-role-claims.js`, `backend/app/nestjs-api/src/auth/strategies/auth0.strategy.ts`, `passwordHash === 'auth0-managed'` sentinel | **[DROP]** | Dead legacy; `backend/app/nestjs-api` is an abandoned duplicate API. |

---

## 3. Billing, subscription and credit logic

Source: `backend/api/src/subscriptions/`, `payments/`, `manual-payments/`, `promo-codes/`, `referrals/`, `commercial/`, `platform/agent-quota.service.ts`, `usage/`, `cloud-sandbox/`, `frontend/lib/config/plans.ts`, `frontend/components/pricing`, `frontend/components/subscription`.

| # | Mechanism | Current rule | Verdict | Note |
|---|---|---|---|---|
| 1 | Plan catalogue | `subscription_plans` types free/standard/premium/vip/university/enterprise; `GET /api/public/plans`; admin CRUD | **[KEEP]** | `vip` = Subul XP mentorship pass. |
| 2 | Regional pricing | `plan_billing_options` per region TN/EU/US/MA/GB/DEFAULT and cycle; `GeoService` resolves region from IP (`/api/payments/detect-geo`, `/api/geo/region`) | **[KEEP]** | |
| 3 | Subul XP duration tiers | Migration `SeedSubulXpTiers`: 2 months 299 TND, 4 months 399 TND, 6 months (TN only); `duration_months` on billing options and transactions; `SubulXpTierCard.tsx` | **[KEEP]** | Already the mentorship pricing. |
| 4 | Tier ordering and upgrade rules | `TIER_ORDER = standard < premium < vip`; `assertCanUsePersonalSubscriptionFlow`, `resolveLearnerCheckoutPlanSlug` (upgrade vs renew, no downgrade while active) | **[KEEP]** | |
| 5 | Trial | 24-hour trial (`TRIAL_HOURS = 24`) auto-started on first learner dashboard load; `POST /api/subscriptions/me/start-trial`; status machine trial/active/expired/cancelled/pending_payment/none; `TrialStatusCard`, `SubscriptionStatusBanner` | **[KEEP]** | Revisit the 24h window for a mentorship product. |
| 6 | Entitlements | `config/plans.ts` → `PUBLIC_PLANS[slug].entitlements`; `effectivePublicPlanSlug()` maps institutional students to premium; certifications require premium-equivalent (`lib/subscription/certificationAccess.ts`) | **[REPURPOSE]** | Re-express entitlements as sessions per month, mentor access, PFE tracking. |
| 7 | Institutional seats | `university_licenses.seats_total/seats_used`; `hasActiveInstitutionalStudentSeat()`; `UniversityAccessGate.tsx` | **[KEEP]** | |
| 8 | Stripe | `POST /api/payments/checkout/stripe` → PaymentIntent; `POST /api/webhooks/stripe` handles success/refund/chargeback/failure; `stripe-verify` fallback; admin refund | **[KEEP]** | |
| 9 | Flouci (Tunisia) | `checkout/flouci`, `GET /api/webhooks/flouci/callback`, `POST /api/webhooks/flouci`, reconcile/expire endpoints | **[KEEP]** | |
| 10 | PayPal | `checkout` (PayPal order), capture/cancel endpoints, `POST /api/webhooks/paypal` | **[KEEP]** | |
| 11 | Transaction integrity | `payment_transactions.idempotency_key` unique, `HardenCheckoutIntegrityIndexes` migration, idempotent fulfilment → `activatePaidSubscription()` expires prior trial | **[KEEP]** | |
| 12 | Manual payments | Learner files bank-transfer/D17 request with proof upload; admin approve/reject/request-proof; approval activates subscription for `selected_duration_months` | **[KEEP]** | |
| 13 | Promo codes | percentage/fixed, plan scope, max uses, per-user limit, date window, currency scope, commercial attribution; guest validation | **[KEEP]** | |
| 14 | Referral rewards | 5 qualified referrals → one 100 TND reward block; 30-day waiting period after activation; refund/chargeback reverses unpaid blocks; fraud flags; payout via bank/D17; admin approve → mark-paid | **[KEEP]** | Payout tables double as mentor payout rails. |
| 15 | Commercial affiliates | `commercial_profiles` + promo codes tagged with `commercial_id`; stats and charts for admin and the partner | **[KEEP]** | |
| 16 | AI agent quota | `AgentQuotaService.consumeAgent(userId, key)` increments `agent_usage_monthly`, limit from `platform_settings.agent_limits`, plan entitlement `agent_monthly_limit` or `users.agent_limit_override`; 429 when exceeded; admin reset | **[DROP]** | AI agent credit system. |
| 17 | Sandbox hour quota | `sandbox_usage_monthly.seconds_used`, concurrent and monthly-hour limits with per-user overrides, `cost_to_date_usd` | **[DROP]** | *no fit*. |
| 18 | Voice cost metering | `POST /api/usage/voice-stt|voice-tts` → Prometheus counters for Deepgram/Cartesia cost per tier | **[DROP]** | AI avatar/voice. |

---

## 4. API routes (481 handlers)

Source: every `@Controller` under `backend/api/src/`. Paths are shown as mounted (global prefix is part of each controller path). Grouped by controller prefix; a verdict is given per route.

#### `/` — 1 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/` | **[KEEP]** | Health + client error sink |

#### `/api/admin/agent-usage` — 2 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/agent-usage` | **[DROP]** | AI agent quota admin |
| POST | `/api/admin/agent-usage/reset` | **[DROP]** | AI agent quota admin |

#### `/api/admin/analytics` — 1 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/analytics/overview` | **[KEEP]** | User admin and KPIs |

#### `/api/admin/auth-stats` — 1 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/auth-stats` | **[KEEP]** | User admin and KPIs |

#### `/api/admin/certifications` — 13 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/certifications` | **[DROP]** | Vendor certification catalogue - no fit |
| POST | `/api/admin/certifications` | **[DROP]** | Vendor certification catalogue - no fit |
| DELETE | `/api/admin/certifications/:id` | **[DROP]** | Vendor certification catalogue - no fit |
| GET | `/api/admin/certifications/:id` | **[DROP]** | Vendor certification catalogue - no fit |
| PUT | `/api/admin/certifications/:id` | **[DROP]** | Vendor certification catalogue - no fit |
| PATCH | `/api/admin/certifications/:id/availability` | **[DROP]** | Vendor certification catalogue - no fit |
| POST | `/api/admin/certifications/:id/enroll` | **[REPURPOSE]** | Issued certificates + ordered paths -> PFE attestation + roadmap |
| GET | `/api/admin/certifications/:id/enrollment` | **[REPURPOSE]** | Issued certificates + ordered paths -> PFE attestation + roadmap |
| PATCH | `/api/admin/certifications/:id/link-course` | **[DROP]** | Vendor certification catalogue - no fit |
| GET | `/api/admin/certifications/:id/path` | **[REPURPOSE]** | Issued certificates + ordered paths -> PFE attestation + roadmap |
| PUT | `/api/admin/certifications/:id/path` | **[REPURPOSE]** | Issued certificates + ordered paths -> PFE attestation + roadmap |
| POST | `/api/admin/certifications/import/certif-courses` | **[DROP]** | Vendor certification catalogue - no fit |
| GET | `/api/admin/certifications/issued/:id/download` | **[REPURPOSE]** | Issued certificates + ordered paths -> PFE attestation + roadmap |

#### `/api/admin/cloud-sandbox` — 5 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/cloud-sandbox/sessions` | **[DROP]** | Cloud sandbox provisioning (AWS/Azure) - no mentorship fit |
| POST | `/api/admin/cloud-sandbox/sessions/:id/terminate` | **[DROP]** | Cloud sandbox provisioning (AWS/Azure) - no mentorship fit |
| GET | `/api/admin/cloud-sandbox/settings` | **[DROP]** | Cloud sandbox provisioning (AWS/Azure) - no mentorship fit |
| POST | `/api/admin/cloud-sandbox/settings` | **[DROP]** | Cloud sandbox provisioning (AWS/Azure) - no mentorship fit |
| GET | `/api/admin/cloud-sandbox/stats` | **[DROP]** | Cloud sandbox provisioning (AWS/Azure) - no mentorship fit |

#### `/api/admin/commercials` — 15 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/commercials` | **[KEEP]** | Sales-partner / ambassador programme |
| POST | `/api/admin/commercials` | **[KEEP]** | Sales-partner / ambassador programme |
| DELETE | `/api/admin/commercials/:id` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/admin/commercials/:id` | **[KEEP]** | Sales-partner / ambassador programme |
| PATCH | `/api/admin/commercials/:id` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/admin/commercials/:id/chart/referrals` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/admin/commercials/:id/chart/revenue` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/admin/commercials/:id/codes` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/admin/commercials/:id/referrals` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/admin/commercials/:id/stats` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/admin/commercials/chart/referrals` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/admin/commercials/chart/revenue` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/admin/commercials/chart/top-codes` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/admin/commercials/chart/top-commercials` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/admin/commercials/overview` | **[KEEP]** | Sales-partner / ambassador programme |

#### `/api/admin/companies` — 7 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/companies` | **[KEEP]** | Host companies / employer accounts |
| POST | `/api/admin/companies` | **[KEEP]** | Host companies / employer accounts |
| POST | `/api/admin/companies/:companyId/employees` | **[KEEP]** | Host companies / employer accounts |
| PATCH | `/api/admin/companies/:companyId/employees/:employeeId/status` | **[KEEP]** | Host companies / employer accounts |
| DELETE | `/api/admin/companies/:id` | **[KEEP]** | Host companies / employer accounts |
| GET | `/api/admin/companies/:id` | **[KEEP]** | Host companies / employer accounts |
| PATCH | `/api/admin/companies/:id` | **[KEEP]** | Host companies / employer accounts |

#### `/api/admin/content` — 21 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/content/certifications` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| POST | `/api/admin/content/certifications` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| PATCH | `/api/admin/content/certifications/:id` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| GET | `/api/admin/content/certifications/:id/full` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| POST | `/api/admin/content/import/certification-paths-json` | **[REPURPOSE]** | Ordered step paths -> PFE roadmap templates |
| POST | `/api/admin/content/import/certifications-json` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| POST | `/api/admin/content/import/courses-json` | **[REPURPOSE]** | JSON course import -> import PFE milestone templates |
| POST | `/api/admin/content/import/courses-json/validate` | **[REPURPOSE]** | JSON course import -> import PFE milestone templates |
| POST | `/api/admin/content/import/labs-json` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| POST | `/api/admin/content/import/practice-exams-json` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| GET | `/api/admin/content/labs` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| POST | `/api/admin/content/labs` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| DELETE | `/api/admin/content/labs/:slug` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| PATCH | `/api/admin/content/labs/:slug` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| GET | `/api/admin/content/practice-exams` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| POST | `/api/admin/content/practice-exams` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| DELETE | `/api/admin/content/practice-exams/:slug` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| GET | `/api/admin/content/practice-exams/:slug` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| PATCH | `/api/admin/content/practice-exams/:slug` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| POST | `/api/admin/content/practice-exams/import-json` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |
| POST | `/api/admin/content/practice-exams/import-json/validate` | **[DROP]** | Cloud lab / cert / practice exam content - no fit |

#### `/api/admin/content-indexer` — 11 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/content-indexer/certifications-status` | **[DROP]** | RAG index for AI tutors (Azure Search embeddings) |
| GET | `/api/admin/content-indexer/courses-status` | **[DROP]** | RAG index for AI tutors (Azure Search embeddings) |
| GET | `/api/admin/content-indexer/labs-status` | **[DROP]** | RAG index for AI tutors (Azure Search embeddings) |
| POST | `/api/admin/content-indexer/reindex/certification/:id` | **[DROP]** | RAG index for AI tutors (Azure Search embeddings) |
| POST | `/api/admin/content-indexer/reindex/course/:courseId` | **[DROP]** | RAG index for AI tutors (Azure Search embeddings) |
| POST | `/api/admin/content-indexer/reindex/lab/:slug` | **[DROP]** | RAG index for AI tutors (Azure Search embeddings) |
| GET | `/api/admin/content-indexer/status` | **[DROP]** | RAG index for AI tutors (Azure Search embeddings) |
| POST | `/api/admin/content-indexer/sync` | **[DROP]** | RAG index for AI tutors (Azure Search embeddings) |
| POST | `/api/admin/content-indexer/test-retrieval/certification/:id` | **[DROP]** | RAG index for AI tutors (Azure Search embeddings) |
| POST | `/api/admin/content-indexer/test-retrieval/course/:courseId` | **[DROP]** | RAG index for AI tutors (Azure Search embeddings) |
| POST | `/api/admin/content-indexer/test-retrieval/lab/:slug` | **[DROP]** | RAG index for AI tutors (Azure Search embeddings) |

#### `/api/admin/courses` — 5 routes, mostly [REPURPOSE]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/courses` | **[REPURPOSE]** | Course CRUD -> milestone template CRUD |
| POST | `/api/admin/courses` | **[REPURPOSE]** | Course CRUD -> milestone template CRUD |
| DELETE | `/api/admin/courses/:id` | **[REPURPOSE]** | Course CRUD -> milestone template CRUD |
| GET | `/api/admin/courses/:id` | **[REPURPOSE]** | Course CRUD -> milestone template CRUD |
| PATCH | `/api/admin/courses/:id` | **[REPURPOSE]** | Course CRUD -> milestone template CRUD |

#### `/api/admin/emailing` — 4 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/emailing/plan-counts` | **[KEEP]** | Admin bulk email |
| POST | `/api/admin/emailing/preview-count` | **[KEEP]** | Admin bulk email |
| GET | `/api/admin/emailing/search-users` | **[KEEP]** | Admin bulk email |
| POST | `/api/admin/emailing/send` | **[KEEP]** | Admin bulk email |

#### `/api/admin/employers` — 2 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/employers` | **[KEEP]** | Host companies / employer accounts |
| POST | `/api/admin/employers` | **[KEEP]** | Host companies / employer accounts |

#### `/api/admin/feedback` — 5 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/feedback` | **[DROP]** | Quiz/AI-question feedback (admin feedback routes are stubs) |
| DELETE | `/api/admin/feedback/:id` | **[DROP]** | Quiz/AI-question feedback (admin feedback routes are stubs) |
| GET | `/api/admin/feedback/:id` | **[DROP]** | Quiz/AI-question feedback (admin feedback routes are stubs) |
| PATCH | `/api/admin/feedback/:id` | **[DROP]** | Quiz/AI-question feedback (admin feedback routes are stubs) |
| GET | `/api/admin/feedback/stats` | **[DROP]** | Quiz/AI-question feedback (admin feedback routes are stubs) |

#### `/api/admin/jobs` — 3 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/jobs` | **[KEEP]** | Offer board with admin moderation -> PFE/internship offers |
| GET | `/api/admin/jobs/:id` | **[KEEP]** | Offer board with admin moderation -> PFE/internship offers |
| PATCH | `/api/admin/jobs/:id/status` | **[KEEP]** | Offer board with admin moderation -> PFE/internship offers |

#### `/api/admin/lab-access` — 8 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/lab-access/credentials` | **[DROP]** | Shared cloud credentials vault - no fit |
| POST | `/api/admin/lab-access/credentials` | **[DROP]** | Shared cloud credentials vault - no fit |
| DELETE | `/api/admin/lab-access/credentials/:id` | **[DROP]** | Shared cloud credentials vault - no fit |
| PATCH | `/api/admin/lab-access/credentials/:id` | **[DROP]** | Shared cloud credentials vault - no fit |
| GET | `/api/admin/lab-access/sessions` | **[DROP]** | Shared cloud credentials vault - no fit |
| POST | `/api/admin/lab-access/sessions` | **[DROP]** | Shared cloud credentials vault - no fit |
| DELETE | `/api/admin/lab-access/sessions/:id` | **[DROP]** | Shared cloud credentials vault - no fit |
| POST | `/api/admin/lab-access/sessions/bulk` | **[DROP]** | Shared cloud credentials vault - no fit |

#### `/api/admin/learners` — 8 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/learners` | **[KEEP]** | Mentee administration (filters, staff options) |
| GET | `/api/admin/learners/:userId` | **[KEEP]** | Mentee administration (filters, staff options) |
| POST | `/api/admin/learners/:userId/assign` | **[REPURPOSE]** | Content assignment -> milestone/deliverable assignment |
| DELETE | `/api/admin/learners/:userId/assign/:id` | **[REPURPOSE]** | Content assignment -> milestone/deliverable assignment |
| GET | `/api/admin/learners/:userId/assignments` | **[REPURPOSE]** | Content assignment -> milestone/deliverable assignment |
| PATCH | `/api/admin/learners/:userId/mentor` | **[KEEP]** | Admin assigns a human mentor to a learner |
| POST | `/api/admin/learners/bulk-assign` | **[REPURPOSE]** | Content assignment -> milestone/deliverable assignment |
| GET | `/api/admin/learners/staff-options` | **[KEEP]** | Mentee administration (filters, staff options) |

#### `/api/admin/manual-payments` — 7 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/manual-payments` | **[KEEP]** | Payments core |
| GET | `/api/admin/manual-payments/:id` | **[KEEP]** | Payments core |
| PATCH | `/api/admin/manual-payments/:id/approve` | **[KEEP]** | Payments core |
| PATCH | `/api/admin/manual-payments/:id/reject` | **[KEEP]** | Payments core |
| PATCH | `/api/admin/manual-payments/:id/request-proof` | **[KEEP]** | Payments core |
| GET | `/api/admin/manual-payments/proof/:filename` | **[KEEP]** | Payments core |
| GET | `/api/admin/manual-payments/stats` | **[KEEP]** | Payments core |

#### `/api/admin/overview` — 1 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/overview` | **[KEEP]** | User admin and KPIs |

#### `/api/admin/progression` — 1 routes, mostly [REPURPOSE]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/progression` | **[REPURPOSE]** | Learner progression report -> milestone progress report |

#### `/api/admin/promo-codes` — 8 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/promo-codes` | **[KEEP]** | Promo codes |
| POST | `/api/admin/promo-codes` | **[KEEP]** | Promo codes |
| DELETE | `/api/admin/promo-codes/:id` | **[KEEP]** | Promo codes |
| GET | `/api/admin/promo-codes/:id` | **[KEEP]** | Promo codes |
| PATCH | `/api/admin/promo-codes/:id` | **[KEEP]** | Promo codes |
| GET | `/api/admin/promo-codes/:id/stats` | **[KEEP]** | Promo codes |
| POST | `/api/admin/promo-codes/validate` | **[KEEP]** | Promo codes |
| POST | `/api/admin/promo-codes/validate/guest` | **[KEEP]** | Promo codes |

#### `/api/admin/quiz-feedback` — 3 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/quiz-feedback` | **[DROP]** | Quiz/AI-question feedback (admin feedback routes are stubs) |
| PATCH | `/api/admin/quiz-feedback/:id/status` | **[DROP]** | Quiz/AI-question feedback (admin feedback routes are stubs) |
| GET | `/api/admin/quiz-feedback/stats` | **[DROP]** | Quiz/AI-question feedback (admin feedback routes are stubs) |

#### `/api/admin/quiz-results` — 2 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/quiz-results/assessments` | **[DROP]** | Quiz/AI-question feedback (admin feedback routes are stubs) |
| GET | `/api/admin/quiz-results/quiz-levels` | **[DROP]** | Quiz/AI-question feedback (admin feedback routes are stubs) |

#### `/api/admin/referrals` — 13 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/referrals` | **[KEEP]** | Referral rewards and payouts |
| PATCH | `/api/admin/referrals/:id/flag-fraud` | **[KEEP]** | Referral rewards and payouts |
| PATCH | `/api/admin/referrals/:id/reject` | **[KEEP]** | Referral rewards and payouts |
| GET | `/api/admin/referrals/audit-log` | **[KEEP]** | Referral rewards and payouts |
| GET | `/api/admin/referrals/payout-requests` | **[KEEP]** | Referral rewards and payouts |
| GET | `/api/admin/referrals/payout-requests/:id` | **[KEEP]** | Referral rewards and payouts |
| PATCH | `/api/admin/referrals/payout-requests/:id/approve` | **[KEEP]** | Referral rewards and payouts |
| PATCH | `/api/admin/referrals/payout-requests/:id/mark-paid` | **[KEEP]** | Referral rewards and payouts |
| PATCH | `/api/admin/referrals/payout-requests/:id/reject` | **[KEEP]** | Referral rewards and payouts |
| POST | `/api/admin/referrals/recompute` | **[KEEP]** | Referral rewards and payouts |
| GET | `/api/admin/referrals/rewards` | **[KEEP]** | Referral rewards and payouts |
| GET | `/api/admin/referrals/stats` | **[KEEP]** | Referral rewards and payouts |
| GET | `/api/admin/referrals/top-referrers` | **[KEEP]** | Referral rewards and payouts |

#### `/api/admin/settings` — 2 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/settings/agent-limits` | **[DROP]** | AI agent quota admin |
| PATCH | `/api/admin/settings/agent-limits` | **[DROP]** | AI agent quota admin |

#### `/api/admin/stats` — 1 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/stats` | **[KEEP]** | User admin and KPIs |

#### `/api/admin/subscription-plans` — 3 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/subscription-plans` | **[KEEP]** | Plan catalogue and entitlement status |
| POST | `/api/admin/subscription-plans` | **[KEEP]** | Plan catalogue and entitlement status |
| PATCH | `/api/admin/subscription-plans/:id` | **[KEEP]** | Plan catalogue and entitlement status |

#### `/api/admin/test-email` — 1 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| POST | `/api/admin/test-email` | **[KEEP]** | Admin bulk email |

#### `/api/admin/transactions` — 5 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/transactions` | **[KEEP]** | Payments core |
| GET | `/api/admin/transactions/:id` | **[KEEP]** | Payments core |
| POST | `/api/admin/transactions/:id/refund` | **[KEEP]** | Payments core |
| GET | `/api/admin/transactions/analytics` | **[KEEP]** | Payments core |
| GET | `/api/admin/transactions/stats` | **[KEEP]** | Payments core |

#### `/api/admin/universities` — 18 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/universities` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/admin/universities` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| DELETE | `/api/admin/universities/:id` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/admin/universities/:id` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| PATCH | `/api/admin/universities/:id` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/admin/universities/:id/analytics` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/admin/universities/:id/audit-log` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/admin/universities/:id/licenses` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/admin/universities/:id/licenses` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| PATCH | `/api/admin/universities/:id/licenses/:licId` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/admin/universities/:id/members` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/admin/universities/:id/members` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| DELETE | `/api/admin/universities/:id/members/:userId` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/admin/universities/:id/programs` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/admin/universities/:id/resend-setup` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/admin/universities/:id/set-temp-password` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/admin/universities/:id/staff` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/admin/universities/expiring-soon` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |

#### `/api/admin/users` — 10 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/users` | **[KEEP]** | User admin and KPIs |
| POST | `/api/admin/users` | **[KEEP]** | User admin and KPIs |
| DELETE | `/api/admin/users/:id` | **[KEEP]** | User admin and KPIs |
| GET | `/api/admin/users/:id` | **[KEEP]** | User admin and KPIs |
| PATCH | `/api/admin/users/:id` | **[KEEP]** | User admin and KPIs |
| PATCH | `/api/admin/users/:id/agent-limit-override` | **[DROP]** | AI agent quota override |
| POST | `/api/admin/users/:id/approve` | **[KEEP]** | User admin and KPIs |
| PATCH | `/api/admin/users/:id/password` | **[KEEP]** | User admin and KPIs |
| POST | `/api/admin/users/:id/send-reset-password` | **[KEEP]** | User admin and KPIs |
| PATCH | `/api/admin/users/:id/status` | **[KEEP]** | User admin and KPIs |

#### `/api/admin/vip-meetings` — 4 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/vip-meetings` | **[KEEP]** | Mentor meeting scheduling (admin-created) - core marketplace object |
| POST | `/api/admin/vip-meetings` | **[KEEP]** | Mentor meeting scheduling (admin-created) - core marketplace object |
| DELETE | `/api/admin/vip-meetings/:id` | **[KEEP]** | Mentor meeting scheduling (admin-created) - core marketplace object |
| PATCH | `/api/admin/vip-meetings/:id` | **[KEEP]** | Mentor meeting scheduling (admin-created) - core marketplace object |

#### `/api/admin/vip-real-projects` — 4 routes, mostly [REPURPOSE]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/admin/vip-real-projects` | **[REPURPOSE]** | Assigned real project -> PFE project record |
| POST | `/api/admin/vip-real-projects` | **[REPURPOSE]** | Assigned real project -> PFE project record |
| DELETE | `/api/admin/vip-real-projects/:id` | **[REPURPOSE]** | Assigned real project -> PFE project record |
| PATCH | `/api/admin/vip-real-projects/:id` | **[REPURPOSE]** | Assigned real project -> PFE project record |

#### `/api/auth` — 11 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| POST | `/api/auth/change-email` | **[KEEP]** | Local JWT auth |
| POST | `/api/auth/forgot-password-email` | **[KEEP]** | Local JWT auth |
| POST | `/api/auth/login` | **[KEEP]** | Local JWT auth |
| GET | `/api/auth/logout` | **[KEEP]** | Local JWT auth |
| GET | `/api/auth/me` | **[KEEP]** | Local JWT auth |
| POST | `/api/auth/register` | **[KEEP]** | Local JWT auth |
| POST | `/api/auth/resend-verification` | **[KEEP]** | Local JWT auth |
| POST | `/api/auth/reset-password` | **[KEEP]** | Local JWT auth |
| POST | `/api/auth/verify-email` | **[KEEP]** | Local JWT auth |
| GET | `/api/auth/verify-email/:token` | **[KEEP]** | Local JWT auth |
| POST | `/api/auth/verify-email/resend` | **[KEEP]** | Local JWT auth |

#### `/api/auth/university` — 4 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/auth/university/invite` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/auth/university/invite` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/auth/university/setup` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/auth/university/setup` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |

#### `/api/certificates` — 1 routes, mostly [REPURPOSE]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/certificates/verify/:code` | **[REPURPOSE]** | Issued certificates + ordered paths -> PFE attestation + roadmap |

#### `/api/cloud-tutor` — 3 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| POST | `/api/cloud-tutor/chat` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/cloud-tutor/quota` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/cloud-tutor/session/end` | **[DROP]** | Proxied to Python AI agents |

#### `/api/coach` — 1 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| POST | `/api/coach/chat` | **[DROP]** | Proxied to Python AI agents |

#### `/api/commercial` — 6 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/commercial/chart/referrals` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/commercial/chart/revenue` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/commercial/codes` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/commercial/me` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/commercial/referrals` | **[KEEP]** | Sales-partner / ambassador programme |
| GET | `/api/commercial/stats` | **[KEEP]** | Sales-partner / ambassador programme |

#### `/api/courses` — 6 routes, mostly [REPURPOSE]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/courses/:courseId` | **[REPURPOSE]** | Course progress (start/complete lesson) -> milestone progress |
| POST | `/api/courses/:courseId/complete-lab` | **[REPURPOSE]** | Course progress (start/complete lesson) -> milestone progress |
| POST | `/api/courses/:courseId/complete-lesson` | **[REPURPOSE]** | Course progress (start/complete lesson) -> milestone progress |
| GET | `/api/courses/:courseId/progress` | **[REPURPOSE]** | Course progress (start/complete lesson) -> milestone progress |
| POST | `/api/courses/:courseId/start` | **[REPURPOSE]** | Course progress (start/complete lesson) -> milestone progress |
| GET | `/api/courses/my-courses` | **[REPURPOSE]** | Course progress (start/complete lesson) -> milestone progress |

#### `/api/cv` — 11 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| DELETE | `/api/cv` | **[KEEP]** | CV file upload/storage for mentee profile |
| POST | `/api/cv/apply-format` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/cv/boost` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/cv/document` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/cv/extract` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/cv/me` | **[KEEP]** | CV file upload/storage for mentee profile |
| GET | `/api/cv/platform-data/:userId` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/cv/save` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/cv/status` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/cv/store-user` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/cv/upload` | **[KEEP]** | CV file upload/storage for mentee profile |

#### `/api/employer` — 21 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/employer/candidates` | **[KEEP]** | Interview scheduling + candidate pipeline -> session booking / applicant tracking |
| GET | `/api/employer/candidates/:id` | **[KEEP]** | Interview scheduling + candidate pipeline -> session booking / applicant tracking |
| PATCH | `/api/employer/candidates/:id/status` | **[KEEP]** | Interview scheduling + candidate pipeline -> session booking / applicant tracking |
| GET | `/api/employer/certified-learners` | **[REPURPOSE]** | Company's tracked learners -> company's interns |
| POST | `/api/employer/certified-learners` | **[REPURPOSE]** | Company's tracked learners -> company's interns |
| DELETE | `/api/employer/certified-learners/:id` | **[REPURPOSE]** | Company's tracked learners -> company's interns |
| GET | `/api/employer/certified-learners/:id` | **[REPURPOSE]** | Company's tracked learners -> company's interns |
| PATCH | `/api/employer/certified-learners/:id` | **[REPURPOSE]** | Company's tracked learners -> company's interns |
| GET | `/api/employer/company` | **[KEEP]** | Employer dashboard, company, employees |
| PATCH | `/api/employer/company` | **[KEEP]** | Employer dashboard, company, employees |
| GET | `/api/employer/dashboard` | **[KEEP]** | Employer dashboard, company, employees |
| GET | `/api/employer/employees` | **[KEEP]** | Employer dashboard, company, employees |
| POST | `/api/employer/employees` | **[KEEP]** | Employer dashboard, company, employees |
| DELETE | `/api/employer/employees/:id` | **[KEEP]** | Employer dashboard, company, employees |
| GET | `/api/employer/employees/:id` | **[KEEP]** | Employer dashboard, company, employees |
| PATCH | `/api/employer/employees/:id` | **[KEEP]** | Employer dashboard, company, employees |
| GET | `/api/employer/interviews` | **[KEEP]** | Interview scheduling + candidate pipeline -> session booking / applicant tracking |
| POST | `/api/employer/interviews` | **[KEEP]** | Interview scheduling + candidate pipeline -> session booking / applicant tracking |
| DELETE | `/api/employer/interviews/:id` | **[KEEP]** | Interview scheduling + candidate pipeline -> session booking / applicant tracking |
| PATCH | `/api/employer/interviews/:id` | **[KEEP]** | Interview scheduling + candidate pipeline -> session booking / applicant tracking |
| GET | `/api/employer/jobs` | **[KEEP]** | Employer dashboard, company, employees |

#### `/api/errors` — 1 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| POST | `/api/errors` | **[KEEP]** | Health + client error sink |

#### `/api/exams` — 4 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/exams` | **[DROP]** | Cloud labs and exam engine - no fit |
| GET | `/api/exams/:examId/session` | **[DROP]** | Cloud labs and exam engine - no fit |
| POST | `/api/exams/:examId/submit` | **[DROP]** | Cloud labs and exam engine - no fit |
| GET | `/api/exams/streak` | **[DROP]** | Cloud labs and exam engine - no fit |

#### `/api/geo` — 2 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/geo/debug` | **[KEEP]** | Region detection for pricing |
| GET | `/api/geo/region` | **[KEEP]** | Region detection for pricing |

#### `/api/goals` — 28 routes, mostly [REPURPOSE]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/goals` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| POST | `/api/goals` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| DELETE | `/api/goals/:id` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| GET | `/api/goals/:id` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| PATCH | `/api/goals/:id` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| POST | `/api/goals/:id/milestones` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| DELETE | `/api/goals/:id/milestones/:milestone` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| GET | `/api/goals/daily` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| POST | `/api/goals/daily` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| DELETE | `/api/goals/daily/:id` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| PATCH | `/api/goals/daily/:id` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| PATCH | `/api/goals/daily/:id/toggle` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| GET | `/api/goals/daily/by-date/:date` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| GET | `/api/goals/daily/by-id/:id` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| GET | `/api/goals/daily/stats` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| GET | `/api/goals/daily/today` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| GET | `/api/goals/daily/weekly-stats` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| POST | `/api/goals/generate` | **[DROP]** | Azure OpenAI goal generation |
| GET | `/api/goals/stats` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| GET | `/api/goals/weekly` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| POST | `/api/goals/weekly` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| DELETE | `/api/goals/weekly/:id` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| GET | `/api/goals/weekly/:id` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| PATCH | `/api/goals/weekly/:id` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| PATCH | `/api/goals/weekly/:id/progress` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| GET | `/api/goals/weekly/:weekNumber/:year` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| GET | `/api/goals/weekly/current` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |
| GET | `/api/goals/weekly/current/stats` | **[REPURPOSE]** | Goals with milestones, daily/weekly goals -> PFE milestones and sprint check-ins |

#### `/api/heygen` — 1 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/heygen/token` | **[DROP]** | AI avatar / voice STT-TTS cost tracking |

#### `/api/job-search` — 13 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| POST | `/api/job-search/analyze-cv` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/job-search/ats-score` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/job-search/chat` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/job-search/chat/history` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/job-search/chat/reset` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/job-search/gap` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/job-search/jobs` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/job-search/market` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/job-search/profile` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/job-search/profile` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/job-search/report` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/job-search/roadmap` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/job-search/scan` | **[DROP]** | Proxied to Python AI agents |

#### `/api/jobs` — 5 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/jobs` | **[KEEP]** | Offer board with admin moderation -> PFE/internship offers |
| POST | `/api/jobs` | **[KEEP]** | Offer board with admin moderation -> PFE/internship offers |
| DELETE | `/api/jobs/:id` | **[KEEP]** | Offer board with admin moderation -> PFE/internship offers |
| GET | `/api/jobs/:id` | **[KEEP]** | Offer board with admin moderation -> PFE/internship offers |
| PATCH | `/api/jobs/:id` | **[KEEP]** | Offer board with admin moderation -> PFE/internship offers |

#### `/api/labs` — 13 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/labs` | **[DROP]** | Cloud labs and exam engine - no fit |
| POST | `/api/labs` | **[DROP]** | Cloud labs and exam engine - no fit |
| DELETE | `/api/labs/:slug` | **[DROP]** | Cloud labs and exam engine - no fit |
| GET | `/api/labs/:slug` | **[DROP]** | Cloud labs and exam engine - no fit |
| PATCH | `/api/labs/:slug` | **[DROP]** | Cloud labs and exam engine - no fit |
| GET | `/api/labs/:slug/progress` | **[DROP]** | Cloud labs and exam engine - no fit |
| POST | `/api/labs/:slug/progress` | **[DROP]** | Cloud labs and exam engine - no fit |
| POST | `/api/labs/:slug/start` | **[DROP]** | Cloud labs and exam engine - no fit |
| GET | `/api/labs/admin` | **[DROP]** | Cloud labs and exam engine - no fit |
| GET | `/api/labs/my/progress` | **[DROP]** | Cloud labs and exam engine - no fit |
| POST | `/api/labs/seed/aws` | **[DROP]** | Cloud labs and exam engine - no fit |
| POST | `/api/labs/seed/aws-admin` | **[DROP]** | Cloud labs and exam engine - no fit |
| GET | `/api/labs/stats` | **[DROP]** | Cloud labs and exam engine - no fit |

#### `/api/learner-emploi` — 3 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| POST | `/api/learner-emploi/analyze` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/learner-emploi/jobs` | **[DROP]** | ATS-scored job list via agent |
| GET | `/api/learner-emploi/jobs/:jobId` | **[DROP]** | ATS-scored job list via agent |

#### `/api/learner/catalog` — 1 routes, mostly [REPURPOSE]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/learner/catalog/courses` | **[REPURPOSE]** | Learner dashboard aggregate -> mentee dashboard |

#### `/api/learner/certifications` — 11 routes, mostly [REPURPOSE]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/learner/certifications` | **[DROP]** | Vendor certification catalogue - no fit |
| GET | `/api/learner/certifications/:id/download` | **[REPURPOSE]** | Issued certificates + ordered paths -> PFE attestation + roadmap |
| POST | `/api/learner/certifications/:id/enroll` | **[DROP]** | Vendor certification catalogue - no fit |
| GET | `/api/learner/certifications/:id/experience` | **[DROP]** | Vendor certification catalogue - no fit |
| GET | `/api/learner/certifications/:id/path` | **[REPURPOSE]** | Issued certificates + ordered paths -> PFE attestation + roadmap |
| GET | `/api/learner/certifications/diagnostics` | **[DROP]** | Vendor certification catalogue - no fit |
| GET | `/api/learner/certifications/issued` | **[REPURPOSE]** | Issued certificates + ordered paths -> PFE attestation + roadmap |
| GET | `/api/learner/certifications/issued/:id` | **[REPURPOSE]** | Issued certificates + ordered paths -> PFE attestation + roadmap |
| GET | `/api/learner/certifications/issued/:id/download` | **[REPURPOSE]** | Issued certificates + ordered paths -> PFE attestation + roadmap |
| GET | `/api/learner/certifications/status` | **[DROP]** | Vendor certification catalogue - no fit |
| GET | `/api/learner/certifications/verify/:code` | **[REPURPOSE]** | Issued certificates + ordered paths -> PFE attestation + roadmap |

#### `/api/learner/cloud-sandbox` — 7 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/learner/cloud-sandbox/:sessionId` | **[DROP]** | Cloud sandbox provisioning (AWS/Azure) - no mentorship fit |
| GET | `/api/learner/cloud-sandbox/:sessionId/credentials` | **[DROP]** | Cloud sandbox provisioning (AWS/Azure) - no mentorship fit |
| POST | `/api/learner/cloud-sandbox/:sessionId/extend` | **[DROP]** | Cloud sandbox provisioning (AWS/Azure) - no mentorship fit |
| POST | `/api/learner/cloud-sandbox/:sessionId/terminate` | **[DROP]** | Cloud sandbox provisioning (AWS/Azure) - no mentorship fit |
| GET | `/api/learner/cloud-sandbox/active/:provider` | **[DROP]** | Cloud sandbox provisioning (AWS/Azure) - no mentorship fit |
| POST | `/api/learner/cloud-sandbox/launch` | **[DROP]** | Cloud sandbox provisioning (AWS/Azure) - no mentorship fit |
| GET | `/api/learner/cloud-sandbox/usage` | **[DROP]** | Cloud sandbox provisioning (AWS/Azure) - no mentorship fit |

#### `/api/learner/content-access` — 1 routes, mostly [REPURPOSE]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/learner/content-access` | **[REPURPOSE]** | Learner dashboard aggregate -> mentee dashboard |

#### `/api/learner/courses` — 2 routes, mostly [REPURPOSE]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/learner/courses` | **[REPURPOSE]** | Learner dashboard aggregate -> mentee dashboard |
| GET | `/api/learner/courses/:courseId/certificate/download` | **[REPURPOSE]** | Issued certificates + ordered paths -> PFE attestation + roadmap |

#### `/api/learner/dashboard` — 1 routes, mostly [REPURPOSE]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/learner/dashboard` | **[REPURPOSE]** | Learner dashboard aggregate -> mentee dashboard |

#### `/api/learner/lab-access` — 1 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/learner/lab-access/:provider` | **[DROP]** | Shared cloud credentials vault - no fit |

#### `/api/learner/labs` — 1 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/learner/labs` | **[DROP]** | Lab listing - no fit |

#### `/api/learner/vip-meetings` — 2 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/learner/vip-meetings` | **[KEEP]** | Mentor meeting scheduling (admin-created) - core marketplace object |
| GET | `/api/learner/vip-meetings/mentor` | **[KEEP]** | Mentor meeting scheduling (admin-created) - core marketplace object |

#### `/api/learner/vip-real-projects` — 1 routes, mostly [REPURPOSE]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/learner/vip-real-projects` | **[REPURPOSE]** | Assigned real project -> PFE project record |

#### `/api/manual-payments` — 5 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| POST | `/api/manual-payments` | **[KEEP]** | Payments core |
| POST | `/api/manual-payments/:id/proof` | **[KEEP]** | Payments core |
| GET | `/api/manual-payments/my` | **[KEEP]** | Payments core |
| GET | `/api/manual-payments/my/:id` | **[KEEP]** | Payments core |
| GET | `/api/manual-payments/proof/:filename` | **[KEEP]** | Payments core |

#### `/api/notifications` — 4 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/notifications` | **[KEEP]** | In-app notifications |
| PATCH | `/api/notifications/:id/read` | **[KEEP]** | In-app notifications |
| GET | `/api/notifications/admin` | **[KEEP]** | In-app notifications |
| GET | `/api/notifications/employer` | **[KEEP]** | In-app notifications |

#### `/api/payments` — 13 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/payments/admin/recent-paid` | **[KEEP]** | Payments core |
| GET | `/api/payments/admin/transactions` | **[KEEP]** | Payments core |
| POST | `/api/payments/checkout` | **[KEEP]** | Payments core |
| POST | `/api/payments/checkout/flouci` | **[KEEP]** | Payments core |
| POST | `/api/payments/checkout/stripe` | **[KEEP]** | Payments core |
| GET | `/api/payments/detect-geo` | **[KEEP]** | Payments core |
| GET | `/api/payments/pricing` | **[KEEP]** | Payments core |
| GET | `/api/payments/transaction/:id` | **[KEEP]** | Payments core |
| POST | `/api/payments/transaction/:id/cancel-paypal` | **[KEEP]** | Payments core |
| POST | `/api/payments/transaction/:id/capture-paypal` | **[KEEP]** | Payments core |
| POST | `/api/payments/transaction/:id/expire-flouci` | **[KEEP]** | Payments core |
| POST | `/api/payments/transaction/:id/reconcile-flouci` | **[KEEP]** | Payments core |
| POST | `/api/payments/transaction/:id/stripe-verify` | **[KEEP]** | Payments core |

#### `/api/practice-exams` — 4 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/practice-exams` | **[DROP]** | Cloud labs and exam engine - no fit |
| GET | `/api/practice-exams/:slug/attempts` | **[DROP]** | Cloud labs and exam engine - no fit |
| GET | `/api/practice-exams/:slug/session` | **[DROP]** | Cloud labs and exam engine - no fit |
| POST | `/api/practice-exams/:slug/submit` | **[DROP]** | Cloud labs and exam engine - no fit |

#### `/api/public` — 1 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/public/plans` | **[KEEP]** | Plan catalogue and entitlement status |

#### `/api/quiz` — 4 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/quiz/assessment-questions` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/quiz/evaluate` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/quiz/generate` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/quiz/session/end` | **[DROP]** | Proxied to Python AI agents |

#### `/api/quiz-feedback` — 1 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| POST | `/api/quiz-feedback` | **[DROP]** | Quiz/AI-question feedback (admin feedback routes are stubs) |

#### `/api/quiz-results` — 9 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| POST | `/api/quiz-results/assessment` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/quiz-results/assessment/attempts-count` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/quiz-results/assessment/history` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/quiz-results/assessment/latest` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/quiz-results/history` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/quiz-results/level` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/quiz-results/level/history` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/quiz-results/level/latest` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/quiz-results/roadmap` | **[DROP]** | Proxied to Python AI agents |

#### `/api/quote-requests` — 5 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/quote-requests` | **[KEEP]** | B2B quote (devis) requests |
| POST | `/api/quote-requests` | **[KEEP]** | B2B quote (devis) requests |
| DELETE | `/api/quote-requests/:id` | **[KEEP]** | B2B quote (devis) requests |
| GET | `/api/quote-requests/:id` | **[KEEP]** | B2B quote (devis) requests |
| PATCH | `/api/quote-requests/:id/status` | **[KEEP]** | B2B quote (devis) requests |

#### `/api/referral` — 9 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| POST | `/api/referral/claim-all` | **[KEEP]** | Referral rewards and payouts |
| GET | `/api/referral/me` | **[KEEP]** | Referral rewards and payouts |
| GET | `/api/referral/payout-accounts` | **[KEEP]** | Referral rewards and payouts |
| POST | `/api/referral/payout-accounts` | **[KEEP]** | Referral rewards and payouts |
| DELETE | `/api/referral/payout-accounts/:id` | **[KEEP]** | Referral rewards and payouts |
| GET | `/api/referral/payout-requests` | **[KEEP]** | Referral rewards and payouts |
| POST | `/api/referral/payout-requests` | **[KEEP]** | Referral rewards and payouts |
| POST | `/api/referral/recompute` | **[KEEP]** | Referral rewards and payouts |
| GET | `/api/referral/rewards` | **[KEEP]** | Referral rewards and payouts |

#### `/api/roadmap` — 15 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/roadmap` | **[REPURPOSE]** | Per-user ordered module list + progress -> PFE milestone roadmap |
| POST | `/api/roadmap/agent/generate` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/roadmap/analytics` | **[DROP]** | Score-driven roadmap generation |
| POST | `/api/roadmap/assess/analyze` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/roadmap/assess/message` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/roadmap/assess/questions` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/roadmap/certification-recommendations` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/roadmap/config` | **[REPURPOSE]** | Per-user ordered module list + progress -> PFE milestone roadmap |
| POST | `/api/roadmap/generate` | **[DROP]** | Score-driven roadmap generation |
| POST | `/api/roadmap/level/evaluate` | **[DROP]** | Proxied to Python AI agents |
| POST | `/api/roadmap/level/questions` | **[DROP]** | Proxied to Python AI agents |
| GET | `/api/roadmap/module/:moduleId` | **[REPURPOSE]** | Per-user ordered module list + progress -> PFE milestone roadmap |
| PUT | `/api/roadmap/progress/:moduleId` | **[REPURPOSE]** | Per-user ordered module list + progress -> PFE milestone roadmap |
| GET | `/api/roadmap/recommendations` | **[DROP]** | Score-driven roadmap generation |
| POST | `/api/roadmap/session/end` | **[DROP]** | Proxied to Python AI agents |

#### `/api/simli` — 3 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/simli/diagnostics` | **[DROP]** | AI avatar / voice STT-TTS cost tracking |
| GET | `/api/simli/ice` | **[DROP]** | AI avatar / voice STT-TTS cost tracking |
| GET | `/api/simli/token` | **[DROP]** | AI avatar / voice STT-TTS cost tracking |

#### `/api/subscriptions` — 2 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| POST | `/api/subscriptions/me/start-trial` | **[KEEP]** | Plan catalogue and entitlement status |
| GET | `/api/subscriptions/me/status` | **[KEEP]** | Plan catalogue and entitlement status |

#### `/api/university` — 30 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/university/audit-log` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/university/cohorts` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/university/cohorts` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| DELETE | `/api/university/cohorts/:id` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| PATCH | `/api/university/cohorts/:id` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/university/dashboard` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/university/departments` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/university/departments` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| DELETE | `/api/university/departments/:id` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| PATCH | `/api/university/departments/:id` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/university/invites` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/university/invites` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| DELETE | `/api/university/invites/:id` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/university/invites/:id/resend` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/university/invites/bulk` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/university/licenses` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| PATCH | `/api/university/me` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/university/memberships` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| PATCH | `/api/university/memberships/:id` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/university/my-institution` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/university/programs` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/university/programs` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| DELETE | `/api/university/programs/:programId` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| PATCH | `/api/university/programs/:programId` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/university/programs/:programId/enrollments` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| POST | `/api/university/programs/import-students` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/university/students` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| DELETE | `/api/university/students/:id` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| GET | `/api/university/students/:id` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |
| PATCH | `/api/university/students/:id` | **[KEEP]** | University tenant (school supervising PFE); programs/enrollments -> PFE programs |

#### `/api/usage` — 2 routes, mostly [DROP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| POST | `/api/usage/voice-stt` | **[DROP]** | AI avatar / voice STT-TTS cost tracking |
| POST | `/api/usage/voice-tts` | **[DROP]** | AI avatar / voice STT-TTS cost tracking |

#### `/api/users` — 13 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| GET | `/api/users` | **[KEEP]** | Profile, picture, admin user CRUD |
| POST | `/api/users` | **[KEEP]** | Profile, picture, admin user CRUD |
| DELETE | `/api/users/:id` | **[KEEP]** | Profile, picture, admin user CRUD |
| GET | `/api/users/:id` | **[KEEP]** | Profile, picture, admin user CRUD |
| PATCH | `/api/users/:id` | **[KEEP]** | Profile, picture, admin user CRUD |
| PATCH | `/api/users/:id/status` | **[KEEP]** | Profile, picture, admin user CRUD |
| POST | `/api/users/:id/verify-email` | **[KEEP]** | Profile, picture, admin user CRUD |
| GET | `/api/users/me` | **[KEEP]** | Profile, picture, admin user CRUD |
| PATCH | `/api/users/me/onboarding-tour` | **[KEEP]** | Profile, picture, admin user CRUD |
| PATCH | `/api/users/me/track` | **[REPURPOSE]** | Learning track (cloud/cyber/ai) -> PFE domain |
| PATCH | `/api/users/profile` | **[KEEP]** | Profile, picture, admin user CRUD |
| POST | `/api/users/profile-picture` | **[KEEP]** | Profile, picture, admin user CRUD |
| GET | `/api/users/test` | **[DROP]** | Debug endpoint |

#### `/api/webhooks` — 4 routes, mostly [KEEP]

| Method | Path | Verdict | Note |
|---|---|---|---|
| POST | `/api/webhooks/flouci` | **[KEEP]** | Payments core |
| GET | `/api/webhooks/flouci/callback` | **[KEEP]** | Payments core |
| POST | `/api/webhooks/paypal` | **[KEEP]** | Payments core |
| POST | `/api/webhooks/stripe` | **[KEEP]** | Payments core |
---

## 5. Frontend pages (138 `page.tsx`)

Source: `frontend/app/`. All product pages live under `app/[locale]/`; the non-localised `app/dashboard/*`, `app/verify/*` and `app/email-verified` pages are redirect shims. There are no Next.js API route handlers (`route.ts`); the frontend calls the NestJS API through `next.config.ts` rewrites.

| Page (route) | Verdict | Note |
|---|---|---|
| `/[locale]/auth/callback` | **[KEEP]** | Auth screens |
| `/[locale]/auth/forgot-password` | **[KEEP]** | Auth screens |
| `/[locale]/auth/login` | **[KEEP]** | Auth screens |
| `/[locale]/auth/register` | **[KEEP]** | Auth screens |
| `/[locale]/auth/resend-verification` | **[KEEP]** | Auth screens |
| `/[locale]/auth/reset-password/[token]` | **[KEEP]** | Auth screens |
| `/[locale]/auth/university-invite` | **[KEEP]** | University setup/invite acceptance -> school supervisor onboarding |
| `/[locale]/auth/university-setup` | **[KEEP]** | University setup/invite acceptance -> school supervisor onboarding |
| `/[locale]/auth/verify-email/[token]` | **[KEEP]** | Auth screens |
| `/[locale]/auth/verify-email` | **[KEEP]** | Auth screens |
| `/[locale]/auth/verify-email/pending` | **[KEEP]** | Auth screens |
| `/[locale]/blog/[slug]` | **[KEEP]** | Marketing + legal |
| `/[locale]/blog` | **[KEEP]** | Marketing + legal |
| `/[locale]/checkout/manual-payment/[id]` | **[KEEP]** | Checkout + pricing |
| `/[locale]/checkout` | **[KEEP]** | Checkout + pricing |
| `/[locale]/cookies` | **[KEEP]** | Marketing + legal |
| `/[locale]/dashboard/admin/agent-usage` | **[DROP]** | AI quota, sandbox, RAG index, labs, quizzes |
| `/[locale]/dashboard/admin/analytics` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/assessments` | **[DROP]** | AI quota, sandbox, RAG index, labs, quizzes |
| `/[locale]/dashboard/admin/certifications/[id]/edit` | **[DROP]** | Vendor certification catalogue |
| `/[locale]/dashboard/admin/certifications/[id]` | **[DROP]** | Vendor certification catalogue |
| `/[locale]/dashboard/admin/certifications/[id]/path` | **[REPURPOSE]** | Ordered path editor -> PFE roadmap template editor |
| `/[locale]/dashboard/admin/certifications/new` | **[DROP]** | Vendor certification catalogue |
| `/[locale]/dashboard/admin/certifications` | **[DROP]** | Vendor certification catalogue |
| `/[locale]/dashboard/admin/cloud-sandbox` | **[DROP]** | AI quota, sandbox, RAG index, labs, quizzes |
| `/[locale]/dashboard/admin/commercials/[id]` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/commercials/new` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/commercials` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/companies` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/content/certification-paths` | **[REPURPOSE]** | Path templates -> milestone templates |
| `/[locale]/dashboard/admin/content/import` | **[REPURPOSE]** | Bulk JSON import -> milestone template import |
| `/[locale]/dashboard/admin/content/indexing` | **[DROP]** | AI quota, sandbox, RAG index, labs, quizzes |
| `/[locale]/dashboard/admin/content/practice-exams` | **[DROP]** | AI quota, sandbox, RAG index, labs, quizzes |
| `/[locale]/dashboard/admin/courses/[id]` | **[REPURPOSE]** | Course/module editor -> milestone template editor |
| `/[locale]/dashboard/admin/courses/new` | **[REPURPOSE]** | Course/module editor -> milestone template editor |
| `/[locale]/dashboard/admin/courses` | **[REPURPOSE]** | Course/module editor -> milestone template editor |
| `/[locale]/dashboard/admin/devis/[id]` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/devis` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/emailing` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/feedback` | **[DROP]** | AI quota, sandbox, RAG index, labs, quizzes |
| `/[locale]/dashboard/admin/instructors` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/jobs` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/labs/access` | **[DROP]** | AI quota, sandbox, RAG index, labs, quizzes |
| `/[locale]/dashboard/admin/labs` | **[DROP]** | AI quota, sandbox, RAG index, labs, quizzes |
| `/[locale]/dashboard/admin/learners/[id]` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/learners` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/manual-payments/[id]` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/manual-payments` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin` | **[KEEP]** | Admin home |
| `/[locale]/dashboard/admin/payments` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/profile` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/progression` | **[REPURPOSE]** | Learner progression -> milestone progress board |
| `/[locale]/dashboard/admin/promo-codes/[id]/edit` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/promo-codes/create` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/promo-codes` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/quiz-feedback` | **[DROP]** | AI quota, sandbox, RAG index, labs, quizzes |
| `/[locale]/dashboard/admin/recruiters` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/referrals` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/settings` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/tracks` | **[DROP]** | AI quota, sandbox, RAG index, labs, quizzes |
| `/[locale]/dashboard/admin/universities` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/users/[id]/edit` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/users/new` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/admin/users` | **[KEEP]** | Admin console |
| `/[locale]/dashboard/commercial/codes` | **[KEEP]** | Sales partner dashboard |
| `/[locale]/dashboard/commercial` | **[KEEP]** | Sales partner dashboard |
| `/[locale]/dashboard/commercial/referrals` | **[KEEP]** | Sales partner dashboard |
| `/[locale]/dashboard/employer/candidats` | **[KEEP]** | Employer: offers, candidates, interviews, employees |
| `/[locale]/dashboard/employer/certifies` | **[REPURPOSE]** | Company's certified learners -> company's interns |
| `/[locale]/dashboard/employer/employes` | **[KEEP]** | Employer: offers, candidates, interviews, employees |
| `/[locale]/dashboard/employer/entretiens` | **[KEEP]** | Employer: offers, candidates, interviews, employees |
| `/[locale]/dashboard/employer/offres/[id]/edit` | **[KEEP]** | Employer: offers, candidates, interviews, employees |
| `/[locale]/dashboard/employer/offres/new` | **[KEEP]** | Employer: offers, candidates, interviews, employees |
| `/[locale]/dashboard/employer/offres` | **[KEEP]** | Employer: offers, candidates, interviews, employees |
| `/[locale]/dashboard/employer` | **[KEEP]** | Employer: offers, candidates, interviews, employees |
| `/[locale]/dashboard/employer/settings` | **[KEEP]** | Employer: offers, candidates, interviews, employees |
| `/[locale]/dashboard/instructor/analytics` | **[REPURPOSE]** | Instructor shell (static/mock data) -> mentor dashboard skeleton |
| `/[locale]/dashboard/instructor/assessments` | **[REPURPOSE]** | Instructor shell (static/mock data) -> mentor dashboard skeleton |
| `/[locale]/dashboard/instructor/courses` | **[REPURPOSE]** | Instructor shell (static/mock data) -> mentor dashboard skeleton |
| `/[locale]/dashboard/instructor/messages` | **[REPURPOSE]** | Instructor shell (static/mock data) -> mentor dashboard skeleton |
| `/[locale]/dashboard/instructor` | **[REPURPOSE]** | Instructor shell (static/mock data) -> mentor dashboard skeleton |
| `/[locale]/dashboard/instructor/settings` | **[REPURPOSE]** | Instructor shell (static/mock data) -> mentor dashboard skeleton |
| `/[locale]/dashboard/instructor/students` | **[REPURPOSE]** | Instructor shell (static/mock data) -> mentor dashboard skeleton |
| `/[locale]/dashboard/learner/certifications/[id]` | **[DROP]** | Certification catalogue/readiness |
| `/[locale]/dashboard/learner/certifications` | **[DROP]** | Certification catalogue/readiness |
| `/[locale]/dashboard/learner/cours/[courseId]` | **[REPURPOSE]** | Course player with progress -> milestone workspace |
| `/[locale]/dashboard/learner/cours` | **[REPURPOSE]** | Course player with progress -> milestone workspace |
| `/[locale]/dashboard/learner/cv` | **[KEEP]** | CV upload/view (strip AI boost actions) |
| `/[locale]/dashboard/learner/cv/view` | **[KEEP]** | CV upload/view (strip AI boost actions) |
| `/[locale]/dashboard/learner/emploi/boost` | **[DROP]** | Labs, exams, AI job tools, AI HR coach placeholder |
| `/[locale]/dashboard/learner/emploi/offers/[jobId]` | **[DROP]** | Labs, exams, AI job tools, AI HR coach placeholder |
| `/[locale]/dashboard/learner/emploi` | **[DROP]** | Labs, exams, AI job tools, AI HR coach placeholder |
| `/[locale]/dashboard/learner/examens/[examId]/take` | **[DROP]** | Labs, exams, AI job tools, AI HR coach placeholder |
| `/[locale]/dashboard/learner/examens` | **[DROP]** | Labs, exams, AI job tools, AI HR coach placeholder |
| `/[locale]/dashboard/learner/goals` | **[REPURPOSE]** | Goals/milestones UI -> PFE milestones |
| `/[locale]/dashboard/learner/hr-coach` | **[DROP]** | Labs, exams, AI job tools, AI HR coach placeholder |
| `/[locale]/dashboard/learner/labs/[slug]` | **[DROP]** | Labs, exams, AI job tools, AI HR coach placeholder |
| `/[locale]/dashboard/learner/labs/aws-ec2/[labId]` | **[DROP]** | Labs, exams, AI job tools, AI HR coach placeholder |
| `/[locale]/dashboard/learner/labs/aws-ec2` | **[DROP]** | Labs, exams, AI job tools, AI HR coach placeholder |
| `/[locale]/dashboard/learner/labs/azure-az900/[labId]` | **[DROP]** | Labs, exams, AI job tools, AI HR coach placeholder |
| `/[locale]/dashboard/learner/labs/azure-az900` | **[DROP]** | Labs, exams, AI job tools, AI HR coach placeholder |
| `/[locale]/dashboard/learner/labs/gcp-compute` | **[DROP]** | Labs, exams, AI job tools, AI HR coach placeholder |
| `/[locale]/dashboard/learner/labs` | **[DROP]** | Labs, exams, AI job tools, AI HR coach placeholder |
| `/[locale]/dashboard/learner/meetings` | **[KEEP]** | Mentor meetings list + assigned mentor card |
| `/[locale]/dashboard/learner` | **[REPURPOSE]** | Learner dashboard home (widgets mix) -> mentee home |
| `/[locale]/dashboard/learner/payment-requests` | **[KEEP]** | Profile, referral, manual payment tracking |
| `/[locale]/dashboard/learner/practice-exams/[slug]` | **[DROP]** | Labs, exams, AI job tools, AI HR coach placeholder |
| `/[locale]/dashboard/learner/profile` | **[KEEP]** | Profile, referral, manual payment tracking |
| `/[locale]/dashboard/learner/progression` | **[REPURPOSE]** | Progress analytics -> milestone progress |
| `/[locale]/dashboard/learner/projects` | **[REPURPOSE]** | VIP real projects -> PFE project page |
| `/[locale]/dashboard/learner/referral` | **[KEEP]** | Profile, referral, manual payment tracking |
| `/[locale]/dashboard/learner/roadmap` | **[REPURPOSE]** | AI roadmap view -> PFE roadmap (strip generation) |
| `/[locale]/dashboard/university/invites` | **[KEEP]** | University tenant console |
| `/[locale]/dashboard/university/licenses` | **[KEEP]** | University tenant console |
| `/[locale]/dashboard/university` | **[KEEP]** | University tenant console |
| `/[locale]/dashboard/university/programs/[programId]/edit` | **[REPURPOSE]** | University programs/enrollments -> PFE programs |
| `/[locale]/dashboard/university/programs/[programId]/enrollments` | **[REPURPOSE]** | University programs/enrollments -> PFE programs |
| `/[locale]/dashboard/university/programs` | **[REPURPOSE]** | University programs/enrollments -> PFE programs |
| `/[locale]/dashboard/university/settings` | **[KEEP]** | University tenant console |
| `/[locale]/dashboard/university/students` | **[KEEP]** | University tenant console |
| `/[locale]/demo` | **[DROP]** | Demo of AI tutor flow |
| `/[locale]` | **[KEEP]** | Landing page (rewrite copy) |
| `/[locale]/payment/cancel` | **[KEEP]** | Checkout + pricing |
| `/[locale]/payment/return` | **[KEEP]** | Checkout + pricing |
| `/[locale]/payment/success` | **[KEEP]** | Checkout + pricing |
| `/[locale]/pricing` | **[KEEP]** | Checkout + pricing |
| `/[locale]/privacy` | **[KEEP]** | Marketing + legal |
| `/[locale]/search-job` | **[DROP]** | Public AI job search / CV booster entry |
| `/[locale]/terms` | **[KEEP]** | Marketing + legal |
| `/[locale]/upgrade` | **[KEEP]** | Checkout + pricing |
| `/[locale]/upload-cv` | **[DROP]** | Public AI job search / CV booster entry |
| `/[locale]/verify/certificate/[code]` | **[KEEP]** | Public verification / status pages (certificate verify -> attestation verify) |
| `/dashboard/[...slug]` | **[KEEP]** | Non-localised dashboard redirectors |
| `/dashboard` | **[KEEP]** | Non-localised dashboard redirectors |
| `/email-verified` | **[KEEP]** | Public verification / status pages (certificate verify -> attestation verify) |
| `/` | **[KEEP]** | Root redirect |
| `/unauthorized` | **[KEEP]** | Public verification / status pages (certificate verify -> attestation verify) |
| `/verify/certificate/[code]` | **[KEEP]** | Public verification / status pages (certificate verify -> attestation verify) |
### 5.1 Frontend non-page code worth a verdict

| Area | Items | Verdict | Note |
|---|---|---|---|
| Contexts | `AuthContext`, `CompanyContext`, `UniversityContext`, `NotificationsContext`, `LanguageContext`, `AppContext` | **[KEEP]** | |
| Auth libs | `lib/auth/{token,routing,schemas,logoutSync}.ts`, `proxy.ts` | **[KEEP]** | |
| Pricing / subscription UI | `components/pricing/*` (incl. `SubulXpTierCard`), `components/subscription/*`, `lib/config/{plans,public-pricing,commerce}.ts`, `lib/payments/bank-payment-info.ts` | **[KEEP]** | |
| Landing | `components/landing/*` (hero, pricing, testimonials, `QuoteRequestModal`) | **[KEEP]** | Rewrite copy for mentorship. |
| Admin components | `components/admin/*`, `components/modals/Admin/*` | **[KEEP]** | `import/*` and `CourseModuleEditor` → REPURPOSE for milestone templates. |
| University components | `UniversityAccessGate`, `UniversityBadge` | **[KEEP]** | |
| Learner widgets | `VipMeetingsCard`, `LearnerCurrentPlanCard`, `LearnerPlanStatusBanner`, `PlanUsageProgress`, `FreePlanUpgradeSection`, `DashboardStatsGrid`, `LearnerDashboardHeader` | **[KEEP]** | |
| Learner widgets | `VipRealProjectsCard`, `GoalsWidget`, `GoalsMiniWidget`, `GoalsOverviewSection`, `UpcomingDeadlinesSection`, `ActiveCoursesSection`, `QuickActionsSection` | **[REPURPOSE]** | Project, milestone and deadline widgets. |
| Learner widgets | `CloudSandboxUsageWidget`, `CertificationReadinessSection`, `CertificatesSection`, `ExamsWidget`, `QuizProgressSection`, `RecommendationsSection`, `CareerOutcomesWidget`, `FeaturedCourseCard` | **[DROP]** | Labs, exams, quiz, AI recommendations. |
| AI learner components | `UniversalTutor`, `AvatarTeacher`, `LabAssistant`, `QuizFlowManager`, `QuizNiv`, `AssessmentModal`, `ModuleQuizModal`, `AIRoadmapView`, `ATSScoreModal`, `LearnerEmploiBoostFlow`, `JobDetailModal`, `CloudSandbox*`, `LabAccessCredentialsPanel`, `LabDetailExperience`, `OpenSourceLabPanel`, `components/cv-booster/*`, `components/course/AZ-900` | **[DROP]** | |
| Hooks / services (AI) | `useQuizAgent`, `useQuizAssessment`, `useQuizResults`, `useRoadmapAgent`, `useCvBooster`, `useJobSearch`, `useCloudTutor`, `useCloudSandbox`, `useLabAccess`, `useLabs`, `useExams`, `useFeedback`, `useAdminContentIndexer`; services `quiz-agent`, `quiz-assessment`, `quiz-feedback`, `quiz-results`, `roadmap-agent`, `cloud-tutor`, `cloud-sandbox`, `lab-access`, `labs`, `learner-emploi`, `practice-exams`, `exams`, `simli`, `did`, `content-indexer-admin` | **[DROP]** | |
| Hooks / services (core) | `useAdmin*`, `useUsers`, `useCompanies`, `useEmployer`, `useUniversity`, `useTransactions`, `useVipMeetings`, `useErrors`; services `payments`, `subscriptions`, `transactions`, `referrals`, `commercials`, `companies`, `employer`, `jobs`, `adminJobs`, `university*`, `user`, `notifications`, `vip-meetings`, `adminEmailing`, `adminUsers`, `adminPlatform`, `adminSubscriptions` | **[KEEP]** | |
| Hooks / services (adapt) | `useGoals`, `useRoadmap`, `useCourses`, `useAdminCourses`, `useAdminLearners`, `useLearnerDashboard`, `useVipRealProjects`, `useContentAccess`, `useCertifications`, `useInstructor`; services `goals`, `roadmap`, `courses`, `admin-courses`, `adminLearners`, `adminProgression`, `learnerDashboard`, `vip-real-projects`, `certifications`, `content-import`, `instructorApi` | **[REPURPOSE]** | |
| Static data | `data/assessmentData.ts`, `data/quizQuestions.ts`, `data/roadmapData.ts`, `data/courses/*`, `data/learnerDashboardData.ts` | **[DROP]** | Quiz and lab fixtures. |
| i18n | `locales/*`, `lib/i18n/*`, `lib/seo/alternates.ts` | **[KEEP]** | |
| E2E | `cypress/e2e/{auth,admin,employer,university,subscription,roles,pages,api}` | **[KEEP]** | `cypress/e2e/learner` and `instructor` suites need rewriting. |

---

## 6. Python agents and other services

| Service / folder | Purpose | External deps | Verdict |
|---|---|---|---|
| `backend/agents/03_Agents` (cloud-tutor) | Voice RAG tutor: `/api/chat`, `/api/tts`, `/api/quota/{user}`, `/api/session/end`; supervisor/architect/builder/empathy sub-agents | Azure OpenAI, Azure AI Search, Deepgram STT/TTS | **[DROP]** |
| `backend/agents/quiz_Agent` | Generates and evaluates quizzes (`/api/quiz/*`) | Azure OpenAI, Azure Search | **[DROP]** |
| `backend/agents/roadmap_Agent` | Assessment chat, level evaluation, roadmap generation (`/api/roadmap/*`) | Azure OpenAI, Azure Search | **[DROP]** |
| `backend/agents/coach_Agent` | "Accompanying agent" chat + TTS, multi-format ingestion pipeline | Azure OpenAI | **[DROP]** |
| `backend/agents/CV_Booster_Agent` | CV parsing, ATS scoring, enhancement; stores to Cosmos | Azure OpenAI, Cosmos DB | **[DROP]** |
| `backend/agents/JobSearch-SUBUL` | Job scrapers (LinkedIn, Indeed, Greenhouse, Lever, RemoteOK, WTTJ, Tanitjobs, …), ATS matcher, market report PDF, chat/voice routers | Azure OpenAI, Azure Search, Cosmos DB, Redis, SerpAPI | **[DROP]** |
| `backend/agents/certification_ingestion` | Parses and indexes certification content into Azure Search | Azure Search | **[DROP]** |
| `backend/agents/shared` | FastAPI base, config, logging, Prometheus metrics | — | **[DROP]** (no Python service remains) |
| `jobsearchsubul/` | Older scraper producer/consumer tooling | — | **[DROP]** |
| NestJS `content-indexer` | Chunks courses/labs/certifications, embeds with Azure OpenAI, pushes to Azure Search; admin sync/status/test-retrieval endpoints | Azure OpenAI, Azure Search | **[DROP]** |
| NestJS `content-import` | JSON importers for courses, labs, certifications, paths, practice exams | — | **[REPURPOSE]** (course/path importers → milestone templates) |
| NestJS `translation` | Google-translate based lesson translation into `lesson_translations` | google-translate-api | **[REPURPOSE]** |
| NestJS `heygen`, `simli` | Token/ICE endpoints for AI avatar video | HeyGen, Simli | **[DROP]** |
| NestJS `usage` | Voice STT/TTS cost counters | Prometheus | **[DROP]** |
| NestJS `mail` | Microsoft Graph or SMTP sender, templated emails | Graph / SMTP | **[KEEP]** |
| NestJS `geo` | IP → region for pricing | — | **[KEEP]** |
| NestJS `admin-emailing` | Segment users by plan, preview counts, bulk send; `scripts/send-bulk-emails.ts` | — | **[KEEP]** |
| `backend/api/seed/*`, `subul-certification-pack/`, `backend/api/src/seed/*` | Certification/lab/practice-exam seed packs | — | **[DROP]** |
| `backend/app/nestjs-api/` | Abandoned earlier API (Auth0 strategy, S3 service, certifications) | — | **[DROP]** (dead code) |

## 7. Infrastructure and repository hygiene

| Item | Verdict | Note |
|---|---|---|
| `docker-compose.yml`: postgres (pgvector), redis, api, frontend, frontend-prod | **[KEEP]** | Drop the six `agent-*` services and their Azure/Cosmos env; pgvector image can become plain postgres. |
| `backend/docker-compose.agents.yml`, `backend/agents/Dockerfile`, `scripts/build*agents*.ps1` | **[DROP]** | |
| `monitoring/` (Prometheus, Grafana, Loki, Promtail, Alertmanager, blackbox) | **[KEEP]** | Remove AI cost dashboards/alerts (`AI_*_COST_*`, `COST_AZURE_*`, Deepgram/Cartesia). |
| `eks/`, `aks/`, `ops/k8s/db-backup` | **[KEEP]** | |
| `.github/` workflows, `GITHUB_SECRETS.md` | **[KEEP]** | Prune agent image builds. |
| `.env.example` | **[KEEP]** | Drop `*_AGENT_URL`, `CARTESIA_*`, `DEEPGRAM_*`, `SIMLI_*`, `COST_*`, `AI_*` keys. |
| Root planning docs (`PRODUCT_ROADMAP.md`, `LEARNER_EXPANSION_PLAN.md`, `LAB_ENHANCEMENT_RECOMMENDATIONS.md`, `EMPLOI_ENHANCEMENTS*.md`, `agentjob.md`, `job_agents_architecture.md`, `nextstep.md`, `flouci.md`, `COMMERCIAL_PROMO_CODE_GUIDE.md`, `EMAIL_DELIVERABILITY_GUIDE.md`, `GRAFANA_MONITORING_PLAN.md`) | Reference only | Keep `flouci.md`, promo-code and email-deliverability guides; archive the AI/lab plans. |
| Stray files: `Untitled` (50 KB certification JSON), `init` (dev bootstrap script), `brochure.html` (600 KB), `EMPLOI_ENHANCEMENTS copy.md`, `*/image.png` | Cleanup | Remove from the new repo. |

## 8. Shortest path to the new product

1. Delete the `agents`, `quiz-results`, `quiz-feedback`, `cloud-sandbox`, `lab-access`, `labs`, `exams`, `practice-exams`, `content-indexer`, `heygen`, `simli`, `usage` NestJS modules and all of `backend/agents/`; drop the AI columns on `users` and `user_cvs`.
2. Promote `vip_mentor_meetings` to the central session entity (add `mentor_id`, `summary`, `mentee_notes`, `attended`), and expose mentor-side endpoints next to the existing admin and learner ones.
3. Turn `vip_real_projects` into the PFE project, hang `goals` (as milestones) and `learner_content_assignments` (as deliverables) off it, and reuse `user_course_progress` / `user_roadmaps` shapes for progress.
4. Keep auth, roles, university tenancy, companies/employers, the whole payments stack, promo codes, referrals and the Subul XP tier pricing unchanged.
5. Rebuild the learner dashboard home and the instructor shell as mentee and mentor dashboards, reusing the admin, employer, university and commercial consoles as they are.
