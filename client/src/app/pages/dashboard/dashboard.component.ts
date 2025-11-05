import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="page">
      <h1>🏠 Dashboard</h1>
      <p>Welcome to Quantify! This is your main overview page.</p>
    </div>
  `,
  styles: [`
    .page {
      padding: 20px;
      color: #fff;
    }
  `]
})
export class DashboardComponent {}
