import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
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
    imports: [CommonModule, FormsModule, DatePipe, DecimalPipe],
    templateUrl: './news.component.html',
    styleUrls: ['./news.component.css']
})
export class NewsComponent implements OnInit {

    articles: Article[] = [];
    filteredArticles: Article[] = [];
    loading = false;

    // Filter State
    selectedCategories: Set<TagCategory> = new Set();
    sortOption: 'recent' | 'bullish' | 'bearish' = 'recent';

    // Available filters (extracted from data or hardcoded)
    filterGroups = [
        { name: 'Asset Class', categories: ['Stock', 'Fund', 'Crypto'] as TagCategory[] },
        { name: 'Corporate Events', categories: ['Merger', 'Dividend', 'Management', 'Guidance'] as TagCategory[] },
        { name: 'Market Sentiment', categories: ['Positive', 'Negative', 'Analyst'] as TagCategory[] },
        { name: 'Sectors & Macro', categories: ['Sector'] as TagCategory[] }, // We could split sectors if needed
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

    getSentimentColor(score: number): string {
        if (score >= 0.3) return '#28a745'; // Green
        if (score <= -0.3) return '#dc3545'; // Red
        return '#888'; // Gray
    }
}
