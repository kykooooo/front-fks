# Auth Readiness Checklist (FKS)

Date: 2026-02-20

## Scope
- Welcome
- Login
- Register
- Profile setup
- Onboarding
- Mode select

## UX Audit Summary
- [x] CTA primary/secondary labels are explicit and action-oriented.
- [x] Text contrast is readable on all auth screens (dark gradients + explicit high-contrast colors).
- [x] Inputs show clear validation feedback before submit (inline + toast).
- [x] Loading states disable submit and avoid duplicate requests.
- [x] Error states are understandable (friendly Firebase error mapping).
- [x] Back/navigation flow is predictable at every step.

## Technical Audit Summary
- [x] No auth screen depends on remote image URL to render correctly.
- [x] Welcome routes correctly to Login/Register depending on selected CTA.
- [x] Auth stack has no conflicting native header with custom UI.
- [x] Notification permission prompt does not fire before user login.
- [x] Profile setup clears dependent fields when parent choices change.
- [x] TypeScript check passes (`npm run -s typecheck`).

## End-to-End Checklist

### A) New user
- [ ] Open app first time -> Welcome appears.
- [ ] Tap "Créer un compte" -> Register opens directly.
- [ ] Register with valid data -> account created, no crash.
- [ ] Profile setup (all steps) -> save success.
- [ ] Onboarding appears once.
- [ ] Mode select appears, then app enters player/coach area.

### B) Existing user
- [ ] Open app with welcome already done -> Login opens.
- [ ] Login valid credentials -> enters app without extra prompts.
- [ ] Logout then reopen -> returns to Login flow.

### C) Error and resilience
- [ ] Login invalid email -> inline + toast validation.
- [ ] Login wrong password -> clear auth message.
- [ ] Register email already used -> clear auth message.
- [ ] Register weak password -> clear auth message.
- [ ] Network offline during login/register -> clear network message.
- [ ] Too many requests -> clear cooldown message.

## Notes
- This checklist is operational: complete the manual E2E section on a real device before TestFlight distribution.
