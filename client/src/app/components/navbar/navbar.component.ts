import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, NgFor],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  pages = [
    { emoji: '🏠', name: 'Dashboard', route: '/dashboard' },
    { emoji: '🔍', name: 'Lookup', route: '/lookup' },
    { emoji: '💼', name: 'Portfolio', route: '/portfolio' },
    { emoji: '🧠', name: 'Insights', route: '/insights' },
    { emoji: '📰', name: 'News', route: '/news' }
  ];
}
