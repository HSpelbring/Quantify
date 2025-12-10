import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Sector {
  name: string;
  score: number; // 0-100, 50 neutral
  change: number; // percentage change
}

@Component({
  selector: 'app-sector-heatmap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sector-heatmap.html',
  styleUrl: './sector-heatmap.css',
})
export class SectorHeatmap {
  sectors: Sector[] = [
    { name: 'Technology', score: 75, change: 1.2 },
    { name: 'Finance', score: 45, change: -0.5 },
    { name: 'Healthcare', score: 60, change: 0.3 },
    { name: 'Energy', score: 30, change: -1.5 },
    { name: 'Consumer Disc.', score: 80, change: 2.1 },
    { name: 'Industrials', score: 55, change: 0.1 },
    { name: 'Utilities', score: 40, change: -0.2 },
    { name: 'Materials', score: 25, change: -1.8 },
    { name: 'Real Estate', score: 35, change: -0.9 },
    { name: 'Comm. Services', score: 65, change: 0.8 },
  ];

  getColor(score: number): string {
    // Return a color from Red to Green based on score
    // Simple interpolation or steps
    if (score <= 20) return '#ef4444'; // Red
    if (score <= 40) return '#f97316'; // Orange
    if (score <= 60) return '#6b7280'; // Grey/Neutral
    if (score <= 80) return '#84cc16'; // Lime
    return '#22c55e'; // Green
  }
}
