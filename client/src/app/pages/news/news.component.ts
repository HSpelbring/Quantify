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
    id: number;
    title: string;
    source: string;
    timestamp: string; // ISO string for simplicity
    sentimentScore: number;
    sentimentLabel?: string; // e.g. "Highly Positive"
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
        verified: false,
        institutional: false,
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
        delisting: false
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

    // Filter based on currently active checkbox filters (AND logic or OR logic? Usually OR for categories)
    // User said: "filter for articles tagged AAPL AND Earnings Beat". Wait, that's specific tag selection.
    // The sidebar usually filters by "Show me all Positive news" or "Show me all Tech news".
    // Let's implement OR logic for the sidebar categories (Show Positive OR Corporate).
    // AND logic applies if multiple distinct *tag* filters were selected (e.g. text search + cat), but here we just have category toggles for now.
    applyFilters() {
        // 1. Filter
        let result = this.articles;

        if (this.selectedCategories.size > 0) {
            result = result.filter(article => {
                // Check if article has AT LEAST ONE tag in the selected categories
                return article.tags.some(tag => this.selectedCategories.has(tag.category));
            });
        }

        // 2. Sort
        if (this.sortOption === 'recent') {
            // Already sorted by backend usually, but re-sort to be safe
            result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } else if (this.sortOption === 'bullish') {
            // High score first
            result.sort((a, b) => b.sentimentScore - a.sentimentScore);
        } else if (this.sortOption === 'bearish') {
            // Low score first
            result.sort((a, b) => a.sentimentScore - b.sentimentScore);
        }

        this.filteredArticles = [...result]; // New reference
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
        // UI only - placeholder for future logic
        this.selectedCategories.clear();
        this.selectedAssets = [];
        this.searchQuery = '';
        // Reset all checkbox states (placeholder)
        console.log('Clear all filters - UI placeholder');
    }

    savePreset() {
        // UI only - placeholder for future logic
        console.log('Save preset - UI placeholder');
    }

    // UI Helper Methods for Visual Feedback
    getActiveFilterCount(): number {
        // Count all active filters (UI only - visual feedback)
        let count = 0;

        // Count selected assets
        count += this.selectedAssets.length;

        // Count article types
        count += Object.values(this.articleTypes).filter(v => v).length;

        // Count events & actions
        count += Object.values(this.corporateActions).filter(v => v).length;
        count += Object.values(this.earningsFinancials).filter(v => v).length;
        count += Object.values(this.guidanceOutlook).filter(v => v).length;
        count += Object.values(this.capitalAllocation).filter(v => v).length;
        count += Object.values(this.legalRegulatory).filter(v => v).length;

        // Count market reaction
        count += Object.values(this.marketReaction).filter(v => v).length;

        // Count analyst actions
        count += Object.values(this.analystActions).filter(v => v).length;

        // Count sectors
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
