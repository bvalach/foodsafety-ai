document.addEventListener('DOMContentLoaded', () => {
    // --- Todos los selectores de elementos DOM permanecen iguales ---
    const paperGrid = document.getElementById('paper-grid');
    const modal = document.getElementById('modal');
    const closeButton = document.querySelector('.close-button');
    const modalTitle = document.getElementById('modal-title');
    const modalAuthors = document.getElementById('modal-authors');
    const modalDate = document.getElementById('modal-date');
    const modalDoi = document.getElementById('modal-doi');
    const modalAbstract = document.getElementById('modal-abstract');
    const modalLink = document.getElementById('modal-link');

    // --- FUNCIONES DE SEGURIDAD (sin cambios, siguen siendo necesarias) ---
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function sanitizeUrl(url) {
        if (!url) return '#';
        try {
            const urlObj = new URL(url);
            if (urlObj.protocol === 'https:' || urlObj.protocol === 'http:') {
                return url;
            }
        } catch (e) {
            console.warn('Invalid URL detected:', url);
        }
        return '#';
    }

    function sanitizeDoi(doi) {
        if (!doi) return '';
        const doiPattern = /^10\.\d{4,}\/[^\s]+$/;
        return doiPattern.test(doi) ? doi : '';
    }

    function truncateText(text, maxLength = 1000) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    // --- Todos los demás selectores de elementos (timeline, filtros, etc.) permanecen iguales ---
    const dateSliderMin = document.getElementById('date-slider-min');
    const dateSliderMax = document.getElementById('date-slider-max');
    const selectedRange = document.getElementById('selected-range');
    const resetButton = document.getElementById('reset-timeline');
    const minDateLabel = document.getElementById('min-date');
    const maxDateLabel = document.getElementById('max-date');

    const categoryFiltersContainer = document.getElementById('category-filters');
    const selectAllBtn = document.getElementById('select-all-categories');
        const clearAllBtn = document.getElementById('clear-all-categories');

    const sourceFiltersContainer = document.getElementById('source-filters');
    const selectAllSourcesBtn = document.getElementById('select-all-sources');
    const clearAllSourcesBtn = document.getElementById('clear-all-sources');
    
    const exportJsonBtn = document.getElementById('export-json');
    const exportCsvBtn = document.getElementById('export-csv');
    const exportMarkdownBtn = document.getElementById('export-markdown');
    const saveLocalBtn = document.getElementById('save-local');
    const loadLocalBtn = document.getElementById('load-local');
    const saveStatus = document.getElementById('save-status');

    let allPapers = [];
    let filteredPapers = [];
    let selectedCategories = new Set();
    let selectedSources = new Set();
    let dateRange = { min: 0, max: 48 };
    let actualDateRange = { minDate: null, maxDate: null };
    let availableCategories = new Set();
    let availableSources = new Set(['SemanticScholar', 'Crossref', 'arXiv']); // Fuentes predefinidas

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // --- [CAMBIO CLAVE 1] Nuevas categorías para Food Safety & Security ---
    const categoryKeywords = {
        'Traceability & Supply Chain': ['traceability', 'supply chain', 'blockchain', 'provenance', 'food logistics'],
        'Contaminant & Adulteration Detection': ['contaminant', 'adulteration', 'food fraud', 'detection', 'spectroscopy', 'hyperspectral imaging', 'mycotoxin', 'pathogen'],
        'Quality Inspection & Grading': ['quality inspection', 'food quality', 'grading', 'computer vision', 'image analysis', 'defect detection', 'freshness'],
        'Predictive Analytics & Risk Assessment': ['risk assessment', 'predictive modeling', 'foodborne illness', 'spoilage prediction', 'shelf life', 'HACCP'],
        'Food Security & Forecasting': ['food security', 'yield forecasting', 'climate impact', 'market analysis', 'food access', 'food availability'],
        'Process Optimization & Control': ['process control', 'optimization', 'food manufacturing', 'food processing', 'fermentation', 'drying'],
        'AI for Audits & Compliance': ['compliance', 'audit', 'regulatory', 'language model', 'NLP', 'document analysis'],
        'Robotics & Automation': ['robot', 'automation', 'sorting', 'packaging', 'handling']
    };

    function categorizePaper(paper) {
        const text = `${paper.title} ${paper.abstract}`;
        const categories = new Set(); // Usar un Set para evitar categorías duplicadas

        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            for (const keyword of keywords) {
                // Se crea una expresión regular para cada palabra clave.
                // \b asegura que se busquen palabras completas (p.ej., "ai" no coincide con "train").
                // 'i' hace que la búsqueda no distinga mayúsculas y minúsculas.
                const regex = new RegExp(`\\b${keyword}\\b`, 'i');
                if (regex.test(text)) {
                    categories.add(category);
                    break; // Si se encuentra una coincidencia, se pasa a la siguiente categoría.
                }
            }
        }

        const foundCategories = Array.from(categories);
        return foundCategories.length > 0 ? foundCategories : ['Other'];
    }
    
    // --- El resto de funciones de la UI (filtros, modales, etc.) no necesitan cambios ---
    // initializeCategoryFilters, toggleCategory, updateCategoryButtons, etc. son reutilizables.

    // --- [CAMBIO CLAVE 2] Actualización de nombres de archivo y clave de almacenamiento ---

    function exportToJson() {
        try {
            const exportData = {
                exportDate: new Date().toISOString(),
                totalPapers: allPapers.length,
                dateRange: actualDateRange,
                categories: Array.from(availableCategories),
                papers: allPapers.map(paper => ({
                    ...paper,
                    exportNote: 'Generated by Food Safety & Security AI Observatory' // Cambiado
                }))
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            // Nombre de archivo actualizado
            link.download = `foodSafetyAI-Observatory-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            showSaveStatus('JSON exported successfully!');
        } catch (error) {
            console.error('Error exporting JSON:', error);
            showSaveStatus('Error exporting JSON', false);
        }
    }

    function exportToCsv() {
        try {
            const headers = ['Title', 'Authors', 'Date', 'Categories', 'DOI', 'URL', 'Abstract'];
            const csvRows = [headers.join(',')];

            allPapers.forEach(paper => {
                const row = [
                    `"${(paper.title || '').replace(/"/g, '""')}"`,
                    `"${Array.isArray(paper.authors) ? paper.authors.join('; ') : ''}"`,
                    `"${paper.date || ''}"`,
                    `"${paper.categories ? paper.categories.join('; ') : ''}"`,
                    `"${paper.doi || ''}"`,
                    `"${paper.url || ''}"`,
                    `"${(paper.abstract || '').replace(/"/g, '""').substring(0, 500)}"`
                ];
                csvRows.push(row.join(','));
            });

            const csvContent = csvRows.join('\n');
            const dataBlob = new Blob([csvContent], { type: 'text/csv' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            // Nombre de archivo actualizado
            link.download = `foodSafetyAI-Observatory-${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            
            showSaveStatus('CSV exported successfully!');
        } catch (error) {
            console.error('Error exporting CSV:', error);
            showSaveStatus('Error exporting CSV', false);
        }
    }

    function exportToMarkdown() {
        try {
            const today = new Date().toLocaleDateString();
            // Título del Markdown actualizado
            let markdown = `# Food Safety & Security AI Observatory\n\n`;
            markdown += `**Generated:** ${today}  \n`;
            markdown += `**Total Papers:** ${allPapers.length}  \n`;
            markdown += `**Date Range:** ${actualDateRange.minDate?.toLocaleDateString()} - ${actualDateRange.maxDate?.toLocaleDateString()}  \n\n`;

            markdown += `## Categories\n\n`;
            Array.from(availableCategories).sort().forEach(category => {
                const count = allPapers.filter(p => p.categories?.includes(category)).length;
                markdown += `- **${category}**: ${count} papers\n`;
            });
            markdown += `\n`;

            Array.from(availableCategories).sort().forEach(category => {
                const categoryPapers = allPapers.filter(p => p.categories?.includes(category));
                if (categoryPapers.length === 0) return;

                markdown += `## ${category} (${categoryPapers.length} papers)\n\n`;
                
                categoryPapers.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(paper => {
                    markdown += `### ${paper.title || 'Untitled'}\n\n`;
                    markdown += `**Authors:** ${Array.isArray(paper.authors) ? paper.authors.join(', ') : 'N/A'}  \n`;
                    markdown += `**Date:** ${paper.date || 'N/A'}  \n`;
                    if (paper.doi) markdown += `**DOI:** [${paper.doi}](https://doi.org/${paper.doi})  \n`;
                    if (paper.url && paper.url !== '#') markdown += `**URL:** [Paper Link](${paper.url})  \n`;
                    markdown += `**Categories:** ${paper.categories ? paper.categories.join(', ') : 'N/A'}  \n\n`;
                    
                    if (paper.abstract) {
                        markdown += `**Abstract:** \n${paper.abstract}\n\n`;
                    }
                    markdown += `---\n\n`;
                });
            });

            const dataBlob = new Blob([markdown], { type: 'text/markdown' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            // Nombre de archivo actualizado
            link.download = `foodSafetyAI-Observatory-${new Date().toISOString().split('T')[0]}.md`;
            link.click();
            
            showSaveStatus('Markdown exported successfully!');
        } catch (error) {
            console.error('Error exporting Markdown:', error);
            showSaveStatus('Error exporting Markdown', false);
        }
    }
    
    const LOCAL_STORAGE_KEY = 'foodSafetyAI-Observatory'; // Clave de almacenamiento actualizada

    function saveToLocal() {
        try {
            const saveData = {
                timestamp: new Date().toISOString(),
                papers: allPapers,
                categories: Array.from(availableCategories),
                dateRange: actualDateRange,
                selectedCategories: Array.from(selectedCategories),
                selectedSources: Array.from(selectedSources)
            };

            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saveData));
        } catch (error) {
            console.error('Error saving locally:', error);
            showSaveStatus('Error saving data automatically', false);
        }
    }

    function loadFromLocal() {
        try {
            const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (!savedData) {
                return null;
            }

            const data = JSON.parse(savedData);
            allPapers = data.papers || [];
            availableCategories = new Set(data.categories || []);
            actualDateRange = data.dateRange || { minDate: null, maxDate: null };
            selectedCategories = new Set(data.selectedCategories || []);
            selectedSources = new Set(data.selectedSources || availableSources);

            initializeTimeline(allPapers);
            initializeCategoryFilters();
            initializeSourceFilters();
            applyFilters();

            showSaveStatus(`Loaded ${allPapers.length} papers from cache.`, true);
            return data;
        } catch (error) {
            console.error('Error loading from local:', error);
            showSaveStatus('Error loading cached data', false);
            localStorage.removeItem(LOCAL_STORAGE_KEY); // Limpiar caché corrupta
            return null;
        }
    }

    // --- [CAMBIO CLAVE 3] Nuevas Queries para las APIs ---

    async function searchSemanticScholar() {
        const combinedQuery = [
            '(food safety OR food security OR HACCP)',
            'AND',
            '(machine learning OR "artificial intelligence" OR "deep learning" OR "computer vision" OR hyperspectral OR "generative adversarial networks" OR "reinforcement learning" OR "natural language processing")'
        ].join(' ');
        
        const allFoundPapers = [];
        const fields = 'title,authors,year,abstract,url,publicationDate,externalIds';
        console.log(`Starting Semantic Scholar search with combined query.`);

        try {
            const encodedQuery = encodeURIComponent(combinedQuery);
            const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&fields=${fields}&limit=100&year=2023-`;
            console.log(`Querying Semantic Scholar for: "${combinedQuery}"`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout for a larger query
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`Semantic Scholar query failed with status: ${response.status}`);
                throw new Error(`Semantic Scholar query failed with status: ${response.status}`);
            }

            const data = await response.json();
            if (data && data.data) {
                const papers = data.data.map(paper => {
                    const processedPaper = {
                        title: truncateText(paper.title || '', 300),
                        authors: Array.isArray(paper.authors) ? paper.authors.slice(0, 10).map(a => truncateText(a.name || '', 100)) : [],
                        date: paper.publicationDate || (paper.year ? `${paper.year}-01-01` : null),
                        abstract: truncateText(paper.abstract || '', 3000),
                        url: sanitizeUrl(paper.url),
                        doi: paper.externalIds && paper.externalIds.DOI ? sanitizeDoi(paper.externalIds.DOI) : null,
                        source: 'SemanticScholar'
                    };
                    processedPaper.categories = categorizePaper(processedPaper);
                    return processedPaper;
                });
                allFoundPapers.push(...papers);
            }
            console.log('Semantic Scholar total papers found:', allFoundPapers.length);
            return allFoundPapers;

        } catch (error) {
            console.error("Error during Semantic Scholar fetch:", error);
            return []; // Return empty array on error to not break Promise.all
        }
    }
    
    async function searchCrossref() {
        const queries = [
            'food safety "machine learning"',
            'food security "artificial intelligence"',
            '"deep learning" "food quality"',
            '"computer vision" "food inspection"',
            'food traceability',
            'food adulteration',
            'HACCP AI'
        ];
        
        const mailto = "bvalach@doctor.upv.es";
        const maxRetries = 3;
        const retryDelay = 2000;
        console.log(`Starting Crossref search with ${queries.length} parallel queries.`);

        const fetchQuery = async (query) => {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const encodedQuery = encodeURIComponent(query);
                    const url = `https://api.crossref.org/works?query=${encodedQuery}&rows=100&filter=from-pub-date:2023-01-01&mailto=${mailto}`;
                    console.log(`Querying Crossref for: "${query}" (Attempt ${attempt})`);
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => {
                        controller.abort();
                        console.warn(`Crossref query for "${query}" timed out.`);
                    }, 15000);
                    const response = await fetch(url, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (!response.ok) throw new Error(`Crossref query failed with status: ${response.status}`);
                    const data = await response.json();
                    
                    if (data.status === 'ok' && data.message && data.message.items) {
                        return data.message.items.map(item => {
                            const authors = item.author ? item.author.map(a => `${a.given || ''} ${a.family || ''}`).filter(name => name.trim()) : [];
                            let publicationDate = null;
                            if (item.published && item.published['date-parts'] && item.published['date-parts'][0]) {
                                const [year, month = 1, day = 1] = item.published['date-parts'][0];
                                publicationDate = new Date(Date.UTC(year, month - 1, day));
                            }
                            const isValidDate = publicationDate && !isNaN(publicationDate);

                            const processedPaper = {
                                title: item.title && item.title.length > 0 ? item.title[0] : 'No title available',
                                authors: authors,
                                date: isValidDate ? publicationDate.toISOString().split('T')[0] : null,
                                abstract: item.abstract ? truncateText(item.abstract.replace(/<\/?[^>]+(>|$)/g, ""), 3000) : 'No abstract available.',
                                url: sanitizeUrl(item.URL),
                                doi: item.DOI ? sanitizeDoi(item.DOI) : null,
                                source: 'Crossref'
                            };
                            processedPaper.categories = categorizePaper(processedPaper);
                            return processedPaper;
                        }).filter(p => p.date);
                    }
                    return []; // Return empty array if no items
                } catch (error) {
                    console.warn(`Attempt ${attempt} for "${query}" failed:`, error.message);
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    } else {
                        console.error(`All ${maxRetries} attempts failed for Crossref query: "${query}"`);
                        return []; // Return empty array on final failure
                    }
                }
            }
            return []; // Should be unreachable
        };

        try {
            const paperPromises = queries.map(fetchQuery);
            const paperArrays = await Promise.all(paperPromises);
            const allFoundPapers = paperArrays.flat();
            console.log('Crossref search completed. Total papers found:', allFoundPapers.length);
            return allFoundPapers;

        } catch (error) {
            console.error("Error fetching from Crossref:", error);
            return [];
        }
    }

    async function searchArxiv() {
        // Query para ArXiv, usando sus operadores booleanos
        const query = `(all:"food safety" OR all:"food security") AND (all:"machine learning" OR all:"deep learning" OR all:"artificial intelligence" OR all:"computer vision")`;
        const encodedQuery = encodeURIComponent(query);
        const url = `https://export.arxiv.org/api/query?search_query=${encodedQuery}&sortBy=submittedDate&sortOrder=descending&max_results=100`;
        
        console.log('Starting ArXiv search...');
        // ... (el resto de la lógica de fetch, parseo de XML y procesado no cambia)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(url, { method: 'GET', signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            
            if (xmlDoc.getElementsByTagName("parsererror").length > 0) throw new Error('Invalid XML response');
            const entries = xmlDoc.getElementsByTagName("entry");
            console.log('ArXiv entries found:', entries.length);
            const papers = [];
            
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                try {
                    const title = entry.getElementsByTagName("title")[0]?.textContent?.trim() || '';
                    const abstract = entry.getElementsByTagName("summary")[0]?.textContent?.trim() || '';
                    const authors = Array.from(entry.getElementsByTagName("author")).map(a => a.getElementsByTagName("name")[0]?.textContent?.trim() || '').filter(name => name);
                    const date = entry.getElementsByTagName("published")[0]?.textContent?.trim() || null;
                    const url = entry.getElementsByTagName("id")[0]?.textContent?.trim() || '';
                    
                    const processedPaper = { 
                        title: truncateText(title, 300),
                        authors,
                        date,
                        abstract: truncateText(abstract, 3000),
                        url: sanitizeUrl(url),
                        doi: null,
                        source: 'arXiv'
                    };
                    processedPaper.categories = categorizePaper(processedPaper);
                    papers.push(processedPaper);
                } catch (e) {
                    console.warn('Error processing arXiv entry:', e);
                }
            }
            return papers;
        } catch (error) {
            console.error("Error fetching from arXiv:", error);
            return [];
        }
    }

    // --- El resto del script (loadAllPapers, displayPapers, createPaperCard, openModal, closeModal, etc.) ---
    // --- no necesita cambios funcionales y es completamente reutilizable.                       ---

    // Esta es la función de orquestación principal, que ahora usa las nuevas funciones de búsqueda
    async function loadAllPapers(isBackgroundRefresh = false) {
        if (!isBackgroundRefresh) {
            showLoadingState();
        }
        
        try {
            // Llama a las nuevas funciones de búsqueda
            const [scholarPapers, arxivPapers, crossrefPapers] = await Promise.all([
                searchSemanticScholar(),
                searchArxiv(),
                searchCrossref()
            ]);

            console.log('Semantic Scholar papers:', scholarPapers.length);
            console.log('ArXiv papers:', arxivPapers.length);
            console.log('Crossref papers:', crossrefPapers.length);

            allPapers = [...scholarPapers, ...arxivPapers, ...crossrefPapers];
            console.log('Total papers before filtering:', allPapers.length);

            if (allPapers.length === 0) {
                showErrorState('No papers could be loaded from the APIs. Please check your internet connection and try again.');
                return;
            }

            // Deduplicación y filtrado (sin cambios, es una lógica robusta)
            const uniquePapers = Array.from(
                new Map(allPapers.map(p => [p.title.toLowerCase().trim(), p])).values()
            );
            console.log('Unique papers after deduplication:', uniquePapers.length);

            const filterDate = new Date('2023-01-01');
            const filteredByDate = uniquePapers.filter(paper => {
                if (!paper.date || isNaN(new Date(paper.date))) return false;
                return new Date(paper.date) >= filterDate;
            });
            console.log('Papers after date filtering (2023+):', filteredByDate.length);
            
            filteredByDate.sort((a, b) => new Date(b.date) - new Date(a.date));
            allPapers = filteredByDate;
            
            initializeTimeline(allPapers);
            initializeCategoryFilters();
            initializeSourceFilters();

            if (allPapers.length === 0) {
                paperGrid.innerHTML = '<p>No papers found matching the criteria (published after January 2023).</p>';
                return;
            }
            applyFilters();
            saveToLocal(); // Guardar resultados

            if (isBackgroundRefresh) {
                showSaveStatus(`Update complete. Total papers: ${allPapers.length}`, true);
            }

        } catch (error) {
            console.error('Error loading papers:', error);
            if (!isBackgroundRefresh) {
                showErrorState('An unexpected error occurred while loading papers. Please try again.');
            } else {
                showSaveStatus('Failed to update papers in the background.', false);
            }
        }
    }
    
    // Todas las demás funciones (display, modal, timeline, etc.) se dejan sin cambios...
    // ... ya que su lógica es independiente del contenido que muestran.
    // Aquí irían el resto de funciones del script original que no he incluido por brevedad
    // (initializeTimeline, resetTimeline, displayPapers, createPaperCard, openModal, etc.)
    // La versión completa está abajo.
    
    // --- COMIENZO DE FUNCIONES NO MODIFICADAS PERO NECESARIAS ---

    function initializeCategoryFilters() {
        availableCategories.clear();
        allPapers.forEach(paper => {
            if (paper.categories) {
                paper.categories.forEach(cat => availableCategories.add(cat));
            }
        });

        categoryFiltersContainer.innerHTML = '';
        availableCategories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'category-filter-btn active';
            button.textContent = category;
            button.dataset.category = category;
            
            button.addEventListener('click', () => toggleCategory(category));
            categoryFiltersContainer.appendChild(button);
            
            selectedCategories.add(category);
        });
    }

    function toggleCategory(category) {
        if (selectedCategories.has(category)) {
            selectedCategories.delete(category);
        } else {
            selectedCategories.add(category);
        }
        
        updateCategoryButtons();
        applyFilters();
    }

    function updateCategoryButtons() {
        const buttons = categoryFiltersContainer.querySelectorAll('.category-filter-btn');
        buttons.forEach(button => {
            const category = button.dataset.category;
            if (selectedCategories.has(category)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    function selectAllCategories() {
        availableCategories.forEach(cat => selectedCategories.add(cat));
        updateCategoryButtons();
        applyFilters();
    }

    function clearAllCategories() {
        selectedCategories.clear();
        updateCategoryButtons();
        applyFilters();
    }

    function initializeSourceFilters() {
        sourceFiltersContainer.innerHTML = '';
        availableSources.forEach(source => {
            const button = document.createElement('button');
            button.className = 'source-filter-btn active';
            button.textContent = source;
            button.dataset.source = source;
            
            button.addEventListener('click', () => toggleSource(source));
            sourceFiltersContainer.appendChild(button);
            
            selectedSources.add(source);
        });
    }

    function toggleSource(source) {
        if (selectedSources.has(source)) {
            selectedSources.delete(source);
        } else {
            selectedSources.add(source);
        }
        
        updateSourceButtons();
        applyFilters();
    }

    function updateSourceButtons() {
        const buttons = sourceFiltersContainer.querySelectorAll('.source-filter-btn');
        buttons.forEach(button => {
            const source = button.dataset.source;
            if (selectedSources.has(source)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    function selectAllSources() {
        availableSources.forEach(src => selectedSources.add(src));
        updateSourceButtons();
        applyFilters();
    }

    function clearAllSources() {
        selectedSources.clear();
        updateSourceButtons();
        applyFilters();
    }

    function applyFilters() {
        // Filtrar por categoría
        const categoryFiltered = allPapers.filter(paper => {
            if (selectedCategories.size === 0) return true; // Si no hay categorías seleccionadas, se muestran todos los papers
            return paper.categories && paper.categories.some(cat => selectedCategories.has(cat));
        });

        // Filtrar por fuente
        const sourceFiltered = categoryFiltered.filter(paper => {
            if (selectedSources.size === 0) return true; // Si no hay fuentes seleccionadas, se muestran todos los papers de las categorías seleccionadas
            return selectedSources.has(paper.source);
        });

        const minVal = parseInt(dateSliderMin.value);
        const maxVal = parseInt(dateSliderMax.value);
        const baseYear = actualDateRange.minDate ? actualDateRange.minDate.getFullYear() : 2025;
        const minDate = monthIndexToDate(minVal, baseYear);
        const maxDate = monthIndexToDate(maxVal + 1, baseYear);

        const fullyFiltered = sourceFiltered.filter(paper => {
            if (!paper.date) return false;
            const paperDate = new Date(paper.date);
            return paperDate >= minDate && paperDate < maxDate;
        });

        displayPapers(fullyFiltered);
    }
    
    function showSaveStatus(message, isSuccess = true) {
        saveStatus.textContent = message;
        saveStatus.className = `save-status ${isSuccess ? 'success' : 'error'}`;
        setTimeout(() => {
            saveStatus.textContent = '';
            saveStatus.className = 'save-status';
        }, 3000);
    }

    function dateToMonthIndex(date, baseYear) {
        const year = date.getFullYear();
        const month = date.getMonth();
        return (year - baseYear) * 12 + month;
    }

    function monthIndexToDate(index, baseYear) {
        const year = baseYear + Math.floor(index / 12);
        const month = index % 12;
        return new Date(year, month, 1);
    }

    function formatMonthYear(index, baseYear) {
        const date = monthIndexToDate(index, baseYear);
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    }

    function updateDateRange() {
        const minVal = parseInt(dateSliderMin.value);
        const maxVal = parseInt(dateSliderMax.value);
        
        if (minVal > maxVal) dateSliderMin.value = maxVal;
        if (maxVal < minVal) dateSliderMax.value = minVal;
        
        const finalMin = parseInt(dateSliderMin.value);
        const finalMax = parseInt(dateSliderMax.value);
        
        const baseYear = actualDateRange.minDate ? actualDateRange.minDate.getFullYear() : 2025;
        const minText = formatMonthYear(finalMin, baseYear);
        const maxText = formatMonthYear(finalMax, baseYear);
        
        selectedRange.textContent = `${minText} - ${maxText}`;
        applyFilters();
    }

    function initializeTimeline(papers) {
        if (papers.length === 0) return;
        
        const dates = papers.map(p => new Date(p.date)).filter(d => !isNaN(d));
        if (dates.length === 0) return;
        
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        actualDateRange = { minDate, maxDate };
        
        const baseYear = minDate.getFullYear();
        const minIndex = dateToMonthIndex(minDate, baseYear);
        const maxIndex = dateToMonthIndex(maxDate, baseYear);
        dateRange = { min: minIndex, max: maxIndex };
        
        dateSliderMin.min = dateSliderMax.min = minIndex;
        dateSliderMin.max = dateSliderMax.max = maxIndex;
        dateSliderMin.value = minIndex;
        dateSliderMax.value = maxIndex;
        
        minDateLabel.textContent = formatMonthYear(minIndex, baseYear);
        maxDateLabel.textContent = formatMonthYear(maxIndex, baseYear);
        updateDateRange();
    }

    function resetTimeline() {
        dateSliderMin.value = dateRange.min;
        dateSliderMax.value = dateRange.max;
        updateDateRange();
    }

    function showLoadingState() {
        paperGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 4rem;"><div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #ECF6CE; border-top: 4px solid #F4FA58; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div><p style="font-size: 1.2rem; color: #848484; margin: 0;">Loading latest research papers...</p><p style="font-size: 1rem; color: #848484; margin: 0.5rem 0 0 0; opacity: 0.8;">This may take a few moments</p></div><style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>`;
    }

    function showErrorState(message) {
        paperGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 2rem;"><div style="font-size: 1rem; margin-bottom: 1rem;">⚠️</div><p style="font-size: 1.2rem; color: #848484; margin: 0;">${message}</p><button onclick="location.reload()" style="background: linear-gradient(135deg, #ECF6CE, #F4FA58); color: #2c2c2c; border: none; padding: 1rem 2rem; border-radius: 50px; font-weight: 500; margin-top: 1.5rem; cursor: pointer; transition: transform 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">Try Again</button></div>`;
    }

    function displayPapers(papers) {
        paperGrid.innerHTML = '';
        if (papers.length === 0) {
            paperGrid.innerHTML = '<p>No papers found matching the selected criteria.</p>';
            return;
        }
        papers.forEach(createPaperCard);
    }

    function createPaperCard(paper) {
        const card = document.createElement('div');
        card.className = 'paper-card';
        
        const safeDate = paper.date ? escapeHtml(new Date(paper.date).toLocaleDateString()) : 'N/A';
        const safeDoi = sanitizeDoi(paper.doi);

        const titleElement = document.createElement('h3');
        titleElement.textContent = paper.title || 'Untitled';

        const authorsElement = document.createElement('p');
        authorsElement.textContent = Array.isArray(paper.authors) ? paper.authors.join(', ') : 'N/A';

        const dateElement = document.createElement('p');
        dateElement.textContent = safeDate;

        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'paper-tags';
        tagsContainer.style.cssText = 'margin-top: 0.5rem; margin-bottom: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;';

        if (paper.source) {
            const sourceTag = document.createElement('span');
            sourceTag.className = 'source-tag';
            sourceTag.textContent = paper.source;
            sourceTag.style.cssText = `padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;`;
            let bgColor, fgColor;
            switch (paper.source) {
                case 'arXiv': bgColor = '#FDECDF'; fgColor = '#B75C09'; break;
                case 'SemanticScholar': bgColor = '#DDEBFF'; fgColor = '#0052CC'; break;
                case 'Crossref': bgColor = '#E3FCEF'; fgColor = '#006644'; break;
                default: bgColor = '#EBECF0'; fgColor = '#42526E';
            }
            sourceTag.style.backgroundColor = bgColor;
            sourceTag.style.color = fgColor;
            tagsContainer.appendChild(sourceTag);
        }
        
        if (paper.categories && paper.categories.length > 0) {
            paper.categories.forEach(category => {
                const categoryTag = document.createElement('span');
                categoryTag.className = 'category-tag';
                categoryTag.textContent = category;
                categoryTag.style.cssText = `background: linear-gradient(135deg,rgba(235, 206, 246, 0.77),rgba(88, 199, 250, 0.44)); color: #2c2c2c; padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 500;`;
                tagsContainer.appendChild(categoryTag);
            });
        }
        
        if (tagsContainer.hasChildNodes()) card.appendChild(tagsContainer);

        card.appendChild(titleElement);
        card.appendChild(authorsElement);
        card.appendChild(dateElement);

        if (safeDoi) {
            const doiElement = document.createElement('p');
            doiElement.className = 'paper-doi';
            doiElement.textContent = safeDoi;
            card.appendChild(doiElement);
        }

        card.addEventListener('click', () => openModal({ ...paper, date: safeDate }));
        paperGrid.appendChild(card);
    }

    function openModal(paper) {
        modalTitle.textContent = truncateText(paper.title || 'Untitled', 300);
        modalAuthors.textContent = 'Authors: ' + truncateText(Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors, 200);
        modalDate.textContent = 'Date: ' + (paper.date || 'N/A');

        const safeDoi = sanitizeDoi(paper.doi);
        if (safeDoi) {
            modalDoi.innerHTML = '';
            const doiLink = document.createElement('a');
            doiLink.href = `https://doi.org/${safeDoi}`;
            doiLink.target = '_blank';
            doiLink.rel = 'noopener noreferrer';
            doiLink.textContent = safeDoi;
            modalDoi.appendChild(doiLink);
            modalDoi.style.display = 'block';
        } else {
            modalDoi.style.display = 'none';
        }

        modalAbstract.textContent = truncateText(paper.abstract || 'No abstract available.', 2000);
        
        const safeUrl = sanitizeUrl(paper.url);
        modalLink.href = safeUrl;
        modalLink.style.display = safeUrl === '#' ? 'none' : 'inline-block';
        if (safeUrl !== '#') modalLink.rel = 'noopener noreferrer';

        modal.style.display = 'block';
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    // --- FIN DE FUNCIONES NO MODIFICADAS ---
    
    // Event listeners (sin cambios)
    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal.style.display === 'block') closeModal(); });
    dateSliderMin.addEventListener('input', updateDateRange);
    dateSliderMax.addEventListener('input', updateDateRange);
    resetButton.addEventListener('click', resetTimeline);
    selectAllBtn.addEventListener('click', selectAllCategories);
    clearAllBtn.addEventListener('click', clearAllCategories);
    selectAllSourcesBtn.addEventListener('click', selectAllSources);
    clearAllSourcesBtn.addEventListener('click', clearAllSources);
    exportJsonBtn.addEventListener('click', exportToJson);
    exportCsvBtn.addEventListener('click', exportToCsv);
    exportMarkdownBtn.addEventListener('click', exportToMarkdown);
    saveLocalBtn.addEventListener('click', () => { saveToLocal(); showSaveStatus('State saved manually!', true); });
    loadLocalBtn.addEventListener('click', loadFromLocal);

    // Inicialización de la aplicación
    function initialize() {
        const cachedData = loadFromLocal();
        if (cachedData) {
            const cacheAge = new Date() - new Date(cachedData.timestamp);
            const twelveHours = 12 * 60 * 60 * 1000;
            if (cacheAge > twelveHours) {
                showSaveStatus('Cache is old. Checking for updates in the background...', true);
                loadAllPapers(true); // Actualizar en segundo plano
            }
        } else {
            loadAllPapers(false); // Carga inicial completa
        }
    }

    initialize();
});