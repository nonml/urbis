// Loans, Debt, and Bankruptcy System (Milestone G-04)
// Player can take loans with interest; monthly payment deducted automatically.
// If cash < 0 beyond grace period → bankruptcy warning → collapse.

const DEFAULT_INTEREST_RATE = 0.10;  // 10% per tick
const GRACE_PERIOD_TICKS = 30;       // 30 ticks (about 30 days) before collapse
const MAX_DEBT_RATIO = 2.0;          // Max debt can be 2x current cash

// Loan offer options
const LOAN_OPTIONS = [
    { amount: 1000, interestRate: 0.08, name: 'Small Loan' },
    { amount: 3000, interestRate: 0.09, name: 'Medium Loan' },
    { amount: 5000, interestRate: 0.10, name: 'Large Loan' },
    { amount: 10000, interestRate: 0.12, name: 'Major Loan' },
];

export class LoanManager {
    constructor(game) {
        this.game = game;
        this.activeLoans = [];
        this.totalDebt = 0;
        this.bankruptcyWarning = false;
        this.bankruptcyCountdown = 0;
        this.lastLoanId = 0;
    }

    /**
     * Get current total debt
     */
    getTotalDebt() {
        return this.totalDebt;
    }

    /**
     * Take a new loan
     */
    takeLoan(amount) {
        const game = this.game;
        const { resources, economyLedger, state } = game;

        // Validate loan amount
        const maxLoan = Math.floor(resources.gold * MAX_DEBT_RATIO);
        if (amount > maxLoan) {
            return {
                ok: false,
                reason: `Loan too large. Maximum: ${maxLoan}`,
            };
        }

        if (amount <= 0) {
            return {
                ok: false,
                reason: 'Invalid loan amount',
            };
        }

        // Create loan
        this.lastLoanId++;
        const loan = {
            id: this.lastLoanId,
            amount,
            remaining: amount,
            interestRate: this._calculateInterestRate(amount),
            startedTick: state.time.tick,
            monthlyPayment: this._calculateMonthlyPayment(amount),
        };

        this.activeLoans.push(loan);
        this.totalDebt += amount;

        // Add cash to resources
        resources.gold += amount;
        economyLedger.addDelta(economyLedger.beginTick(state.time.tick), 'gold', amount, `loan_taken_${loan.id}`);

        return {
            ok: true,
            loan,
            reason: 'Loan approved',
        };
    }

    /**
     * Repay a loan (full or partial)
     */
    repayLoan(loanId, amount) {
        const loan = this.activeLoans.find(l => l.id === loanId);
        if (!loan) {
            return {
                ok: false,
                reason: 'Loan not found',
            };
        }

        if (amount <= 0) {
            return {
                ok: false,
                reason: 'Invalid repayment amount',
            };
        }

        const game = this.game;
        const { resources, economyLedger, state } = game;

        if (resources.gold < amount) {
            return {
                ok: false,
                reason: 'Insufficient funds',
            };
        }

        const actualRepayment = Math.min(amount, loan.remaining);
        loan.remaining -= actualRepayment;
        this.totalDebt -= actualRepayment;

        resources.gold -= actualRepayment;
        economyLedger.addDelta(economyLedger.beginTick(state.time.tick), 'gold', -actualRepayment, `loan_repaid_${loan.id}`);

        if (loan.remaining <= 0) {
            this.activeLoans = this.activeLoans.filter(l => l.id !== loanId);
        }

        return {
            ok: true,
            remaining: loan.remaining,
            reason: 'Repayment successful',
        };
    }

    /**
     * Calculate interest rate based on loan size (risk-based pricing)
     */
    _calculateInterestRate(amount) {
        // Larger loans get slightly better rates
        if (amount >= 10000) return 0.12;
        if (amount >= 5000) return 0.10;
        if (amount >= 3000) return 0.09;
        return 0.08;
    }

    /**
     * Calculate monthly payment (principal + interest)
     */
    _calculateMonthlyPayment(amount) {
        const rate = this._calculateInterestRate(amount);
        return Math.ceil(amount * (rate + 0.02));  // 2% principal minimum
    }

    /**
     * Process monthly debt payments
     */
    processDebtPayments() {
        const game = this.game;
        const { resources, economyLedger, state } = game;

        let totalPayment = 0;

        for (const loan of this.activeLoans) {
            const payment = Math.ceil(loan.remaining * loan.interestRate) + 10;
            if (resources.gold >= payment) {
                resources.gold -= payment;
                totalPayment += payment;
                economyLedger.addDelta(economyLedger.beginTick(state.time.tick), 'gold', -payment, `loan_interest_${loan.id}`);
            }
        }

        this.totalDebt -= totalPayment;
        return totalPayment;
    }

    /**
     * Check bankruptcy status and update countdown
     */
    checkBankruptcyStatus() {
        const { resources } = this.game;
        const cash = resources.gold;

        if (cash < 0) {
            if (!this.bankruptcyWarning) {
                this.bankruptcyWarning = true;
                this.bankruptcyCountdown = GRACE_PERIOD_TICKS;
                this.game.showMessage('⚠️ WARNING: City in debt! Pay down loans or collect taxes!', 'crisis');
            }

            this.bankruptcyCountdown--;

            if (this.bankruptcyCountdown <= 0) {
                this.triggerBankruptcy();
                return true;
            }
        } else {
            this.bankruptcyWarning = false;
            this.bankruptcyCountdown = 0;
        }

        return false;
    }

    /**
     * Trigger bankruptcy (lose condition)
     */
    triggerBankruptcy() {
        this.game.showMessage('⚠️ BANKRUPTCY! City has collapsed.', 'crisis');
        this.game.state.time.paused = true;

        // Generate bankruptcy summary
        const summary = {
            type: 'bankruptcy',
            totalDebt: this.totalDebt,
            tick: this.game.state.time.tick,
            timestamp: Date.now(),
        };

        this.game.state.bankruptcy = summary;

        return summary;
    }

    /**
     * Get available loan offers
     */
    getLoanOffers() {
        return LOAN_OPTIONS.map(opt => ({
            ...opt,
            monthlyPayment: this._calculateMonthlyPayment(opt.amount),
        }));
    }

    /**
     * Get current loan status summary
     */
    getLoanSummary() {
        return {
            totalDebt: this.totalDebt,
            activeLoans: this.activeLoans.length,
            monthlyPayment: this.activeLoans.reduce((sum, l) => sum + this._calculateMonthlyPayment(l.amount), 0),
            bankruptcyWarning: this.bankruptcyWarning,
            graceTicksRemaining: this.bankruptcyCountdown,
        };
    }

    /**
     * Serialize for save
     */
    serialize() {
        return {
            activeLoans: this.activeLoans,
            totalDebt: this.totalDebt,
            bankruptcyWarning: this.bankruptcyWarning,
            bankruptcyCountdown: this.bankruptcyCountdown,
            lastLoanId: this.lastLoanId,
        };
    }

    /**
     * Deserialize for load
     */
    deserialize(data) {
        if (!data) return;
        this.activeLoans = data.activeLoans || [];
        this.totalDebt = data.totalDebt || 0;
        this.bankruptcyWarning = data.bankruptcyWarning || false;
        this.bankruptcyCountdown = data.bankruptcyCountdown || 0;
        this.lastLoanId = data.lastLoanId || 0;
    }
}

/**
 * Create loan manager instance
 */
export function createLoanManager(game) {
    return new LoanManager(game);
}