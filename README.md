# AI in the agrifood industry: Advances towards food safety, control and monitoring


### Introduction

This repository contains the source code for a dynamic web application that serves as a research and technological surveillance on food safety and security assisted by AI, including ML, DL, GenAI, &c.. 

The project aims to provide an up-to-date, interactive repository of academic papers.

The application automatically fetches recent publications from CrossRef, arXiv (preprints, previously their peer-reviewed versions), and Semantic Scholar.

### Doctoral Research Context

This work is part of the PhD thesis and the managerial responsibilities of the authors:

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
