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
    | 'Legal';      // Dark Red

export interface NewsTag {
    label: string;
    category: TagCategory;
    selected?: boolean; // For filtering UI
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

    // NEW UI State (visual only, no logic changes)
    searchQuery = '';
    selectedAssets: string[] = [];
    assetMatchMode: 'any' | 'all' = 'any';
    expandedSections = new Set<string>(['articles-included']); // Default open

    // Articles Included (UI only)
    articleTypes = {
        verified: true,
        institutional: true,
        analyst: false,
        secondary: false,
        opinionated: false
    };

    // Events & Actions (UI only)
    corporateActions = {
        mergerAnnounced: false,
        acquisition: false,
        buyout: false,
        spinOff: false,
        divestiture: false,
        ipo: false,
        delisting: false,
        management: false
    };

    earningsFinancials = {
        earningsBeat: false,
        earningsMiss: false,
        earningsInline: false,
        revenueGrowth: false,
        revenueDecline: false,
        marginExpansion: false,
        marginCompression: false
    };

    guidanceOutlook = {
        guidanceRaised: false,
        guidanceCut: false,
        guidanceIssued: false,
        forecastChange: false
    };

    capitalAllocation = {
        dividendDeclared: false,
        dividendIncrease: false,
        dividendCut: false,
        shareBuyback: false,
        debtIssuance: false,
        debtReduction: false
    };

    legalRegulatory = {
        secFiling: false,
        secInvestigation: false,
        lawsuit: false,
        settlement: false,
        antitrustAction: false,
        regulatoryApproval: false,
        regulatoryRejection: false
    };

    // Market Reaction & Sentiment (UI only)
    marketReaction = {
        bullish: false,
        bearish: false,
        mixed: false
    };

    // Analyst Actions (UI only)
    analystActions = {
        ratingUpgrade: false,
        ratingDowngrade: false,
        priceTargetRaised: false,
        priceTargetCut: false,
        coverageInitiated: false,
        coverageDropped: false
    };

    // Sector & Industry (UI only)
    sectorSearch = '';
    sectorMatchMode: 'any' | 'all' = 'any';
    sectors = {
        technology: false,
        energy: false,
        healthcare: false,
        financials: false,
        consumer: false,
        semiconductors: false,
        ai: false,
        biotech: false
    };

    // Time Range & Asset Scope (UI only)
    timeRange: 'today' | 'last24h' | 'thisWeek' | 'custom' = 'today';
    assetScope: 'any' | 'single' | 'multiple' | 'etf' | 'crypto' = 'any';

    // Filter Logic (UI only)
    filterLogicMode: 'all' | 'any' = 'any';

    // Available filters (extracted from data or hardcoded)
    filterGroups = [
        { name: 'Asset Class', categories: ['Stock', 'Fund', 'Crypto'] as TagCategory[] },
        { name: 'Corporate Events', categories: ['Merger', 'Dividend', 'Management', 'Guidance'] as TagCategory[] },
        { name: 'Market Sentiment', categories: ['Positive', 'Negative', 'Analyst'] as TagCategory[] },
        { name: 'Sectors & Macro', categories: ['Sector'] as TagCategory[] },
        { name: 'Legal', categories: ['Legal'] as TagCategory[] }
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
                const matchesCategory = article.tags.some(tag => this.selectedCategories.has(tag.category));
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
        // Check if any specific boolean flag is true
        return this.checkGroup(this.corporateActions) ||
            this.checkGroup(this.earningsFinancials) ||
            this.checkGroup(this.guidanceOutlook) ||
            this.checkGroup(this.capitalAllocation) ||
            this.checkGroup(this.legalRegulatory) ||
            this.checkGroup(this.marketReaction) ||
            this.checkGroup(this.analystActions);
    }

    checkGroup(group: any): boolean {
        return Object.values(group).some(val => val === true);
    }

    matchesAdvancedFilters(article: Article): boolean {
        const t = (label: string) => article.tags.some(tag => tag.label === label);
        const c = (cat: string) => article.tags.some(tag => tag.category === cat);

        // Corporate Actions
        if (this.corporateActions.mergerAnnounced && (t('M&A') || c('Merger'))) return true;
        if (this.corporateActions.acquisition && (t('M&A') || c('Merger'))) return true; // Broad matching
        if (this.corporateActions.management && (t('Management') || c('Management'))) return true;

        // Earnings
        if (this.earningsFinancials.earningsBeat && t('Earnings Beat')) return true;
        if (this.earningsFinancials.earningsMiss && t('Earnings Miss')) return true;

        // Guidance
        if (this.guidanceOutlook.guidanceRaised && (t('Guidance') && c('Positive'))) return true; // Approx
        if (this.guidanceOutlook.guidanceCut && (t('Guidance') && c('Negative'))) return true;
        if (this.guidanceOutlook.guidanceIssued && t('Guidance')) return true;

        // Capital
        if (this.capitalAllocation.dividendDeclared && (t('Dividend/Buyback') || c('Dividend'))) return true;
        if (this.capitalAllocation.shareBuyback && t('Dividend/Buyback')) return true;

        // Legal
        if (this.legalRegulatory.lawsuit && (t('Legal/Regulatory') || c('Legal'))) return true;
        if (this.legalRegulatory.secInvestigation && (t('Legal/Regulatory') || c('Legal'))) return true;

        // Analyst
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
        count += Object.values(this.corporateActions).filter(v => v).length;
        count += Object.values(this.earningsFinancials).filter(v => v).length;
        count += Object.values(this.guidanceOutlook).filter(v => v).length;
        count += Object.values(this.capitalAllocation).filter(v => v).length;
        count += Object.values(this.legalRegulatory).filter(v => v).length;
        count += Object.values(this.marketReaction).filter(v => v).length;
        count += Object.values(this.analystActions).filter(v => v).length;
        count += Object.values(this.sectors).filter(v => v).length;
        return count;
    }


    getSectionActiveCount(sectionId: string): number {
        // Get count of active filters in a specific section (UI only)
        switch (sectionId) {
            case 'articles-included':
                return Object.values(this.articleTypes).filter(v => v).length;
            case 'corporate-actions':
                return Object.values(this.corporateActions).filter(v => v).length;
            case 'earnings-financials':
                return Object.values(this.earningsFinancials).filter(v => v).length;
            case 'guidance-outlook':
                return Object.values(this.guidanceOutlook).filter(v => v).length;
            case 'capital-allocation':
                return Object.values(this.capitalAllocation).filter(v => v).length;
            case 'legal-regulatory':
                return Object.values(this.legalRegulatory).filter(v => v).length;
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
        // Get accent color for section headers (UI only)
        const colorMap: { [key: string]: string } = {
            'corporate-actions': '#007bff',
            'earnings-financials': '#28a745',
            'guidance-outlook': '#ffc107',
            'capital-allocation': '#fd7e14',
            'legal-regulatory': '#dc3545'
        };
        return colorMap[sectionId] || '#666';
    }

    getSentimentColor(score: number): string {
        if (score >= 0.3) return '#28a745'; // Green
        if (score <= -0.3) return '#dc3545'; // Red
        return '#888'; // Gray
    }
}
