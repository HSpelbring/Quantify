import { Routes } from '@angular/router';

import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { LookupComponent } from './pages/lookup/lookup.component';
import { PortfolioComponent } from './pages/portfolio/portfolio.component';
import { InsightsComponent } from './pages/insights/insights.component';
import { NewsComponent } from './pages/news/news.component';
import { MarketSentiment } from './pages/market-sentiment/market-sentiment';
import { SettingsComponent } from './pages/settings/settings.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  { path: 'dashboard', component: DashboardComponent },
  { path: 'lookup', component: LookupComponent },
  { path: 'portfolio', component: PortfolioComponent },
  { path: 'insights', component: InsightsComponent },
  { path: 'market-sentiment', component: MarketSentiment },
  { path: 'news', component: NewsComponent },
  { path: 'settings', component: SettingsComponent },
];
