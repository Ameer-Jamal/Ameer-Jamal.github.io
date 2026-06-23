export interface GitHubProject {
  name: string;
  description: string;
  language: string;
  url: string;
  stars: number;
  forks: number;
  openIssues: number;
  updatedAt: string | null;
}
