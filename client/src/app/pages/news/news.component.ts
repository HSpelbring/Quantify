import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FundService } from '../../services/fund.service';

export type TagCategory =
    | 'Stock'       // Blue
    | 'Sector'      // Purple
    | 'Negative'    // Red
    | 'Positive'    // Green
    | 'Corporate'   // Orange
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

    // Available filters (extracted from data or hardcoded)
    filterGroups = [
        { name: 'Market Data', categories: ['Stock', 'Sector'] as TagCategory[] },
        { name: 'Events', categories: ['Positive', 'Negative', 'Corporate'] as TagCategory[] },
        { name: 'Analysis & Legal', categories: ['Analyst', 'Legal'] as TagCategory[] },
    ];

    constructor(private fundService: FundService) { }

    ngOnInit() {
        this.loadRealNews();
    }

    loadRealNews() {
        this.loading = true;
        // 1. Get User's Symbols from Portfolio
        const saved = localStorage.getItem('quantify_portfolio');
        let symbols: string[] = [];

        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.holdings) {
                    symbols = data.holdings.map((h: any) => h.symbol);
                }
            } catch (e) {
                console.error("Error parsing portfolio for news", e);
            }
        }

        // If portfolio empty, default to big tech for demo
        if (symbols.length === 0) {
            symbols = ["AAPL", "NVDA", "TSLA", "MSFT", "AMD"];
        }

        // 2. Fetch News
        this.fundService.getNews(symbols).subscribe(data => {
            this.articles = data;
            this.applyFilters();
            this.loading = false;
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
        if (this.selectedCategories.size === 0) {
            this.filteredArticles = this.articles;
            return;
        }

        this.filteredArticles = this.articles.filter(article => {
            // Check if article has AT LEAST ONE tag in the selected categories
            return article.tags.some(tag => this.selectedCategories.has(tag.category));
        });
    }

    getSentimentColor(score: number): string {
        if (score >= 0.3) return '#28a745'; // Green
        if (score <= -0.3) return '#dc3545'; // Red
        return '#888'; // Gray
    }
}
