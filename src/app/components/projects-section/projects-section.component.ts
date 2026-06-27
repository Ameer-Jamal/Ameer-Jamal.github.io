import { Component } from '@angular/core';
import { GitHubProjectsComponent } from '../github-projects/github-projects.component';

@Component({
  selector: 'app-projects-section',
  standalone: true,
  imports: [GitHubProjectsComponent],
  templateUrl: './projects-section.component.html'
})
export class ProjectsSectionComponent {}
