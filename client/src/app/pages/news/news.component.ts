import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FundService } from '../../services/fund.service';

export type TagCategory =
    | 'Stock'       // Blue
    | 'Fund'        // Light Blue
    | 'Crypto'      // Orange/Gold (New)
    | 'Sector'      // Purple
    | 'Negative'    // Red
    | 'Positive'    // Green
    | 'Merger'      // Indigo
    | 'Dividend'    // Teal
    | 'Management'  // Orange
    | 'Guidance'    // Pink
    | 'Corporate'   // (Legacy/Fallback)
    | 'Analyst'     // Yellow
    | 'Corporate Actions'
    | 'Earnings & Financial Results'
    | 'Guidance & Outlook'
    | 'Capital Allocation'
    | 'Legal & Regulatory'
    | 'Legal';      // Dark Red

export interface NewsTag {
    label: string;
    filter_name?: string;
    tag?: string;
    category: TagCategory | string;
    selected?: boolean;
}

export interface Article {
    id: string;
    title: string;
    source: string;
    articleType?: string; // Verified, Institutional, Analyst, Opinionated, Secondary
    timestamp: string; // ISO string
    sentimentScore: number;
    sentimentLabel: 'Positive' | 'Negative' | 'Neutral';
    tags: NewsTag[];
    link: string;
    hasFullContent?: boolean;
}

@Component({
    selector: 'app-news',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './news.component.html',
    styleUrls: ['./news.component.css']
})
export class NewsComponent implements OnInit {

    articles: Article[] = [];
    filteredArticles: Article[] = [];
    loading = false;

    // Filter State (existing)
    selectedCategories: Set<TagCategory> = new Set();
    sortOption: 'recent' | 'bullish' | 'bearish' = 'recent';

    // Unified Filter State
    activeFilters: { [key: string]: boolean } = {};
    searchQuery = '';
    selectedAssets: string[] = [];
    assetMatchMode: 'any' | 'all' = 'any';
    expandedSections = new Set<string>(['articles-included']);

    articleTypes = {
        verified: true,
        institutional: true,
        analyst: true,
        secondary: false,
        opinionated: true
    };

    marketReaction = {
        bullish: false,
        bearish: false,
        mixed: false
    };

    analystActions = {
        ratingUpgrade: false,
        ratingDowngrade: false,
        priceTargetRaised: false,
        priceTargetCut: false,
        coverageInitiated: false,
        coverageDropped: false
    };

    sectors: { [key: string]: boolean } = {
        technology: false,
        energy: false,
        healthcare: false,
        financials: false,
        consumer: false,
        semiconductors: false,
        ai: false,
        biotech: false
    };

    timeRange: 'today' | 'last24h' | 'thisWeek' | 'custom' = 'today';
    assetScope: 'any' | 'single' | 'multiple' | 'etf' | 'crypto' = 'any';
    filterLogicMode: 'all' | 'any' = 'any';

    // Filter Categories for the template
    filterCategories = [
        { id: 'corporate-actions', name: 'Corporate Actions', accent: '#007bff', colorClass: 'category-blue' },
        { id: 'earnings-financials', name: 'Earnings & Financial Results', accent: '#28a745', colorClass: 'category-green' },
        { id: 'guidance-outlook', name: 'Guidance & Outlook', accent: '#ffc107', colorClass: 'category-yellow' },
        { id: 'capital-allocation', name: 'Capital Allocation', accent: '#fd7e14', colorClass: 'category-orange' },
        { id: 'legal-regulatory', name: 'Legal & Regulatory', accent: '#dc3545', colorClass: 'category-red' }
    ];

    // Filter Groups (Legacy/Top-level)
    filterGroups = [
        { name: 'Asset Class', categories: ['Stock', 'Fund', 'Crypto'] as TagCategory[] },
        { name: 'Market Sentiment', categories: ['Positive', 'Negative', 'Analyst'] as TagCategory[] },
        { name: 'Sectors & Macro', categories: ['Sector'] as TagCategory[] },
        { name: 'Legal', categories: ['Legal'] as TagCategory[] }
    ];

    // Mock/Config for Events (In a real app, this might come from an API or shared constant)
    eventTags: { filter_name: string, tag: string, category: string }[] = [
        // This should match tagging_config.py
        { "filter_name": "Merger Announced", "tag": "Merger", "category": "Corporate Actions" },
        { "filter_name": "Acquisition Announced", "tag": "Acquisition", "category": "Corporate Actions" },
        { "filter_name": "Buyout / Takeover", "tag": "Buyout", "category": "Corporate Actions" },
        { "filter_name": "Spin-Off Announced", "tag": "Spin-Off", "category": "Corporate Actions" },
        { "filter_name": "Divestiture / Asset Sale", "tag": "Divestiture", "category": "Corporate Actions" },
        { "filter_name": "IPO Announced", "tag": "IPO", "category": "Corporate Actions" },
        { "filter_name": "Delisting Notice", "tag": "Delisting", "category": "Corporate Actions" },
        { "filter_name": "Strategic Review Initiated", "tag": "Strategic Review", "category": "Corporate Actions" },
        { "filter_name": "Business Restructuring", "tag": "Restructuring", "category": "Corporate Actions" },
        { "filter_name": "Asset Impairment Recorded", "tag": "Impairment", "category": "Corporate Actions" },
        { "filter_name": "Reverse Stock Split", "tag": "Reverse Split", "category": "Corporate Actions" },
        { "filter_name": "Stock Split Announced", "tag": "Stock Split", "category": "Corporate Actions" },
        { "filter_name": "Going Private Transaction", "tag": "Going Private", "category": "Corporate Actions" },
        { "filter_name": "Change in Control", "tag": "Change of Control", "category": "Corporate Actions" },
        { "filter_name": "Earnings Beat Expectations", "tag": "Earnings Beat", "category": "Earnings & Financial Results" },
        { "filter_name": "Earnings Miss Expectations", "tag": "Earnings Miss", "category": "Earnings & Financial Results" },
        { "filter_name": "Earnings Inline with Estimates", "tag": "Earnings Inline", "category": "Earnings & Financial Results" },
        { "filter_name": "Earnings Pre-Announcement", "tag": "Earnings Prelim", "category": "Earnings & Financial Results" },
        { "filter_name": "Earnings Restatement Issued", "tag": "Earnings Restated", "category": "Earnings & Financial Results" },
        { "filter_name": "Revenue Growth Reported", "tag": "Revenue Growth", "category": "Earnings & Financial Results" },
        { "filter_name": "Revenue Decline Reported", "tag": "Revenue Decline", "category": "Earnings & Financial Results" },
        { "filter_name": "Margin Expansion Reported", "tag": "Margin Expansion", "category": "Earnings & Financial Results" },
        { "filter_name": "Margin Compression Reported", "tag": "Margin Compression", "category": "Earnings & Financial Results" },
        { "filter_name": "Cash Flow Improvement", "tag": "Cash Flow Up", "category": "Earnings & Financial Results" },
        { "filter_name": "Cash Flow Deterioration", "tag": "Cash Flow Down", "category": "Earnings & Financial Results" },
        { "filter_name": "Operating Income Growth", "tag": "Operating Income Up", "category": "Earnings & Financial Results" },
        { "filter_name": "Operating Income Decline", "tag": "Operating Income Down", "category": "Earnings & Financial Results" },
        { "filter_name": "Cost Reduction Program Announced", "tag": "Cost Reduction", "category": "Earnings & Financial Results" },
        { "filter_name": "Cost Inflation Pressure", "tag": "Cost Pressure", "category": "Earnings & Financial Results" },
        { "filter_name": "Guidance Raised", "tag": "Guidance Raised", "category": "Guidance & Outlook" },
        { "filter_name": "Guidance Cut", "tag": "Guidance Cut", "category": "Guidance & Outlook" },
        { "filter_name": "Guidance Issued", "tag": "Guidance Issued", "category": "Guidance & Outlook" },
        { "filter_name": "Guidance Reaffirmed", "tag": "Guidance Reaffirmed", "category": "Guidance & Outlook" },
        { "filter_name": "Long-Term Outlook Updated", "tag": "Outlook Updated", "category": "Guidance & Outlook" },
        { "filter_name": "Outlook Withdrawn", "tag": "Outlook Withdrawn", "category": "Guidance & Outlook" },
        { "filter_name": "Forecast Change Announced", "tag": "Forecast Change", "category": "Guidance & Outlook" },
        { "filter_name": "Demand Outlook Change", "tag": "Demand Outlook", "category": "Guidance & Outlook" },
        { "filter_name": "Macro Sensitivity Warning", "tag": "Macro Warning", "category": "Guidance & Outlook" },
        { "filter_name": "Capital Expenditure Outlook Change", "tag": "CapEx Outlook", "category": "Guidance & Outlook" },
        { "filter_name": "Dividend Declared", "tag": "Dividend Declared", "category": "Capital Allocation" },
        { "filter_name": "Dividend Increase Announced", "tag": "Dividend Increase", "category": "Capital Allocation" },
        { "filter_name": "Dividend Cut Announced", "tag": "Dividend Cut", "category": "Capital Allocation" },
        { "filter_name": "Share Buyback Announced", "tag": "Buyback Announced", "category": "Capital Allocation" },
        { "filter_name": "Share Buyback Expansion", "tag": "Buyback Expanded", "category": "Capital Allocation" },
        { "filter_name": "Share Buyback Suspension", "tag": "Buyback Suspended", "category": "Capital Allocation" },
        { "filter_name": "Debt Issuance Announced", "tag": "Debt Issuance", "category": "Capital Allocation" },
        { "filter_name": "Debt Reduction Announced", "tag": "Debt Reduction", "category": "Capital Allocation" },
        { "filter_name": "Equity Capital Raise", "tag": "Equity Raise", "category": "Capital Allocation" },
        { "filter_name": "Convertible Debt Issuance", "tag": "Convertible Debt", "category": "Capital Allocation" },
        { "filter_name": "Credit Facility Update", "tag": "Credit Facility", "category": "Capital Allocation" },
        { "filter_name": "Leverage Target Change", "tag": "Leverage Change", "category": "Capital Allocation" },
        { "filter_name": "SEC Filing Submitted", "tag": "SEC Filing", "category": "Legal & Regulatory" },
        { "filter_name": "SEC Investigation Announced", "tag": "SEC Investigation", "category": "Legal & Regulatory" },
        { "filter_name": "DOJ Investigation Announced", "tag": "DOJ Investigation", "category": "Legal & Regulatory" },
        { "filter_name": "Lawsuit Filed", "tag": "Lawsuit", "category": "Legal & Regulatory" },
        { "filter_name": "Legal Settlement Reached", "tag": "Settlement", "category": "Legal & Regulatory" },
        { "filter_name": "Antitrust Action Initiated", "tag": "Antitrust Action", "category": "Legal & Regulatory" },
        { "filter_name": "Regulatory Approval Granted", "tag": "Regulatory Approval", "category": "Legal & Regulatory" },
        { "filter_name": "Regulatory Approval Denied", "tag": "Regulatory Rejection", "category": "Legal & Regulatory" },
        { "filter_name": "Compliance Violation Disclosed", "tag": "Compliance Violation", "category": "Legal & Regulatory" },
        { "filter_name": "Fine or Penalty Issued", "tag": "Fine / Penalty", "category": "Legal & Regulatory" },
        { "filter_name": "Consent Decree Issued", "tag": "Consent Decree", "category": "Legal & Regulatory" },
        { "filter_name": "Licensing Risk Identified", "tag": "Licensing Risk", "category": "Legal & Regulatory" },
        { "filter_name": "Sanctions Exposure Identified", "tag": "Sanctions Risk", "category": "Legal & Regulatory" },
    ];

    constructor(private fundService: FundService) { }

    ngOnInit() {
        this.loadRealNews();
    }

    loadRealNews() {
        this.loading = true;

        // 1. Load Cached News Instantly
        this.fundService.getNews().subscribe(data => {
            this.articles = data;
            this.applyFilters();
            this.loading = false; // Show content immediately

            // 2. Trigger Background Refresh (ETL Pipeline)
            console.log("Triggering background news refresh...");
            this.fundService.refreshNews().subscribe(resp => {
                console.log("News refreshed:", resp);
                if (resp.status === 'refreshed' && resp.count > 0) {
                    // if new articles found, reload the feed quietly
                    this.fundService.getNews().subscribe(newData => {
                        this.articles = newData;
                        this.applyFilters();
                    });
                }
            });
        });
    }

    // REMOVED generateMockData()

    // Mock data removed in favor of real API


    toggleCategoryFilter(category: TagCategory) {
        if (this.selectedCategories.has(category)) {
            this.selectedCategories.delete(category);
        } else {
            this.selectedCategories.add(category);
        }
        this.applyFilters();
    }

    isCategorySelected(category: TagCategory): boolean {
        return this.selectedCategories.has(category);
    }

    // Filter based on currently active checkbox filters
    applyFilters() {
        // 1. Filter
        let result = this.articles;

        // Source Type Filtering (Articles Included)
        result = result.filter(a => {
            const type = a.articleType || 'Secondary'; // default fallback

            if (type === 'Verified' && !this.articleTypes.verified) return false;
            if (type === 'Institutional' && !this.articleTypes.institutional) return false;
            if (type === 'Analyst' && !this.articleTypes.analyst) return false;
            if (type === 'Opinionated' && !this.articleTypes.opinionated) return false;
            if (type === 'Secondary' && !this.articleTypes.secondary) return false;

            return true;
        });

        // Collect all active boolean filters
        const hasCategories = this.selectedCategories.size > 0;
        const hasFlags = this.hasActiveAdvancedFilters();

        if (hasCategories || hasFlags) {
            result = result.filter(article => {
                // 1. Check Categories
                const matchesCategory = article.tags.some(tag => this.selectedCategories.has(tag.category as TagCategory));
                if (matchesCategory) return true;

                // 2. Check Advanced Flags
                if (hasFlags && this.matchesAdvancedFilters(article)) return true;

                return false;
            });
        }

        // 2. Sort
        if (this.sortOption === 'recent') {
            result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } else if (this.sortOption === 'bullish') {
            result.sort((a, b) => b.sentimentScore - a.sentimentScore);
        } else if (this.sortOption === 'bearish') {
            // Low score first (most negative)
            result.sort((a, b) => a.sentimentScore - b.sentimentScore);
        }

        this.filteredArticles = [...result];
    }

    hasActiveAdvancedFilters(): boolean {
        return Object.values(this.activeFilters).some(v => v === true) ||
            this.checkGroup(this.marketReaction) ||
            this.checkGroup(this.analystActions);
    }

    checkGroup(group: any): boolean {
        return Object.values(group).some(val => val === true);
    }

    getFiltersByCategory(categoryName: string) {
        return this.eventTags.filter(t => t.category === categoryName);
    }

    matchesAdvancedFilters(article: Article): boolean {
        const t = (label: string) => article.tags.some(tag => tag.label === label || tag.tag === label || tag.filter_name === label);

        // Advanced Filters (Data-driven)
        for (const filterName in this.activeFilters) {
            if (this.activeFilters[filterName] && t(filterName)) return true;
        }

        // Analyst (Legacy/Fallback)
        if (this.analystActions.ratingUpgrade && t('Analyst Upgrade')) return true;
        if (this.analystActions.ratingDowngrade && t('Analyst Downgrade')) return true;

        // Market Reaction (Sentiment)
        if (this.marketReaction.bullish && article.sentimentScore > 0.2) return true;
        if (this.marketReaction.bearish && article.sentimentScore < -0.2) return true;

        return false;
    }

    // NEW UI Methods (no logic changes)
    toggleSection(sectionId: string) {
        if (this.expandedSections.has(sectionId)) {
            this.expandedSections.delete(sectionId);
        } else {
            this.expandedSections.add(sectionId);
        }
    }

    isSectionExpanded(sectionId: string): boolean {
        return this.expandedSections.has(sectionId);
    }

    removeAsset(asset: string) {
        // UI only - remove asset pill
        this.selectedAssets = this.selectedAssets.filter(a => a !== asset);
    }

    clearAllFilters() {
        this.selectedCategories.clear();
        this.selectedAssets = [];
        this.searchQuery = '';
        this.applyFilters();
    }

    savePreset() {
        console.log('Save preset - UI placeholder');
    }

    getActiveFilterCount(): number {
        let count = 0;
        count += this.selectedAssets.length;
        count += Object.values(this.articleTypes).filter(v => v).length;
        count += Object.values(this.activeFilters).filter(v => v).length;
        count += Object.values(this.marketReaction).filter(v => v).length;
        count += Object.values(this.analystActions).filter(v => v).length;
        count += Object.values(this.sectors).filter(v => v).length;
        return count;
    }


    getSectionActiveCount(sectionId: string): number {
        // Get count of active filters in a specific section (UI only)
        const cat = this.filterCategories.find(c => c.id === sectionId);
        if (cat) {
            const filters = this.getFiltersByCategory(cat.name);
            return filters.filter(f => this.activeFilters[f.filter_name]).length;
        }

        switch (sectionId) {
            case 'articles-included':
                return Object.values(this.articleTypes).filter(v => v).length;
            case 'market-reaction':
                return Object.values(this.marketReaction).filter(v => v).length;
            case 'analyst-actions':
                return Object.values(this.analystActions).filter(v => v).length;
            case 'sector-industry':
                return Object.values(this.sectors).filter(v => v).length;
            default:
                return 0;
        }
    }

    getSectionAccentColor(sectionId: string): string {
        const cat = this.filterCategories.find(c => c.id === sectionId);
        return cat ? cat.accent : '#666';
    }

    getSentimentColor(score: number): string {
        if (score >= 0.3) return '#28a745'; // Green
        if (score <= -0.3) return '#dc3545'; // Red
        return '#888'; // Gray
    }
}
