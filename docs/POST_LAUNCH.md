# Post-Launch Plan - City Builder 1.0.0

This document outlines the post-launch support plan, hotfix process, and roadmap for City Builder.

---

## Launch Status

**Release Version**: 1.0.0
**Release Date**: 2026-03-04
**Status**: GA (General Availability)

---

## Hotfix Process (1.0.x Patch Releases)

### Hotfix Scope
Hotfix releases (1.0.1, 1.0.2, etc.) are for:

| Severity | Definition | Hotfix Eligibility |
|----------|------------|-------------------|
| S0 - Crash | Game crashes, save corruption | **Always** |
| S1 - Critical | Major functionality broken | **Yes** |
| S2 - High | Minor functionality impaired | **Case-by-case** |
| S3 - Medium | UI glitches, minor issues | **No** (defer to minor) |
| S4 - Low | Cosmetic, edge cases | **No** (defer to minor) |

### Hotfix Checklist
- [ ] Reproduce issue on latest develop
- [ ] Create fix branch from release tag
- [ ] Fix + test (minimum 10 smoke tests pass)
- [ ] Update CHANGELOG.md with hotfix notes
- [ ] Update version to `1.0.N` in package.json
- [ ] Create RC build with `npm run build:beta 1.0.N`
- [ ] Run smoke tests on RC build
- [ ] Tag release: `git tag v1.0.N`
- [ ] Upload build artifact
- [ ] Announce hotfix

### Hotfix Timeline
| Action | Time Target |
|--------|-------------|
| S0 crash fix | < 24 hours |
| S1 critical fix | < 72 hours |
| S2 high fix | < 1 week |
| S3+ fixes | Next minor release |

---

## Bug Triage & Severity

### Severity Labels
```
bug-s0-crash       : Game crash, save corruption
bug-s1-critical    : Major functionality broken
bug-s2-high        : Minor functionality impaired
bug-s3-medium      : UI glitches, minor issues
bug-s4-low         : Cosmetic, edge cases
```

### Triage Workflow
1. **Report received** - Assign severity label
2. **Reproduction confirmed** - Add "reproducible" label
3. **Triage meeting** (weekly) - Assign priority
4. **Fix assigned** - Add to sprint
5. **Verified** - Close after smoke test passes

### Triage Criteria
| Factor | High Priority | Normal Priority |
|--------|---------------|-----------------|
| Impact | All users affected | Edge case |
| Workaround | None exists | User can work around |
| Regression | Introduced in 1.0.0 | Pre-existing issue |

---

## Feature Release Process (1.1.x+)

### Feature Branch Workflow
1. Feature proposed via issue
2. Design doc created (if complex)
3. Feature branch from develop
4. PR review (at least 2 approvals)
5. Merge to develop
6. Test on develop branch
7. Target for next minor release

### Minor Release Checklist
- [ ] Feature freeze date set
- [ ] RC branch created
- [ ] Beta testing period (2 weeks minimum)
- [ ] All regression tests pass
- [ ] Performance targets verified
- [ ] CHANGELOG updated
- [ ] Documentation reviewed

---

## Roadmap - After 1.0.0

### 1.0.1 (Hotfix)
**Focus**: Stability fixes
**Planned**:
- [ ] Performance improvements for large maps
- [ ] Save corruption edge case fix
- [ ] UI glitch fixes

### 1.0.2 (Hotfix)
**Focus**: Bug fixes from community feedback
**Planned**:
- [ ] Traffic simulation improvements
- [ ] Crisis response optimization
- [ ] Memory leak fixes

### 1.1.0 (Minor)
**Focus**: Quality of life improvements
**Planned**:
- [ ] Export/import city data
- [ ] Multi-monitor support
- [ ] Keyboard accessibility enhancements
- [ ] Community modding support (basic)

### 1.2.0 (Minor)
**Focus**: Advanced features
**Planned**:
- [ ] Scenario editor
- [ ] Custom districts
- [ ] Advanced analytics dashboard
- [ ] Cloud save support

### 2.0.0 (Major)
**Focus**: Next-generation features
**Planned**:
- [ ] Multi-city management
- [ ] Multiplayer support
- [ ] VR/3D view mode
- [ ] Advanced AI simulation

---

## Telemetry & Monitoring

### Metrics to Track
| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Crash rate | > 1% of sessions | S0 investigation |
| Memory > 600MB | > 5% of sessions | Memory leak check |
| Load time > 10s | > 10% of sessions | Performance optimization |
| Save size > 10MB | N/A | Monitor trend |

### Feedback Channels
- GitHub Issues (bug reports)
- GitHub Discussions (feature requests)
- Discord community server (support)

---

## Support Guidelines

### Response Times
| Channel | Response Target |
|---------|-----------------|
| GitHub Issues | 48 hours |
| Discord Support | 24 hours |
| Critical (S0) | 4 hours |

### Known Issue Response
- **Active issues**: Update weekly
- **Workaround provided**: Mark with "workaround available"
- **Fixed**: Update version in "Fixed in" column

---

## Archive: Pre-Launch Notes

These were created during Milestone U and carried forward:

- `docs/RC_CHECKLIST.md` - Release candidate checklist
- `docs/CREDITS.md` - Credits and licenses
- `docs/KNOWN_ISSUES.md` - Current known issues
- `tests/perf_cert.js` - Performance certification

---

## Contact

For questions about this post-launch plan:
- GitHub: https://github.com/your-repo(city-builder/issues
- Discord: https://discord.gg/your-server