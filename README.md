# Ameer Jamal Portfolio

Personal portfolio for showcasing projects, experience, and contact details. The site is deployed via GitHub Pages and mirrors the content hosted at https://ameer-jamal.github.io.

---

## Overview
- Single-page experience built on top of the HTML5Up framework with a custom design system.
- Dynamic "GitHub Highlights" carousel pulls pinned repositories first, then falls back to the GitHub REST API, and renders each README using Marked.
- README excerpts are sanitized, truncated, and rewritten so that images and links continue to work when embedded.
- Fully responsive layout optimized for fast loading and accessible navigation.
- Angular migration lives under `angular/` with the existing markup and scripts preserved.

---

## Tech Stack
- **Static site**: HTML5, CSS3, and vanilla JavaScript.
- **Frameworks & libraries**: HTML5Up template, Font Awesome icons, Marked.js for Markdown parsing, and jQuery/responsive-tools utilities bundled with the theme.
- **Data sources**: GitHub REST API and gh-pinned-repos for repository metadata.

---

## Local Development
1. Clone the repository  
   ```bash
   git clone https://github.com/Ameer-Jamal/Ameer-Jamal.github.io.git
   cd Ameer-Jamal.github.io
   ```
2. Serve the site with any static server (examples below).  
   ```bash
   # Python
   python3 -m http.server 4000

   # or Node
   npx serve
   ```
3. Visit http://localhost:4000 (or the port your server prints).

The project does not require a build step; all assets are precompiled.

### Angular App (migration)
The Angular version is in `angular/` and loads the existing scripts after Angular renders the DOM.

```bash
cd angular
npm install
npm run start
```

---

## Testing
Automated tests cover the GitHub projects module to ensure repository data is normalized correctly and README content is decoded safely.

```bash
npm test
```

Ensure you are running Node.js 18+ (the repo uses the built-in node:test runner).

---

## Project Structure
- `index.html` – entry point and layout.
- `assets/css` – site styles, including the main theme and noscript fallback.
- `assets/js/githubProjects.js` – logic for fetching repositories, sanitizing Markdown, and rendering the carousel.
- `assets/js/marked.min.js` – embedded Marked.js build for client-side Markdown parsing.
- `tests/githubProjects.test.js` – Node-based unit tests for the GitHub integration layer.

---

## Deployment
The `main` branch publishes automatically to GitHub Pages. Pushing to `main` is sufficient to release updates to https://ameer-jamal.github.io.

### Angular Deployment (planned)
Run `npm run build` inside `angular/` and deploy the contents of `angular/dist/portfolio` to GitHub Pages (either the root of the repo or a `/docs` folder).

---

## Credits
- [HTML5Up](https://html5up.net) for the base template and responsive tooling.
- [Unsplash](https://unsplash.com) for royalty-free imagery.
- [Font Awesome](https://fontawesome.com) for icons.
- [Marked](https://marked.js.org) for Markdown rendering on the client.

---

## Contact
Questions or collaboration ideas? Reach out via the contact section on the live site or open an issue in this repository.
