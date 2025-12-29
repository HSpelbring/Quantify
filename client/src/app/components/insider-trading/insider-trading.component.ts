import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FundService } from '../../services/fund.service';

@Component({
    selector: 'app-insider-trading',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './insider-trading.component.html',
    styleUrls: ['./insider-trading.component.css']
})
export class InsiderTradingComponent implements OnInit {
    @Input() ticker: string = '';

    trades: any[] = [];
    loading: boolean = false;
    error: string = '';

    constructor(private fundService: FundService) { }

    ngOnInit() {
        if (this.ticker) {
            this.loadInsiderTrades();
        }
    }

    loadInsiderTrades() {
        this.loading = true;
        this.error = '';

        // Direct SEC EDGAR fetch (no database)
        this.fundService.getInsiderTradingSEC(this.ticker).subscribe({
            next: (trades) => {
                this.trades = trades;
                this.loading = false;

                if (!trades || trades.length === 0) {
                    this.error = 'No recent insider activity detected.';
                }
            },
            error: (err) => {
                console.error('Failed to load SEC insider trades:', err);
                this.error = 'Failed to load insider trades from SEC';
                this.loading = false;
            }
        });
    }

    // Formatting helpers
    formatShares(shares: number): string {
        if (shares >= 1000000) {
            return (shares / 1000000).toFixed(2) + 'M';
        } else if (shares >= 1000) {
            return (shares / 1000).toFixed(1) + 'K';
        }
        return shares.toLocaleString();
    }

    formatSharesCompact(shares: number): string {
        if (shares >= 1000000) {
            return '+' + (shares / 1000000).toFixed(1) + 'M';
        } else if (shares >= 1000) {
            return '+' + (shares / 1000).toFixed(0) + 'K';
        }
        return '+' + shares.toLocaleString();
    }

    formatSharesWithSign(shares: number, transactionType: string): string {
        const sign = transactionType === 'BUY' ? '+' : '-';
        if (shares >= 1000000) {
            return sign + (shares / 1000000).toFixed(1) + 'M';
        } else if (shares >= 1000) {
            return sign + (shares / 1000).toFixed(0) + 'K';
        }
        return sign + shares.toLocaleString();
    }

    formatValue(value: number): string {
        if (value >= 1000000) {
            return '$' + (value / 1000000).toFixed(2) + 'M';
        } else if (value >= 1000) {
            return '$' + (value / 1000).toFixed(1) + 'K';
        }
        return '$' + value.toLocaleString();
    }

    formatValueFull(value: number): string {
        return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    formatDateCompact(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    formatDateFull(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    formatDate(dateStr: string): string {
        return this.formatDateFull(dateStr);
    }

    getSignalEmoji(signal: string): string {
        if (signal === 'Bullish') return '🟢';
        if (signal === 'Bearish') return '🔴';
        return '⚪';
    }

    getConvictionBarWidth(score: number): string {
        return score + '%';
    }

    getConvictionBarColor(score: number): string {
        if (score >= 75) return '#4caf50';
        if (score >= 50) return '#ff9800';
        return '#f44336';
    }
}
