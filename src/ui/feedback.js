// Feedback System for Beta Release
// Known issues display and issue reporting

import { VERSION, BUILD_NUMBER, BUILD_TIMESTAMP, getVersionInfo } from '../version.js';

/**
 * Known Issues Data
 * This should be kept in sync with docs/KNOWN_ISSUES.md
 */
export const KNOWN_ISSUES = [
    // Critical
    // High Priority
    {
        id: 'HIGH-001',
        title: 'No high priority issues currently',
        description: 'No critical issues blocking beta release.',
        severity: 'high',
        status: 'resolved',
        lastUpdated: '2026-03-04'
    },
    // Medium Priority
    {
        id: 'MEDIUM-001',
        title: 'Performance slowdown with large maps',
        description: 'Simulating many tiles may cause lag on older hardware.',
        severity: 'medium',
        status: 'pending',
        lastUpdated: '2026-03-04',
        workaround: 'Use smaller map sizes or ensure far cells are properly aggregated.'
    },
    {
        id: 'MEDIUM-002',
        title: 'Camera controls could be smoother',
        description: 'Right-click camera rotation feels slightly delayed on some systems.',
        severity: 'medium',
        status: 'pending',
        lastUpdated: '2026-03-04',
        workaround: 'Try adjusting render scale in Settings.'
    },
    // Low Priority
    {
        id: 'LOW-001',
        title: 'Missing audio assets',
        description: 'Some sound effects are placeholder files.',
        severity: 'low',
        status: 'pending',
        lastUpdated: '2026-03-04',
        workaround: 'Audio will be fully implemented in a future update.'
    },
    {
        id: 'LOW-002',
        title: 'Codex search not case-insensitive',
        description: 'Search should be case-insensitive for better UX.',
        severity: 'low',
        status: 'pending',
        lastUpdated: '2026-03-04',
        workaround: 'Use lowercase when searching.'
    },
    // Documentation
    {
        id: 'DOC-001',
        title: 'Tutorial could include utilities section',
        description: 'Tutorial currently focuses on basics; utilities are not well explained.',
        severity: 'docs',
        status: 'pending',
        lastUpdated: '2026-03-04',
        workaround: 'Check the Codex (press ?) for utilities information.'
    }
];

/**
 * Feedback UI Manager
 */
export class FeedbackUI {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.container = null;
        this.init();
    }

    /**
     * Initialize UI
     */
    init() {
        // Create feedback overlay
        const container = document.createElement('div');
        container.id = 'feedback-overlay';
        container.className = 'overlay hidden';
        container.style.zIndex = '9999';

        container.innerHTML = `
            <div class="overlay-content" style="max-width: 700px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">Known Issues & Feedback</h2>
                    <button class="btn btn-secondary" id="feedback-close-btn" style="padding: 8px 16px;">
                        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                </div>

                <div style="margin-bottom: 20px; padding: 16px; background: rgba(255,165,0,0.1); border-radius: 8px; border-left: 4px solid #ff8800;">
                    <h3 style="margin: 0 0 10px 0; color: #ffcc00;">Beta Testing Feedback</h3>
                    <p style="margin: 0; font-size: 14px; color: #e6f2ff;">
                        Thank you for testing! Your feedback helps improve the game. Please report:
                    </p>
                    <ul style="margin: 10px 0 0 20px; font-size: 14px; color: #e6f2ff;">
                        <li>Crashes or errors (copy the debug info from error screens)</li>
                        <li>Unexpected behavior or bugs</li>
                        <li>Missing or unclear documentation</li>
                        <li>Performance issues</li>
                    </ul>
                </div>

                <div style="display: flex; gap: 16px; margin-bottom: 20px;">
                    <button class="btn btn-primary" id="feedback-open-btn" style="flex: 1;">
                        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                        Report Issue
                    </button>
                    <button class="btn btn-secondary" id="known-issues-btn" style="flex: 1;">
                        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                        View Known Issues
                    </button>
                </div>

                <div id="issues-container">
                    ${this.renderIssuesTable()}
                </div>

                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin: 0 0 10px 0;">Your Feedback</h3>
                    <p style="color: #888; font-size: 14px; margin-bottom: 10px;">
                        When reporting issues, include this information:
                    </p>
                    <div style="background: #1a2634; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 11px; margin-bottom: 12px;">
                        Version: ${VERSION} (Build ${BUILD_NUMBER})<br>
                        Build Time: ${BUILD_TIMESTAMP}
                    </div>
                    <p style="color: #888; font-size: 12px;">
                        <strong>Tip:</strong> Press <kbd>?</kbd> to open the Codex for help information.
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(container);
        this.container = container;

        // Cache elements
        this.closeBtn = document.getElementById('feedback-close-btn');
        this.openIssueBtn = document.getElementById('feedback-open-btn');
        this.viewIssuesBtn = document.getElementById('known-issues-btn');

        // Setup event listeners
        this.closeBtn.addEventListener('click', () => this.close());
        this.openIssueBtn.addEventListener('click', () => this.openIssueTemplate());
        this.viewIssuesBtn.addEventListener('click', () => {
            document.getElementById('issues-container').style.display = 'block';
            this.viewIssuesBtn.style.display = 'none';
            this.openIssueBtn.style.display = 'none';
        });
    }

    /**
     * Render issues table
     */
    renderIssuesTable() {
        const bySeverity = {
            high: KNOWN_ISSUES.filter(i => i.severity === 'high'),
            medium: KNOWN_ISSUES.filter(i => i.severity === 'medium'),
            low: KNOWN_ISSUES.filter(i => i.severity === 'low'),
            docs: KNOWN_ISSUES.filter(i => i.severity === 'docs')
        };

        let html = '<div id="issues-list" style="margin-top: 20px;">';

        const sections = [
            { title: 'High Priority', key: 'high', icon: '🚨' },
            { title: 'Medium Priority', key: 'medium', icon: '⚠️' },
            { title: 'Low Priority / Future', key: 'low', icon: '📝' },
            { title: 'Documentation', key: 'docs', icon: '📚' }
        ];

        for (const section of sections) {
            const issues = bySeverity[section.key];
            if (issues.length === 0) {
                html += `
                    <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <h3 style="margin: 0 0 10px 0; font-size: 14px;">${section.icon} ${section.title}</h3>
                        <p style="margin: 0; color: #888; font-size: 13px;">No issues in this category.</p>
                    </div>
                `;
            } else {
                html += `
                    <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #54d3ff;">${section.icon} ${section.title}</h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <thead>
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                                    <th style="text-align: left; padding: 8px 0;">ID</th>
                                    <th style="text-align: left; padding: 8px 0;">Issue</th>
                                    <th style="text-align: left; padding: 8px 0;">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${issues.map(issue => `
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                        <td style="padding: 8px 0; font-family: monospace; color: #e6f2ff;">${issue.id}</td>
                                        <td style="padding: 8px 0; color: #e6f2ff;">${issue.title}</td>
                                        <td style="padding: 8px 0;">
                                            <span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; background: ${this.getStatusColor(issue.status)}; color: #fff;">
                                                ${issue.status}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr style="padding-left: 20px;">
                                        <td colspan="3" style="padding: 4px 0 12px 0; color: #b8c4d0; font-size: 12px; border-left: 2px solid rgba(255,255,255,0.1); padding-left: 8px;">
                                            ${issue.description}
                                            ${issue.workaround ? `<br><strong>Workaround:</strong> ${issue.workaround}` : ''}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        }

        html += '</div>';
        return html;
    }

    /**
     * Get status color
     */
    getStatusColor(status) {
        const colors = {
            resolved: '#2fbf71',
            'in-progress': '#ffcc00',
            pending: '#54d3ff',
            'won-t-fix': '#ff5f5f'
        };
        return colors[status] || '#888';
    }

    /**
     * Open issue report template
     */
    openIssueTemplate() {
        const versionInfo = getVersionInfo();
        const debugInfo = `
Version: ${VERSION}
Build: ${BUILD_NUMBER}
Build Time: ${BUILD_TIMESTAMP}
`;
        const template = `
## Bug / Issue Report

### Description
[Describe the issue you encountered]

### Steps to Reproduce
1. [First step]
2. [Second step]
3. [Third step]

### Expected Behavior
[What you expected to happen]

### Actual Behavior
[What actually happened]

### Debug Info
\`\`\`
${debugInfo}
Run ID: ${window.game?.runId || 'N/A'}
Seed: ${window.game?.seed || 'Random'}
Day: ${window.game?.resources?.day || 'N/A'}
\`\`\`

### Screenshots (if applicable)
[Upload screenshots if relevant]

### Additional Context
[Any other context about the problem]
`;

        // Create GitHub issue URL
        const title = encodeURIComponent('[Bug/Issue] ');
        const body = encodeURIComponent(template);
        const url = `https://github.com/anthropics/city-builder/issues/new?title=${title}&body=${body}`;

        window.open(url, '_blank');
    }

    /**
     * Open feedback UI
     */
    open() {
        this.isOpen = true;
        this.container.classList.remove('hidden');
        document.getElementById('issues-list')?.style?.removeProperty('display');
        this.viewIssuesBtn.style.display = '';
        this.openIssueBtn.style.display = '';
    }

    /**
     * Close feedback UI
     */
    close() {
        this.isOpen = false;
        this.container.classList.add('hidden');
    }

    /**
     * Toggle feedback UI visibility
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
}

/**
 * Create feedback UI instance
 */
export function createFeedbackUI(game) {
    return new FeedbackUI(game);
}