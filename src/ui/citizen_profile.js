// Citizen Profile UI - Milestone J
// Displays detailed information about selected citizens

/**
 * Citizen Profile - represents a citizen's display data
 */
export class CitizenProfileData {
    constructor(citizen, game) {
        this.citizen = citizen;
        this.game = game;

        // Get household info
        this.household = game.housingManager?.households?.get(citizen.householdId) || null;

        // Get social connections
        this.connections = game.socialGraph?.getCitizenConnections(citizen.id) || [];

        // Get crime record if any
        this.crimeRecord = this._getCrimeRecord();
    }

    _getCrimeRecord() {
        if (!this.game.crimeGenerator) return [];
        const incidents = [];
        for (const incident of this.game.crimeGenerator.incidents.values()) {
            if (incident.perpetratorId === this.citizen.id) {
                incidents.push(incident);
            }
        }
        return incidents.slice(-5); // Last 5 incidents
    }

    /**
     * Get display name for citizen
     */
    getName() {
        if (this.citizen.name) return this.citizen.name;
        return `Citizen #${this.citizen.id}`;
    }

    /**
     * Get age display
     */
    getAge() {
        return this.citizen.age || 18;
    }

    /**
     * Get personality traits
     */
    getTraits() {
        const p = this.citizen.personality || { primary: 'adaptive', secondary: 'steady' };
        return [p.primary, p.secondary];
    }

    /**
     * Get job info
     */
    getJob() {
        if (!this.citizen.job || this.citizen.job === 'unemployed') {
            return { title: 'Unemployed', income: 0, status: 'unemployed' };
        }
        const jobInfo = this.game.jobsManager?.getJobInfo?.(this.citizen.job) ||
            { baseSalary: this.citizen.salary || 0, name: this.citizen.job };
        return {
            title: jobInfo.name || this.citizen.job,
            income: jobInfo.baseSalary || this.citizen.salary || 0,
            status: 'employed',
        };
    }

    /**
     * Get needs display
     */
    getNeeds() {
        const n = this.citizen.needs || { food: 100, rest: 100, safety: 100 };
        return {
            food: n.food || 100,
            rest: n.rest || 100,
            safety: n.safety || 100,
        };
    }

    /**
     * Get mood
     */
    getMood() {
        return this.citizen.mood || 'content';
    }

    /**
     * Get household info
     */
    getHouseholdInfo() {
        if (!this.household) return { name: 'No household', capacity: 0, members: 0, quality: 0 };
        return {
            name: this.household.homeBuildingId ? 'Residence' : 'Household',
            capacity: this.household.capacity,
            members: this.household.members.length,
            quality: this.household.housingQuality,
        };
    }

    /**
     * Get happiness score
     */
    getHappiness() {
        return this.citizen.happiness || 50;
    }

    /**
     * Get social connections count
     */
    getConnectionCount() {
        return this.connections.length;
    }

    /**
     * Get top connections (friends)
     */
    getTopConnections(limit = 3) {
        return this.connections.filter(c => c.type === 'friend' || c.type === 'family').slice(0, limit);
    }

    /**
     * Serialize profile data
     */
    serialize() {
        return {
            citizenId: this.citizen.id,
            name: this.getName(),
            age: this.getAge(),
            traits: this.getTraits(),
            job: this.getJob(),
            needs: this.getNeeds(),
            mood: this.getMood(),
            happiness: this.getHappiness(),
            household: this.getHouseholdInfo(),
            connections: this.connections.length,
            crimeRecord: this.crimeRecord.length,
        };
    }
}

/**
 * Citizen Profile UI Panel
 */
export class CitizenProfileUI {
    constructor(game) {
        this.game = game;
        this.selectedCitizenId = null;
        this.open = false;
        this.container = null;
        this.profileData = null;
        this.create();
    }

    create() {
        this.container = document.createElement('div');
        this.container.id = 'citizen-profile-panel';
        this.container.className = 'quest-log-panel';
        this.container.style.display = 'none';
        this.container.innerHTML = `
            <div class="quest-log-header">
                <h2 id="citizen-profile-title">Citizen Profile</h2>
                <button class="quest-log-close" id="citizen-profile-close">&times;</button>
            </div>
            <div class="quest-log-content">
                <div class="citizen-overview">
                    <div class="citizen-header">
                        <div class="citizen-avatar">👤</div>
                        <div class="citizen-info">
                            <div class="citizen-name" id="cp-name">Citizen</div>
                            <div class="citizen-meta" id="cp-meta">ID #1</div>
                        </div>
                    </div>
                    <div class="citizen-stats">
                        <div class="stat-box">
                            <div class="stat-label">Age</div>
                            <div class="stat-value" id="cp-age">18</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">Happiness</div>
                            <div class="stat-value" id="cp-happiness">50%</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">Mood</div>
                            <div class="stat-value" id="cp-mood">content</div>
                        </div>
                    </div>
                    <div class="citizen-traits" id="cp-traits">
                        <span class="trait-tag">Adaptive</span>
                        <span class="trait-tag">Steady</span>
                    </div>
                </div>

                <div class="citizen-section">
                    <h3>Needs</h3>
                    <div class="needs-grid">
                        <div class="need-item">
                            <div class="need-label">Food</div>
                            <div class="need-bar"><div class="need-fill" id="cp-food"></div></div>
                        </div>
                        <div class="need-item">
                            <div class="need-label">Rest</div>
                            <div class="need-bar"><div class="need-fill" id="cp-rest"></div></div>
                        </div>
                        <div class="need-item">
                            <div class="need-label">Safety</div>
                            <div class="need-bar"><div class="need-fill" id="cp-safety"></div></div>
                        </div>
                    </div>
                </div>

                <div class="citizen-section">
                    <h3>Employment</h3>
                    <div class="employment-info">
                        <div class="job-title" id="cp-job">Unemployed</div>
                        <div class="job-income" id="cp-income">Income: 0</div>
                    </div>
                </div>

                <div class="citizen-section">
                    <h3>Household</h3>
                    <div class="household-info">
                        <div class="hh-name" id="cp-hh-name">No household</div>
                        <div class="hh-capacity" id="cp-hh-capacity">Capacity: 0/0</div>
                        <div class="hh-quality" id="cp-hh-quality">Quality: Low</div>
                    </div>
                </div>

                <div class="citizen-section">
                    <h3>Social Connections</h3>
                    <div class="connections-list" id="cp-connections">
                        <div class="connection-item">No connections</div>
                    </div>
                </div>

                <div class="citizen-section">
                    <h3>Criminal Record</h3>
                    <div class="crime-list" id="cp-crime">
                        <div class="crime-item">No criminal record</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.container);

        const close = this.container.querySelector('#citizen-profile-close');
        close?.addEventListener('click', () => this.toggle(false));

        // Also allow clicking outside the panel to close
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) this.toggle(false);
        });
    }

    toggle(force = null) {
        this.open = force !== null ? force : !this.open;
        this.container.style.display = this.open ? 'block' : 'none';
        if (this.open && this.selectedCitizenId) {
            this.refresh();
        }
    }

    selectCitizen(id) {
        this.selectedCitizenId = id;
        this.open = true;
        this.container.style.display = 'block';
        this.refresh();
    }

    deselect() {
        this.selectedCitizenId = null;
        this.open = false;
        this.container.style.display = 'none';
    }

    refresh() {
        if (!this.selectedCitizenId) return;

        const citizen = this.game.citizens.getCitizenById(this.selectedCitizenId);
        if (!citizen) {
            this.deselect();
            return;
        }

        this.profileData = new CitizenProfileData(citizen, this.game);
        const d = this.profileData;

        // Update profile data
        this.container.querySelector('#cp-name').textContent = d.getName();
        this.container.querySelector('#cp-meta').textContent = `ID #${citizen.id} • Tick ${citizen.createdAt}`;

        // Age
        this.container.querySelector('#cp-age').textContent = d.getAge();

        // Happiness
        const happinessEl = this.container.querySelector('#cp-happiness');
        happinessEl.textContent = `${d.getHappiness()}%`;
        happinessEl.style.color = this._getHappinessColor(d.getHappiness());

        // Mood
        const moodEl = this.container.querySelector('#cp-mood');
        moodEl.textContent = d.getMood();
        moodEl.style.color = this._getMoodColor(d.getMood());

        // Traits
        const traitsContainer = this.container.querySelector('#cp-traits');
        traitsContainer.innerHTML = '';
        for (const trait of d.getTraits()) {
            const tag = document.createElement('span');
            tag.className = 'trait-tag';
            tag.textContent = trait.charAt(0).toUpperCase() + trait.slice(1);
            traitsContainer.appendChild(tag);
        }

        // Needs
        this._updateNeedBar('cp-food', d.getNeeds().food);
        this._updateNeedBar('cp-rest', d.getNeeds().rest);
        this._updateNeedBar('cp-safety', d.getNeeds().safety);

        // Employment
        const jobInfo = d.getJob();
        this.container.querySelector('#cp-job').textContent = jobInfo.title;
        this.container.querySelector('#cp-income').textContent = `Income: ${jobInfo.income}/day`;
        this.container.querySelector('#cp-job').style.color = jobInfo.status === 'employed' ? '#4caf50' : '#f44336';

        // Household
        const hhInfo = d.getHouseholdInfo();
        this.container.querySelector('#cp-hh-name').textContent = hhInfo.name;
        this.container.querySelector('#cp-hh-capacity').textContent = `Capacity: ${hhInfo.members}/${hhInfo.capacity}`;
        this.container.querySelector('#cp-hh-quality').textContent = this._getQualityLabel(hhInfo.quality);

        // Connections
        const connContainer = this.container.querySelector('#cp-connections');
        connContainer.innerHTML = '';
        if (d.connections.length === 0) {
            const item = document.createElement('div');
            item.className = 'connection-item';
            item.textContent = 'No social connections';
            connContainer.appendChild(item);
        } else {
            for (const conn of d.connections.slice(0, 5)) {
                const otherCitizen = this.game.citizens.getCitizenById(conn.id);
                const otherName = otherCitizen ? `Citizen #${conn.id}` : `Unknown #${conn.id}`;
                const item = document.createElement('div');
                item.className = 'connection-item';
                item.innerHTML = `
                    <span class="conn-name">${otherName}</span>
                    <span class="conn-relationship">${conn.type}</span>
                    <span class="conn-affinity">Affinity: ${conn.affinity}</span>
                `;
                connContainer.appendChild(item);
            }
        }

        // Crime record
        const crimeContainer = this.container.querySelector('#cp-crime');
        crimeContainer.innerHTML = '';
        if (d.crimeRecord.length === 0) {
            const item = document.createElement('div');
            item.className = 'crime-item';
            item.textContent = 'No criminal record';
            item.style.color = '#4caf50';
            crimeContainer.appendChild(item);
        } else {
            for (const incident of d.crimeRecord) {
                const item = document.createElement('div');
                item.className = 'crime-item';
                item.innerHTML = `
                    <span class="crime-type">${incident.name}</span>
                    <span class="crime-severity">Severity: ${incident.severity}</span>
                    <span class="crime-status">${incident.status}</span>
                `;
                crimeContainer.appendChild(item);
            }
        }
    }

    _updateNeedBar(elementId, value) {
        const el = this.container.querySelector(`#${elementId}`);
        if (el) {
            el.style.width = `${value}%`;
            el.style.backgroundColor = this._getNeedColor(value);
        }
    }

    _getNeedColor(value) {
        if (value >= 70) return '#4caf50';
        if (value >= 40) return '#ff9800';
        return '#f44336';
    }

    _getHappinessColor(value) {
        if (value >= 70) return '#4caf50';
        if (value >= 40) return '#ff9800';
        return '#f44336';
    }

    _getMoodColor(mood) {
        const colors = {
            optimistic: '#4caf50',
            content: '#2196f3',
            stressed: '#ff9800',
            desperate: '#f44336',
        };
        return colors[mood] || '#9e9e9e';
    }

    _getQualityLabel(quality) {
        if (quality >= 60) return 'Quality: Luxury';
        if (quality >= 40) return 'Quality: Good';
        if (quality >= 20) return 'Quality: Average';
        return 'Quality: Low';
    }
}