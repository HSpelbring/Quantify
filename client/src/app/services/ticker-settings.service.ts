import { Injectable } from '@angular/core';
import { DEFAULT_TICKER_SELECTION } from '../config/ticker.config';

@Injectable({
    providedIn: 'root'
})
export class TickerSettingsService {
    private readonly STORAGE_KEY = 'quantify_ticker_settings';
    private readonly MIN_SELECTION = 6;

    constructor() { }

    /**
     * Returns the list of selected symbols.
     * Loads from localStorage or falls back to default.
     */
    getSelectedSymbols(): string[] {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length >= 1) { // Allow loading even if < MIN to let user fix it, but logically valid
                    return parsed;
                }
            } catch (e) {
                console.warn('Failed to parse ticker settings, using defaults.', e);
            }
        }
        return [...DEFAULT_TICKER_SELECTION];
    }

    /**
     * Saves variables to local storage.
     * Throws error if validation fails.
     */
    saveSelectedSymbols(symbols: string[]): void {
        if (symbols.length < this.MIN_SELECTION) {
            throw new Error(`Minimum of ${this.MIN_SELECTION} instruments required.`);
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(symbols));
    }

    /**
     * Helper to check validity without throwing
     */
    isValidSelection(symbols: string[]): boolean {
        return symbols.length >= this.MIN_SELECTION;
    }

    getMinSelectionCount(): number {
        return this.MIN_SELECTION;
    }
}
