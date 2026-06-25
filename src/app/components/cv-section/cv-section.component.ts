import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cv-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cv-section.component.html'
})
export class CvSectionComponent {
  isPreviewVisible = false;

  showPreview(): void {
    this.isPreviewVisible = true;
  }

  @HostListener('window:portfolio-article-open', ['$event'])
  onPortfolioArticleOpen(event: CustomEvent<{ id?: string }>): void {
    if (event.detail?.id === 'CV') {
      this.showPreview();
    }
  }
}
