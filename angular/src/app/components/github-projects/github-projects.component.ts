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

  constructor(private readonly githubProjectsService: GitHubProjectsService) {}

  ngOnInit(): void {
    this.githubProjectsService.getProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
        this.isLoading = false;
      },
      error: () => {
        this.hasError = true;
        this.isLoading = false;
      }
    });
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
