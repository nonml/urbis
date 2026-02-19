# Milestone U: 1.0.0 Release build (packaging, polish locks, release process)

## Objective
Ship a stable 1.0.0 build with vehicles + chases + cases + hacking + city-building loop all working end-to-end.

## Exit criteria (acceptance for milestone)
- All prior milestones A–T are merged and green (tests pass).
- No known P0/P1 issues in `docs/KNOWN_ISSUES.md`.
- Build artifacts generated and verified (`npm run build` + `npm run preview`).
- Versioned release notes written; save schema version frozen for 1.0.0.
- Minimum playable loop: build → hack → case → chase → escape → expand city.

## Phases
- U1: Release hardening + versioning
- U2: Packaging + build verification
- U3: Release notes + final sign-off

## Tickets

## Ticket U-1: Release candidate hardening (freeze schema + configs)
- **Phase:** U1
- **Depends on:** T-3

### Objective
Lock compatibility and reduce last-minute breakage.

### Design
Freeze `CURRENT_SCHEMA_VERSION` and content schemas; only allow bugfix migrations. Lock balance config defaults.

### Specs
- Schema changes require explicit migration and changelog entry.

### Implementation details
- Audit save files for size and compatibility.
- Add `docs/RELEASE_PROCESS.md`.

### Acceptance
- Saves created on RC build load on final build.

### DoD (Definition of Done)
- All docs updated.

### QA checklist
- Create save on RC, update to final, load successfully.

## Ticket U-2: Build + preview verification + performance budgets
- **Phase:** U2
- **Depends on:** D-2, T-3

### Objective
Ensure production build works on target browsers.

### Design
Use Vite production build; test on Chrome/Edge; verify no dev-only code paths required.

### Specs
- CITY target: 60fps typical, 30fps worst case.
- MEGA target: 30fps typical, 24fps worst case acceptable.

### Implementation details
- Run `npm run build` and `npm run preview` and do full gameplay loop.
- Disable dev overlay by default in prod.

### Acceptance
- Production build runs without console errors.
- FPS meets budgets in CITY and acceptable in MEGA.

### DoD (Definition of Done)
- Release checklist completed and signed.

### QA checklist
- Full loop playtest: build → hack → case → chase → escape.

## Ticket U-3: Release notes + changelog + tagging
- **Phase:** U3
- **Depends on:** U-1, U-2

### Objective
Ship cleanly and make future patches manageable.

### Design
Update CHANGELOG with milestone highlights, known issues, and save compatibility notes. Tag version 1.0.0.

### Specs
- Changelog includes: features, fixes, breaking changes, compatibility.

### Implementation details
- Write `docs/1.0.0_RELEASE_NOTES.md`.
- Ensure package version matches release (if you use it).

### Acceptance
- Docs are complete and consistent.

### DoD (Definition of Done)
- Repo clean; no debug junk; build artifacts excluded.

### QA checklist
- Review notes for accuracy and completeness.
