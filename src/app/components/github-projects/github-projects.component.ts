import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { GitHubProject } from '../../models/github-project.model';
import { GitHubProjectsService } from '../../services/github-projects.service';

@Component({
  selector: 'app-github-projects',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './github-projects.component.html'
})
export class GitHubProjectsComponent implements OnInit {
  projects: GitHubProject[] = [];
  isLoading = true;
  hasError = false;
  currentIndex = 0;
  slideDirection: 'next' | 'prev' = 'next';

  constructor(private readonly githubProjectsService: GitHubProjectsService) {}

  ngOnInit(): void {
    this.githubProjectsService.getProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
        this.currentIndex = 0;
        this.isLoading = false;
      },
      error: () => {
        this.hasError = true;
        this.isLoading = false;
      }
    });
  }

  get currentProject(): GitHubProject | null {
    return this.projects[this.currentIndex] ?? null;
  }

  get positionLabel(): string {
    if (this.projects.length === 0) {
      return '';
    }
    return `Project ${this.currentIndex + 1} of ${this.projects.length}`;
  }

  goToPrevious(): void {
    if (this.projects.length <= 1) {
      return;
    }
    this.slideDirection = 'prev';
    this.currentIndex = (this.currentIndex - 1 + this.projects.length) % this.projects.length;
  }

  goToNext(): void {
    if (this.projects.length <= 1) {
      return;
    }
    this.slideDirection = 'next';
    this.currentIndex = (this.currentIndex + 1) % this.projects.length;
  }

  formatUpdatedDate(value: string | null): string {
    if (!value) {
      return 'Unknown';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
