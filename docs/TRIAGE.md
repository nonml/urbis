# Bug Triage Guidelines

This document defines how bugs are triaged, prioritized, and assigned.

---

## Severity Levels

### S0 - Crash
**Definition**: Game crashes, hard locks, or save data is corrupted
**Response Time**: Immediate (within 1 hour)
**Examples**:
- Game crashes on load
- Save file becomes unreadable
- Browser becomes unresponsive
- White screen after action

### S1 - Critical
**Definition**: Major feature completely broken, no workaround
**Response Time**: Within 4 hours
**Examples**:
- Cannot place buildings
- Quest system completely broken
- Rival AI causes infinite loop
- Major visual break on all maps

### S2 - High
**Definition**: Feature impaired, workaround exists
**Response Time**: Within 24 hours
**Examples**:
- Building placement fails on certain terrain
- Quest step blocked but can skip
- Audio missing in some districts
- UI element overlaps another

### S3 - Medium
**Definition**: Minor issue, cosmetic or inconvenience
**Response Time**: Within 1 week
**Examples**:
- Typo in UI text
- Minor visual glitch
- Missing tooltip
- Suboptimal default setting

### S4 - Low
**Definition**: Cosmetic issue, suggestion, enhancement
**Response Time**: Backlog (scheduled as capacity allows)
**Examples**:
- Font could be larger
- Color could be more visible
- Suggestion for new feature
- Minor aesthetic improvement

---

## Triage Process

### 1. Initial Review
- Verify bug is reproducible
- Check if duplicate already exists
- Assign severity level
- Add appropriate labels

### 2. Assignment
- S0/S1: Assign to senior developer immediately
- S2: Assign to available developer
- S3/S4: Add to backlog for sprint planning

### 3. Verification
- Developer confirms reproduction
- If cannot reproduce, add "need-more-info" label
- Request additional details from reporter

### 4. Fix and Verify
- Developer fixes and marks ready for review
- Tester verifies fix in same environment
- Close bug if fixed, reopen if not

---

## Required Information for Bugs

A bug report is **complete** when it includes:

- [ ] Clear title
- [ ] Severity level
- [ ] Version number
- [ ] Seed (if applicable)
- [ ] Map size
- [ ] Steps to reproduce (numbered)
- [ ] Expected behavior
- [ ] Actual behavior
- [ ] Console errors (if any)
- [ ] Save file (if relevant)

**Incomplete reports** are labeled "need-more-info" and paused until completed.

---

## Labels

### Severity
- `severity:S0` - Crash
- `severity:S1` - Critical
- `severity:S2` - High
- `severity:S3` - Medium
- `severity:S4` - Low

### Area
- `area:ui` - User interface
- `area:sim` - Simulation
- `area:render` - Graphics/3D
- `area:quest` - Quest system
- `area:rival` - Rival AI
- `area:perf` - Performance
- `area:save` - Save/load
- `area:audio` - Audio
- `area:build` - Build pipeline

### Status
- `status:triaged` - Reviewed and prioritized
- `status:in-progress` - Being worked on
- `status:need-more-info` - Waiting for additional info
- `status:blocked` - Cannot proceed due to dependency
- `status:wont-fix` - Intentionally not fixing

---

## Bug Bash Workflow

During a bug bash session:

1. **Preparation**:
   - Pull latest code
   - Clear localStorage
   - Have regression seeds ready

2. **Testing**:
   - Follow test checklist
   - File bugs using template
   - Include all required info

3. **Triage**:
   - Review all filed bugs
   - Assign severity
   - Assign to developers

4. **Cleanup**:
   - Close duplicates
   - Mark incomplete as "need-more-info"
   - Update milestone assignments