import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf, CommonModule } from '@angular/common';

interface OpportunityCard {
    ticker: string;
    action: 'BUY' | 'SELL' | 'WATCH';
    conviction: number;
    timeHorizon: 'Short-term' | 'Swing' | 'Long-term';
    why: string[];
    tags: string[];
    whyNow?: string; // NEW: Trigger context
    waitingFor?: string; // NEW: For WATCH cards
    conflictingSignals?: string[];
    relatedAssets?: string[];
}

interface MarketStatus {
    status: 'BULL' | 'BEAR' | 'MIXED';
    confidence: number;
    subtitle: string;
    implication: string; // NEW: Behavioral guidance
}

interface SectorPerformance {
    name: string;
    status: 'Strong' | 'Mixed' | 'Weak';
    icon: string;
    trend: '▲' | '▬' | '▼'; // NEW: Directional momentum
}

interface TopMover {
    ticker: string;
    change: number;
}

interface ConflictingSignal {
    ticker: string;
    conflict: string;
}

@Component({
    selector: 'app-insights',
    standalone: true,
    imports: [NgFor, NgIf, CommonModule],
    templateUrl: './insights.component.html',
    styleUrls: ['./insights.component.css']
})
export class InsightsComponent implements OnInit {

    // Modal state
    showMarketModal = false;
    showOpportunityModal = false;
    selectedOpportunity: OpportunityCard | null = null;

    // Section 1: Market Overall (Enhanced)
    marketStatus: MarketStatus = {
        status: 'BULL',
        confidence: 72,
        subtitle: 'Short-term bias',
        implication: 'Favor long exposure · Avoid aggressive shorts'
    };

    marketExplanation = {
        factors: [
            '3-day bullish sentiment streak',
            'Breadth improving: 65% of stocks above 50MA',
            'Low volatility environment (VIX < 15)',
            'Federal rate pause confirmed'
        ],
        whatCouldChange: 'Significant earnings misses, unexpected macro data, or geopolitical escalation could shift this to MIXED or BEAR.'
    };

    // Section 2: Sector Performance (Enhanced with trends)
    sectors: SectorPerformance[] = [
        { name: 'Technology', status: 'Strong', icon: '🟢', trend: '▲' },
        { name: 'Energy', status: 'Mixed', icon: '⚠', trend: '▬' },
        { name: 'Healthcare', status: 'Weak', icon: '🔴', trend: '▼' },
        { name: 'Crypto', status: 'Strong', icon: '🟢', trend: '▲' }
    ];

    // Section 3: Top Opportunities (Enhanced)
    opportunities: OpportunityCard[] = [
        {
            ticker: 'NVDA',
            action: 'BUY',
            conviction: 87,
            timeHorizon: 'Swing',
            whyNow: 'Earnings data released today',
            why: [
                'Earnings beat expectations (EPS: $5.20 vs $4.90 est.)',
                'Analyst upgrades from 3 major firms',
                'Strong momentum: +12% in 5 days'
            ],
            tags: ['Earnings', 'Momentum', 'Analyst'],
            conflictingSignals: [],
            relatedAssets: ['SMH (Semiconductors ETF)', 'AMD']
        },
        {
            ticker: 'TSLA',
            action: 'WATCH',
            conviction: 65,
            timeHorizon: 'Short-term',
            whyNow: 'Analyst revisions this week',
            waitingFor: 'Technical confirmation',
            why: [
                'Delivery numbers exceeded consensus',
                'Technical support at $240',
                'Mixed analyst sentiment'
            ],
            tags: ['Fundamentals', 'Technical'],
            conflictingSignals: [
                'Insider selling activity detected',
                'Competition concerns from Chinese EV makers'
            ],
            relatedAssets: ['ARKK', 'EV Sector']
        },
        {
            ticker: 'AAPL',
            action: 'BUY',
            conviction: 82,
            timeHorizon: 'Long-term',
            whyNow: 'Momentum accelerated last session',
            why: [
                'iPhone sales in China rebounding (+8% QoQ)',
                'Services revenue growing steadily',
                'Trading below historical P/E average'
            ],
            tags: ['Fundamentals', 'Value'],
            relatedAssets: ['QQQ', 'FAANG']
        },
        {
            ticker: 'XYZ',
            action: 'SELL',
            conviction: 78,
            timeHorizon: 'Short-term',
            whyNow: 'Earnings miss announced yesterday',
            why: [
                'Earnings miss with guidance cut',
                'CEO resignation announced',
                'Breaking key support level'
            ],
            tags: ['Risk', 'Technical'],
            relatedAssets: ['Industry Peers']
        },
        {
            ticker: 'BTC-USD',
            action: 'BUY',
            conviction: 71,
            timeHorizon: 'Swing',
            whyNow: 'Breakout triggered this morning',
            why: [
                'Institutional buying accelerating',
                'Breaking multi-month resistance',
                'Halving event approaching'
            ],
            tags: ['Momentum', 'Macro'],
            relatedAssets: ['ETH-USD', 'COIN']
        }
    ];

    // Section 4: Top Movers  
    topGainers: TopMover[] = [
        { ticker: 'NVDA', change: 4.2 },
        { ticker: 'BTC-USD', change: 3.1 },
        { ticker: 'AAPL', change: 2.4 }
    ];

    topLosers: TopMover[] = [
        { ticker: 'SPY', change: -1.4 },
        { ticker: 'XYZ', change: -5.8 },
        { ticker: 'ABC', change: -3.2 }
    ];

    // NEW: Section 8 - Conflicting Signals
    conflictingSignals: ConflictingSignal[] = [
        { ticker: 'SPY', conflict: 'Earnings strength vs macro pressure' },
        { ticker: 'ETH-USD', conflict: 'Inflows rising, price lagging' }
    ];

    ngOnInit() {
        // Component initialization (no API calls, using mock data)
    }

    // UI Interaction Methods
    openMarketModal() {
        this.showMarketModal = true;
    }

    closeMarketModal() {
        this.showMarketModal = false;
    }

    openOpportunityModal(opp: OpportunityCard) {
        this.selectedOpportunity = opp;
        this.showOpportunityModal = true;
    }

    closeOpportunityModal() {
        this.showOpportunityModal = false;
        this.selectedOpportunity = null;
    }

    // Helper Methods
    getMarketStatusColor(): string {
        switch (this.marketStatus.status) {
            case 'BULL': return '#28a745';
            case 'BEAR': return '#dc3545';
            case 'MIXED': return '#ffc107';
            default: return '#888';
        }
    }

    getMarketStatusIcon(): string {
        switch (this.marketStatus.status) {
            case 'BULL': return '🟢';
            case 'BEAR': return '🔴';
            case 'MIXED': return '⚠';
            default: return '⚪';
        }
    }

    getSectorStatusIcon(status: string): string {
        switch (status) {
            case 'Strong': return '🟢';
            case 'Weak': return '🔴';
            case 'Mixed': return '⚠';
            default: return '⚪';
        }
    }

    getActionClass(action: string): string {
        switch (action) {
            case 'BUY': return 'action-buy';
            case 'SELL': return 'action-sell';
            case 'WATCH': return 'action-watch';
            default: return '';
        }
    }

    // NEW: Conviction color bands
    getConvictionColor(conviction: number): string {
        if (conviction >= 80) return '#28a745'; // Strong
        if (conviction >= 65) return '#ffc107'; // Moderate
        return '#ff8c00'; // Weak
    }

    // NEW: Conviction label
    getConvictionLabel(conviction: number): string {
        if (conviction >= 80) return 'Strong';
        if (conviction >= 65) return 'Moderate';
        return 'Weak';
    }

    // NEW: Check if mover is in opportunities
    isMoverInInsights(ticker: string): boolean {
        return this.opportunities.some(opp => opp.ticker === ticker);
    }

    // Group opportunities by action
    get buyOpportunities() {
        return this.opportunities.filter(o => o.action === 'BUY');
    }

    get watchOpportunities() {
        return this.opportunities.filter(o => o.action === 'WATCH');
    }

    get sellOpportunities() {
        return this.opportunities.filter(o => o.action === 'SELL');
    }
}
