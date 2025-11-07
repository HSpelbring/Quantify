import { Component, HostListener, ElementRef, AfterViewInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { icons } from 'lucide';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, NgFor, NgIf],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements AfterViewInit {
    expanded = false;

  pages = [
    { icon: 'home', name: 'Dashboard', route: '/dashboard' },
    { icon: 'search', name: 'Lookup', route: '/lookup' },
    { icon: 'briefcase', name: 'Portfolio', route: '/portfolio' },
    { icon: 'brain', name: 'Insights', route: '/insights' },
    { icon: 'newspaper', name: 'News', route: '/news' },
    { icon: 'settings', name: 'Settings', route: '/settings' }
  ];

  constructor(private el: ElementRef) {}

  ngAfterViewInit() {
    const iconDivs = this.el.nativeElement.querySelectorAll('[data-icon]');
    iconDivs.forEach((div: HTMLElement) => {
        const iconName = div.dataset['icon'] as keyof typeof icons;
        const iconEntry = icons[iconName];

        // Some Lucide icons may not exist or be improperly typed, so we check and cast
        if (iconEntry && typeof (iconEntry as any).toSvg === 'function') {
        div.innerHTML = (iconEntry as any).toSvg({
            width: 22,
            height: 22,
            stroke: '#dcdcdc',
            'stroke-width': 1.8,
        });
        } else {
        console.warn(`⚠️ Lucide icon "${iconName}" not found.`);
        }
    });
  }


  @HostListener('mouseenter')
  onMouseEnter() {
    this.expanded = true;
    document.documentElement.style.setProperty('--navbar-width', '200px');
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.expanded = false;
    document.documentElement.style.setProperty('--navbar-width', '70px');
  }
}
