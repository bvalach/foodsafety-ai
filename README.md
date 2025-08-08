# Socioeconomic perspectives and effects of Generative AI in the agrifood industry

## A Living Literature Review

### Introduction

This repository contains the source code for a dynamic web application that serves as a research and technological surveillane on food safety and security and AI-based technologies. 

The project aims to provide an up-to-date, interactive repository of academic papers.

The application automatically fetches recent publications from leading academic databases, filters them for relevance, and presents them in a user-friendly interface.

### Doctoral Research Context

This work is part of the PhD thesis and managerial responsibilities of the authors:

-   **PhD Candidate; COO:** Beatriz Vallina, PhD.
-   **Chief Executive Officer:** Eduardo Álvarez.
-   **Organisations:** Embutidos Maybe, S.A. (Asturias) & PhD in Agrifood Economics (Universitat Politècnica de València). Spain

Supervised by:

-   Dr Roberto Cervelló
-   Dr Juan José Llul

### Features

-   **Real-time Data Fetching:** Automatically retrieves paper data from the Semantic Scholar and arXiv APIs.
-   **Dynamic Filtering:** Displays only recent publications (from January 2025 onwards) to maintain the relevance of the review.
-   **Interactive Interface:** Users can click on any paper to view its abstract, authors, and other metadata in a modal window.
-   **DOI Integration:** Provides direct links to the papers via their Digital Object Identifier (DOI) where available.
-   **Literature Map:** Includes an interactive literature map generated with Litmaps to visualise connections between publications.

### Technical Overview

The application is built with standard web technologies:
-   HTML5
-   CSS3
-   Vanilla JavaScript

It fetches data asynchronously and dynamically generates the content on the client-side.

### Local Development

To run this project locally, a simple web server is required to handle API requests correctly due to browser security policies (CORS).

1.  Ensure you have Python installed.
2.  Navigate to the project's root directory in your terminal.
3.  Start the local server with the following command:

    ```bash
    # For Python 3
    python -m http.server
    ```

4.  Open your web browser and navigate to `http://localhost:8000`.

### Deployment

This project is designed for static hosting platforms and can be easily deployed using services like GitHub Pages.

### Data Sources

This living review is made possible by the public APIs provided by:

-   [Semantic Scholar](https://www.semanticscholar.org/product/api)
-   [arXiv](https://arxiv.org/help/api) 
-   [CrossRef](https://www.crossref.org/learning/)

# FoodSafety+AI – Front-end refresh (HTML + vanilla JS)

Changes focused on visual proportion, readability, and perceived performance, without adding frameworks.

## Highlights
- Cleaner typography scale using `clamp()` and unified spacing scale.
- Toned-down color palette and contrast-safe buttons/chips.
- Compact “Results summary” bar with live result count and one-click *Clear filters*.
- Skeleton loader replaces spinner to improve perceived performance.
- Batch rendering of cards (requestAnimationFrame) for smoother paint on large lists.
- Debounced filter interactions (sliders, chips) to avoid excessive reflow.
- Accessible improvements: `aria-live` for statuses, `aria-busy` on grid, focus-visible outlines, modal semantics.
- Icons/emojis removed from buttons and error states.
- No external libraries. Keeps CSP and current API calls.

## How to use
1. Replace your existing `index.html`, `style.css`, and `script.js` with these files.
2. Commit and push to GitHub Pages. No build step required.

## Notes
- All existing features (Crossref, Semantic Scholar, arXiv, exports, local cache) remain intact.
- The color palette is neutral with a single blue accent to keep the UI professional.
- You can further tune the spacing and font-sizes via tokens at the top of `style.css`.
