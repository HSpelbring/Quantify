import { Component } from '@angular/core';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [NgFor],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent {
  apis = [
    { name: 'YFinance', active: true },
    { name: 'Alpha Vantage', active: true },
    { name: 'Finnhub', active: false },
    { name: 'Polygon.io', active: true },
    { name: 'Go Backend', active: true },
    { name: 'Python FastAPI', active: true },
    { name: 'Redis Cache', active: false },
  ];
}