export interface TickerInstrument {
    symbol: string;
    name: string;
    category: 'Indices' | 'Commodities' | 'FX' | 'Rates' | 'Volatility' | 'Crypto';
}

export const TICKER_INSTRUMENTS: TickerInstrument[] = [
    // --- Indices ---
    { symbol: '^GSPC', name: 'S&P 500', category: 'Indices' },
    { symbol: '^NDX', name: 'NASDAQ 100', category: 'Indices' },
    { symbol: '^DJI', name: 'Dow Jones', category: 'Indices' },
    { symbol: '^RUT', name: 'Russell 2000', category: 'Indices' },
    { symbol: 'RSP', name: 'S&P 500 Equal Weight', category: 'Indices' },
    { symbol: '^NYA', name: 'NYSE Composite', category: 'Indices' },

    // --- Volatility ---
    { symbol: '^VIX', name: 'VIX Index', category: 'Volatility' },
    { symbol: '^VVIX', name: 'VVIX (Vol of VIX)', category: 'Volatility' },
    { symbol: 'VIX9D', name: 'VIX 9-Day', category: 'Volatility' },

    // --- Commodities ---
    { symbol: 'CL=F', name: 'Crude Oil (WTI)', category: 'Commodities' },
    { symbol: 'BZ=F', name: 'Brent Crude', category: 'Commodities' },
    { symbol: 'GC=F', name: 'Gold', category: 'Commodities' },
    { symbol: 'SI=F', name: 'Silver', category: 'Commodities' },
    { symbol: 'NG=F', name: 'Natural Gas', category: 'Commodities' },

    // --- FX ---
    { symbol: 'EURUSD=X', name: 'EUR/USD', category: 'FX' },
    { symbol: 'JPY=X', name: 'USD/JPY', category: 'FX' },

    // --- Rates ---
    { symbol: '^TNX', name: 'US 10Y Yield', category: 'Rates' },
    { symbol: '^IRX', name: 'US 2Y Yield', category: 'Rates' },
    { symbol: '^TYX', name: 'US 30Y Yield', category: 'Rates' },

    // --- Crypto ---
    { symbol: 'BTC-USD', name: 'Bitcoin', category: 'Crypto' },
];

export const DEFAULT_TICKER_SELECTION: string[] = [
    '^GSPC',    // S&P 500
    '^NDX',     // NASDAQ 100
    '^DJI',     // Dow Jones
    '^RUT',     // Russell 2000
    '^VIX',     // VIX
    'BTC-USD'   // Bitcoin
];
