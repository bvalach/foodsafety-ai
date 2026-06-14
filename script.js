document.addEventListener('DOMContentLoaded', () => {
  // DOM
  const paperGrid = document.getElementById('paper-grid');
  const resultsMain = document.getElementById('results');
  const modal = document.getElementById('modal');
  const modalBackdrop = document.querySelector('.modal-backdrop');
  const closeButton = document.querySelector('.close-button');
  const modalTitle = document.getElementById('modal-title');
  const modalSource = document.getElementById('modal-source');
  const modalAuthors = document.getElementById('modal-authors');
  const modalDate = document.getElementById('modal-date');
  const modalDoi = document.getElementById('modal-doi');
  const modalAbstract = document.getElementById('modal-abstract');
  const modalLink = document.getElementById('modal-link');
  const modalCitationBtn = document.getElementById('copy-citation');

  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  const selectedRange = document.getElementById('selected-range');
  const resetButton = document.getElementById('reset-timeline');

  const categoryFiltersContainer = document.getElementById('category-filters');
  const selectAllBtn = document.getElementById('select-all-categories');
  const clearAllBtn = document.getElementById('clear-all-categories');
  const categoryModeBtns = document.querySelectorAll('[data-mode]');

  const sourceFiltersContainer = document.getElementById('source-filters');
  const selectAllSourcesBtn = document.getElementById('select-all-sources');
  const clearAllSourcesBtn = document.getElementById('clear-all-sources');

  const exportJsonBtn = document.getElementById('export-json');
  const exportCsvBtn = document.getElementById('export-csv');
  const exportRisBtn = document.getElementById('export-ris');
  const exportMarkdownBtn = document.getElementById('export-markdown');
  const saveLocalBtn = document.getElementById('save-local');
  const loadLocalBtn = document.getElementById('load-local');
  const saveStatus = document.getElementById('save-status');
  const refreshDataBtn = document.getElementById('refresh-data');

  const resultCount = document.getElementById('result-count');
  const resultLabel = document.getElementById('result-label');
  const activeFiltersContainer = document.getElementById('active-filters');
  const apiStatusList = document.getElementById('api-status');
  const toastContainer = document.getElementById('toast-container');

  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const panelHeaders = document.querySelectorAll('.panel-header');

  // State
  let allPapers = [];
  let filteredPapers = [];
  let selectedCategories = new Set();
  let selectedSources = new Set();
  let categoryFilterMode = 'or'; // 'or' | 'and'
  let dateRange = { min: 0, max: 48 };
  let actualDateRange = { minDate: null, maxDate: null };
  let availableCategories = new Set();
  let availableSources = new Set(['SemanticScholar', 'Crossref', 'arXiv']);
  let searchQuery = '';
  let sortOrder = 'date-desc';

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun','Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // --- Utilities & security ---
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
      if (urlObj.protocol === 'https:' || urlObj.protocol === 'http:') return url;
    } catch {}
    return '#';
  }
  function sanitizeDoi(doi) {
    if (!doi) return '';
    const doiPattern = /^10\.\d{4,}\/[^\s]+$/;
    return doiPattern.test(doi) ? doi : '';
  }
  function normalizePaper(paper) {
    if (!paper || typeof paper !== 'object') return null;
    const normalized = {
      ...paper,
      title: typeof paper.title === 'string' ? paper.title : 'Untitled',
      authors: Array.isArray(paper.authors) ? paper.authors.filter(author => typeof author === 'string' && author.trim()) : [],
      date: typeof paper.date === 'string' ? paper.date : null,
      abstract: typeof paper.abstract === 'string' ? paper.abstract : '',
      url: sanitizeUrl(paper.url),
      doi: sanitizeDoi(paper.doi),
      source: typeof paper.source === 'string' ? paper.source : '',
      categories: Array.isArray(paper.categories) ? paper.categories.filter(category => typeof category === 'string' && category.trim()) : []
    };
    if (!normalized.categories.length) normalized.categories = categorizePaper(normalized);
    return normalized;
  }
  function truncateText(text, maxLength = 1000) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '…' : text;
  }
  function debounce(fn, wait=120){
    let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); };
  }
  function showSaveStatus(message, ok=true){
    saveStatus.textContent = message;
    saveStatus.className = `save-status${ok ? '' : ' error'}`;
    setTimeout(()=>{ saveStatus.textContent=''; saveStatus.className='save-status'; }, 4000);
  }

  function showToast(message, type='info'){
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toastContainer.appendChild(toast);
    requestAnimationFrame(()=> toast.classList.add('show'));
    setTimeout(()=>{
      toast.classList.remove('show');
      toast.addEventListener('transitionend', ()=> toast.remove(), {once:true});
      setTimeout(()=> toast.remove(), 500);
    }, 3500);
  }

  function setApiStatus(source, state){
    const li = apiStatusList?.querySelector(`[data-source="${source}"]`);
    if(!li) return;
    li.classList.remove('status-loading','status-ok','status-error');
    li.classList.add(`status-${state}`);
  }

  async function copyToClipboard(text){
    try{
      await navigator.clipboard.writeText(text);
      showToast('Citation copied to clipboard', 'success');
    }catch(e){
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Citation copied to clipboard', 'success');
    }
  }

  function formatCitation(paper){
    const authors = Array.isArray(paper.authors) ? paper.authors.join(', ') : '';
    const year = paper.date ? new Date(paper.date).getFullYear() : 'n.d.';
    const doi = paper.doi ? `https://doi.org/${paper.doi}` : sanitizeUrl(paper.url);
    return `${authors} (${year}). ${paper.title || 'Untitled'}. ${doi ? doi : ''}`;
  }

  // Categories
  const categoryKeywords = {
    'Traceability & Supply Chain': ['traceability', 'supply chain', 'blockchain', 'provenance', 'food logistics'],
    'Contaminant & Adulteration Detection': ['contaminant', 'adulteration', 'food fraud', 'detection', 'spectroscopy', 'hyperspectral imaging', 'mycotoxin', 'pathogen'],
    'Quality Inspection & Grading': ['quality inspection', 'food quality', 'grading', 'computer vision', 'image analysis', 'defect detection', 'freshness'],
    'Predictive Analytics & Risk Assessment': ['risk assessment', 'predictive modeling', 'foodborne illness', 'spoilage prediction', 'shelf life', 'HACCP'],
    'Food Safety Prediction': ['spoilage prediction', 'microbial growth', 'shelf life prediction', 'safety assessment', 'contamination prediction', 'hazard prediction', 'food spoilage'],
    'Process Optimization & Control': ['process control', 'optimization', 'food manufacturing', 'food processing', 'fermentation', 'drying'],
    'AI for Audits & Compliance': ['compliance', 'audit', 'regulatory', 'language model', 'NLP', 'document analysis'],
    'Generative AI': ['generative artificial intelligence', 'generative adversarial networks', 'GAN', 'VAE', 'language model', 'NLP', 'document analysis'],
    'Deep Learning': ['deep learning', 'neural networks', 'convolutional neural networks', 'recurrent neural networks', 'long short-term memory', 'transformer', 'attention mechanism', 'autoencoder', 'generative adversarial networks', 'VAE', 'GAN', 'language model', 'NLP', 'document analysis'],
    'Machine learning': ['machine learning', 'supervised learning', 'unsupervised learning', 'reinforcement learning', 'decision trees', 'random forests', 'support vector machines', 'neural networks', 'convolutional neural networks', 'recurrent neural networks', 'long short-term memory', 'transformer', 'attention mechanism', 'autoencoder', 'generative adversarial networks', 'VAE', 'GAN', 'language model', 'NLP', 'document analysis'],
    'Robotics & Automation': ['robot', 'automation', 'sorting', 'packaging', 'handling'],
  };
  function categorizePaper(paper){
    const text = `${paper.title} ${paper.abstract}`.toLowerCase();
    const categories = new Set();
    for (const [category, keywords] of Object.entries(categoryKeywords)){
      for (const keyword of keywords){
        const re = new RegExp(`\\b${keyword}\\b`, 'i');
        if (re.test(text)){ categories.add(category); break; }
      }
    }
    const found = Array.from(categories);
    return found.length ? found : ['Other'];
  }

  // Persistence
  const LOCAL_STORAGE_KEY = 'foodSafetyAI-Observatory';
  function saveToLocal(){
    try{
      const saveData = {
        timestamp: new Date().toISOString(),
        papers: allPapers.map(normalizePaper).filter(Boolean),
        categories: Array.from(availableCategories),
        dateRange: actualDateRange,
        selectedCategories: Array.from(selectedCategories),
        selectedSources: Array.from(selectedSources),
        categoryFilterMode,
        searchQuery,
        sortOrder,
        dateRangeValues: { from: dateFrom.value, to: dateTo.value }
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saveData));
    }catch(e){ console.error(e); showSaveStatus('Error saving data', false); }
  }
  function loadFromLocal(){
    try{
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if(!savedData) return null;
      const data = JSON.parse(savedData);
      allPapers = Array.isArray(data.papers) ? data.papers.map(normalizePaper).filter(Boolean) : [];
      availableCategories = new Set(data.categories || []);
      actualDateRange = data.dateRange || { minDate:null, maxDate:null };
      selectedCategories = new Set(data.selectedCategories || []);
      selectedSources = new Set(data.selectedSources || availableSources);
      categoryFilterMode = data.categoryFilterMode === 'and' ? 'and' : 'or';
      searchQuery = typeof data.searchQuery === 'string' ? data.searchQuery : '';
      sortOrder = ['date-desc','date-asc','title-asc','title-desc'].includes(data.sortOrder) ? data.sortOrder : 'date-desc';
      searchInput.value = searchQuery;
      sortSelect.value = sortOrder;
      initializeTimeline(allPapers);
      if(data.dateRangeValues){
        dateFrom.value = data.dateRangeValues.from;
        dateTo.value = data.dateRangeValues.to;
      }
      initializeCategoryFilters();
      initializeSourceFilters();
      updateDateRange();
      showSaveStatus(`Loaded ${allPapers.length} papers from cache.`, true);
      return data;
    }catch(e){
      console.error(e); showSaveStatus('Error loading cached data', false); localStorage.removeItem(LOCAL_STORAGE_KEY);
      return null;
    }
  }

  // Exports — all use filteredPapers so they respect the current session filters.
  function getExportPapers(){ return filteredPapers.length ? filteredPapers : getFilteredPapers(); }
  function buildExportMeta(){
    const fromYear = parseInt(dateFrom.value);
    const toYear = parseInt(dateTo.value);
    return {
      exportDate: new Date().toISOString(),
      query: searchQuery || null,
      categories: { mode: categoryFilterMode, selected: Array.from(selectedCategories) },
      sources: Array.from(selectedSources),
      dateRange: `${fromYear} – ${toYear}`,
      sortOrder,
      filteredCount: filteredPapers.length,
      totalCount: allPapers.length
    };
  }

  function exportToJson(){
    try{
      const exportData = {
        ...buildExportMeta(),
        papers: getExportPapers().map(p=>({ ...normalizePaper(p), exportNote:'Generated by Food Safety & Security AI Observatory' }))
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `foodSafetyAI-Observatory-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      showSaveStatus(`JSON exported (${exportData.filteredCount} papers)`);
    }catch(e){ console.error(e); showSaveStatus('Error exporting JSON', false); }
  }
  function exportToCsv(){
    try{
      const papers = getExportPapers();
      const headers = ['Title','Authors','Date','Categories','Source','DOI','URL','Abstract'];
      const rows = [headers.join(',')];
      papers.forEach(p=>{
        const safeUrl = sanitizeUrl(p.url);
        const escape = (str) => `"${String(str || '').replace(/"/g,'""')}"`;
        const row = [
          escape(p.title),
          escape(Array.isArray(p.authors)? p.authors.join('; '): ''),
          escape(p.date || ''),
          escape(p.categories? p.categories.join('; '): ''),
          escape(p.source || ''),
          escape(p.doi || ''),
          escape(safeUrl === '#' ? '' : safeUrl),
          escape(p.abstract || '')
        ];
        rows.push(row.join(','));
      });
      const blob = new Blob([rows.join('\n')], {type:'text/csv'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `foodSafetyAI-Observatory-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      showSaveStatus(`CSV exported (${papers.length} papers)`);
    }catch(e){ console.error(e); showSaveStatus('Error exporting CSV', false); }
  }
  function exportToMarkdown(){
    try{
      const today = new Date().toLocaleDateString();
      const papers = getExportPapers();
      const meta = buildExportMeta();
      let md = `# Food Safety & Security AI Observatory\n\n`;
      md += `**Generated:** ${today}  \n`;
      md += `**Filtered Papers:** ${papers.length} of ${allPapers.length}  \n`;
      md += `**Date Range:** ${meta.dateRange}  \n`;
      if(searchQuery) md += `**Search:** ${searchQuery}  \n`;
      if(selectedCategories.size) md += `**Categories (${categoryFilterMode.toUpperCase()}):** ${meta.categories.selected.join(', ')}  \n`;
      if(selectedSources.size) md += `**Sources:** ${meta.sources.join(', ')}  \n`;
      md += `\n`;
      papers.forEach(p=>{
        const safeUrl = sanitizeUrl(p.url);
        md += `## ${p.title||'Untitled'}\n\n`;
        md += `**Authors:** ${Array.isArray(p.authors)? p.authors.join(', '): 'N/A'}  \n`;
        md += `**Date:** ${p.date||'N/A'}  \n`;
        md += `**Source:** ${p.source||'N/A'}  \n`;
        if(p.doi) md += `**DOI:** https://doi.org/${p.doi}  \n`;
        if(safeUrl !== '#') md += `**URL:** ${safeUrl}  \n`;
        md += `**Categories:** ${p.categories? p.categories.join(', '): 'N/A'}  \n\n`;
        if(p.abstract) md += `**Abstract:** \n${p.abstract}\n\n`;
        md += `---\n\n`;
      });
      const blob = new Blob([md], {type:'text/markdown'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `foodSafetyAI-Observatory-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      showSaveStatus(`Markdown exported (${papers.length} papers)`);
    }catch(e){ console.error(e); showSaveStatus('Error exporting Markdown', false); }
  }
  function exportToRis(){
    try{
      const papers = getExportPapers();
      const lines = [];
      papers.forEach(p=>{
        const safeUrl = sanitizeUrl(p.url);
        lines.push('TY  - JOUR');
        if(p.title) lines.push(`TI  - ${p.title}`);
        if(p.authors && p.authors.length){
          p.authors.forEach(author=>{
            lines.push(`AU  - ${author}`);
          });
        }
        if(p.date){
          const d = new Date(p.date);
          const year = d.getFullYear();
          const month = String(d.getMonth()+1).padStart(2,'0');
          const day = String(d.getDate()).padStart(2,'0');
          lines.push(`PY  - ${year}`);
          lines.push(`DA  - ${year}/${month}/${day}`);
        }
        if(p.abstract) lines.push(`AB  - ${p.abstract}`);
        if(p.doi) lines.push(`DO  - ${p.doi}`);
        if(safeUrl !== '#') lines.push(`UR  - ${safeUrl}`);
        lines.push('ER  - ');
        lines.push('');
      });
      const blob = new Blob([lines.join('\r\n')], {type:'application/x-research-info-systems'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `foodSafetyAI-Observatory-${new Date().toISOString().split('T')[0]}.ris`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      showSaveStatus(`RIS exported (${papers.length} papers)`);
    }catch(e){ console.error(e); showSaveStatus('Error exporting RIS', false); }
  }

  // API queries
  async function searchSemanticScholar(){
    // Semantic Scholar search is free-text; complex boolean phrases perform poorly.
    // We run several focused queries in parallel and deduplicate afterwards.
    const queries = [
      'food safety machine learning',
      'food quality artificial intelligence',
      'food processing deep learning computer vision',
      'HACCP predictive model food',
      'food contamination detection AI',
      'foodborne illness risk assessment machine learning'
    ];
    const fields = 'title,authors,year,abstract,url,publicationDate,externalIds';
    const limit = 100;
    const timeout = 25000;

    async function fetchOne(query, offset=0){
      const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=${fields}&limit=${limit}&offset=${offset}&year=2023-`;
      const controller = new AbortController();
      const to = setTimeout(()=>controller.abort(), timeout);
      const resp = await fetch(url, {headers:{'Accept':'application/json'}, signal:controller.signal});
      clearTimeout(to);
      if(!resp.ok) throw new Error(`S2 status ${resp.status}`);
      return resp.json();
    }

    function mapPaper(p){
      const processed = {
        title: truncateText(p.title||'', 300),
        authors: Array.isArray(p.authors) ? p.authors.slice(0, 10).map(a=>truncateText(a.name||'', 100)) : [],
        date: p.publicationDate || (p.year ? `${p.year}-01-01` : null),
        abstract: truncateText(p.abstract||'', 3000),
        url: sanitizeUrl(p.url),
        doi: p.externalIds && p.externalIds.DOI ? sanitizeDoi(p.externalIds.DOI) : null,
        source: 'SemanticScholar'
      };
      processed.categories = categorizePaper(processed);
      return processed;
    }

    try{
      // First page for each query
      const firstPages = await Promise.allSettled(queries.map(q=>fetchOne(q, 0)));
      const allFound = [];
      const nextRequests = [];

      firstPages.forEach((res, idx)=>{
        if(res.status !== 'fulfilled'){
          console.warn(`Semantic Scholar query "${queries[idx]}" failed:`, res.reason);
          return;
        }
        const data = res.value;
        if(data && data.data){
          allFound.push(...data.data.map(mapPaper));
          // If the API reports more results, schedule a second page for this query.
          const total = data.total || 0;
          if(total > limit) nextRequests.push({ query: queries[idx], offset: limit });
        }
      });

      if(nextRequests.length){
        const secondPages = await Promise.allSettled(nextRequests.map(r=>fetchOne(r.query, r.offset)));
        secondPages.forEach(res=>{
          if(res.status === 'fulfilled' && res.value && res.value.data){
            allFound.push(...res.value.data.map(mapPaper));
          }
        });
      }

      return allFound;
    }catch(e){ console.warn('Semantic Scholar error', e); return []; }
  }

  async function searchCrossref(){
    const queries = [
      '"food safety" "machine learning"',
      '"food processing" "artificial intelligence"',
      '"food industry" "deep learning"',
      '"food manufacturing" "computer vision"',
      '"food quality control" AI',
      '"food inspection" automation',
      '"HACCP" "predictive model"',
      '"food plant" "process control"',
      '"food contamination" detection',
      '"foodborne" "machine learning"'
    ];
    const mailto = "bvalach@doctor.upv.es";
    const maxRetries = 3;
    const retryDelay = 2000;
    const fetchQuery = async (query)=>{
      for(let attempt=1; attempt<=maxRetries; attempt++){
        try{
          const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=100&filter=from-pub-date:2023-01-01&mailto=${mailto}`;
          const controller = new AbortController();
          const to = setTimeout(()=>controller.abort(), 15000);
          const response = await fetch(url, {signal:controller.signal});
          clearTimeout(to);
          if(!response.ok) throw new Error(`Crossref status ${response.status}`);
          const data = await response.json();
          if(data.status==='ok' && data.message && data.message.items){
            return data.message.items.map(item=>{
              const authors = item.author ? item.author.map(a=>`${a.given||''} ${a.family||''}`.trim()).filter(Boolean) : [];
              let publicationDate = null;
              if(item.published && item.published['date-parts'] && item.published['date-parts'][0]){
                const [year, month=1, day=1] = item.published['date-parts'][0];
                publicationDate = new Date(Date.UTC(year, month-1, day));
              }
              const isValidDate = publicationDate && !isNaN(publicationDate);
              const processed = {
                title: item.title && item.title.length>0 ? truncateText(item.title[0], 300) : 'No title available',
                authors,
                date: isValidDate ? publicationDate.toISOString().split('T')[0] : null,
                abstract: item.abstract ? truncateText(new DOMParser().parseFromString(item.abstract, 'text/html').body.textContent || '', 3000) : 'No abstract available.',
                url: sanitizeUrl(item.URL),
                doi: item.DOI ? sanitizeDoi(item.DOI) : null,
                source: 'Crossref'
              };
              processed.categories = categorizePaper(processed);
              return processed;
            }).filter(p=>p.date);
          }
          return [];
        }catch(err){
          if(attempt<maxRetries){ await new Promise(r=>setTimeout(r, retryDelay)); }
          else { console.warn(`Crossref failed for "${query}"`, err); return []; }
        }
      }
      return [];
    };
    try{
      const arrays = await Promise.all(queries.map(fetchQuery));
      return arrays.flat();
    }catch(e){ console.error(e); return []; }
  }

  async function searchArxiv(){
    // arXiv API prefers HTTPS; HTTP mixed-content is blocked on GitHub Pages.
    const query = `(all:"food safety" OR all:"food quality" OR all:"food processing" OR all:"food inspection" OR all:"food manufacturing") AND (all:"machine learning" OR all:"deep learning" OR all:"artificial intelligence" OR all:"computer vision" OR all:"automation")`;
    // Restrict to submissions from 2023 onwards using arXiv date range syntax.
    const dateRange = 'submittedDate:[202301010000+TO+202612312359]';
    const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}+AND+${dateRange}&sortBy=submittedDate&sortOrder=descending&max_results=100`;
    try{
      const controller = new AbortController();
      const to = setTimeout(()=>controller.abort(), 20000);
      const resp = await fetch(url, {method:'GET', signal:controller.signal});
      clearTimeout(to);
      if(!resp.ok) throw new Error(`arXiv status ${resp.status}`);
      const xmlText = await resp.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      if (xmlDoc.getElementsByTagName("parsererror").length>0) throw new Error('Invalid XML response');
      const entries = xmlDoc.getElementsByTagName("entry");
      const papers = [];
      const cutoff = new Date('2023-01-01');
      for(let i=0; i<entries.length; i++){
        const entry = entries[i];
        try{
          const title = entry.getElementsByTagName("title")[0]?.textContent?.trim() || '';
          const abstract = entry.getElementsByTagName("summary")[0]?.textContent?.trim() || '';
          const authors = Array.from(entry.getElementsByTagName("author")).map(a=>a.getElementsByTagName("name")[0]?.textContent?.trim() || '').filter(Boolean);
          const date = entry.getElementsByTagName("published")[0]?.textContent?.trim() || null;
          const idUrl = entry.getElementsByTagName("id")[0]?.textContent?.trim() || '';
          // Prefer PDF link when available.
          const links = Array.from(entry.getElementsByTagName("link"));
          const pdfLink = links.find(l=>l.getAttribute('type')==='application/pdf');
          const finalUrl = pdfLink ? pdfLink.getAttribute('href') : idUrl;

          // Server-side date filter is best-effort; enforce it client-side too.
          if(date && new Date(date) < cutoff) continue;

          const processed = {
            title: truncateText(title, 300),
            authors,
            date,
            abstract: truncateText(abstract, 3000),
            url: sanitizeUrl(finalUrl),
            doi: null,
            source: 'arXiv'
          };
          processed.categories = categorizePaper(processed);
          papers.push(processed);
        }catch(e){ /* skip bad entry */ }
      }
      return papers;
    }catch(e){ console.warn('arXiv error', e); return []; }
  }

  // UI helpers
  function updateResultCount(n){
    resultCount.textContent = String(n).padStart(1, '0');
    resultLabel.textContent = n === 1 ? 'paper' : 'papers';
  }
  function renderSkeleton(count=12){
    resultsMain.setAttribute('aria-busy', 'true');
    paperGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    for(let i=0;i<count;i++){
      const div = document.createElement('div');
      div.className = 'skel';
      div.innerHTML = '<div class="bar source"></div><div class="bar title"></div><div class="bar meta"></div><div class="bar line"></div><div class="bar line" style="width:65%"></div>';
      frag.appendChild(div);
    }
    paperGrid.appendChild(frag);
  }
  function showLoadingState(){
    renderSkeleton(12);
  }
  function showErrorState(message){
    resultsMain.removeAttribute('aria-busy');
    paperGrid.innerHTML = `<div class="empty-state">
      <h3>Could not load papers</h3>
      <p>${escapeHtml(message)}</p>
      <button id="retry-load" type="button" class="primary-button">Try again</button>
    </div>`;
    document.getElementById('retry-load')?.addEventListener('click', ()=>location.reload());
  }

  function createPaperCard(paper){
    const card = document.createElement('article');
    card.className = 'paper-card';
    const safeDate = paper.date ? escapeHtml(new Date(paper.date).toLocaleDateString()) : 'N/A';
    const safeDoi = sanitizeDoi(paper.doi);
    const year = paper.date ? new Date(paper.date).getFullYear() : '';

    const source = document.createElement('span');
    source.className = `paper-source source-${paper.source || 'unknown'}`;
    source.textContent = paper.source || 'Unknown';

    const h3 = document.createElement('h3');
    h3.textContent = paper.title || 'Untitled';

    const meta = document.createElement('div');
    meta.className = 'paper-meta';
    meta.innerHTML = `<span>${escapeHtml(Array.isArray(paper.authors) ? paper.authors.slice(0, 3).join(', ') + (paper.authors.length > 3 ? ` +${paper.authors.length - 3}` : '') : 'N/A')}</span><span class="paper-year" aria-label="Publication year">${year || safeDate}</span>`;

    const abstract = document.createElement('p');
    abstract.className = 'paper-abstract';
    abstract.textContent = truncateText(paper.abstract || '', 220);

    const tags = document.createElement('div');
    tags.className = 'paper-tags';
    if(paper.categories && paper.categories.length){
      paper.categories.slice(0, 3).forEach(cat=>{
        const c = document.createElement('span');
        c.className = 'paper-tag';
        c.textContent = cat;
        tags.appendChild(c);
      });
      if(paper.categories.length > 3){
        const more = document.createElement('span');
        more.className = 'paper-tag more';
        more.textContent = `+${paper.categories.length - 3}`;
        tags.appendChild(more);
      }
    }

    card.appendChild(source);
    card.appendChild(h3);
    card.appendChild(meta);
    if(paper.abstract) card.appendChild(abstract);
    if(tags.hasChildNodes()) card.appendChild(tags);

    card.addEventListener('click', ()=>openModal({ ...paper, date: safeDate }));
    return card;
  }

  function renderInBatches(papers, batch=24){
    resultsMain.setAttribute('aria-busy', 'true');
    paperGrid.innerHTML = '';
    let i = 0;
    function chunk(){
      const frag = document.createDocumentFragment();
      for(let c=0; c<batch && i<papers.length; c++, i++){
        frag.appendChild(createPaperCard(papers[i]));
      }
      paperGrid.appendChild(frag);
      if(i < papers.length) requestAnimationFrame(chunk);
      else resultsMain.removeAttribute('aria-busy');
    }
    requestAnimationFrame(chunk);
  }

  function displayPapers(papers){
    if(!papers.length){
      paperGrid.innerHTML = `<div class="empty-state">
        <h3>No papers match</h3>
        <p>Try widening your date range, clearing some filters, or using a broader search.</p>
        <button type="button" class="primary-button" id="empty-clear">Clear filters</button>
      </div>`;
      document.getElementById('empty-clear')?.addEventListener('click', clearAllFilters);
      updateResultCount(0);
      return;
    }
    updateResultCount(papers.length);
    renderInBatches(papers);
  }

  // Filters
  function initializeCategoryFilters(){
    availableCategories.clear();
    allPapers.forEach(p=>p.categories?.forEach(cat=>availableCategories.add(cat)));
    categoryFiltersContainer.innerHTML = '';
    selectedCategories = new Set();
    availableCategories.forEach(category=>{
      const count = allPapers.filter(p=>p.categories?.includes(category)).length;
      const btn = document.createElement('button');
      btn.className = 'filter-btn active';
      btn.type = 'button';
      btn.dataset.category = category;
      btn.innerHTML = `<span class="filter-name">${escapeHtml(category)}</span><span class="filter-count">${count}</span>`;
      btn.addEventListener('click', ()=>{
        if (selectedCategories.has(category)) selectedCategories.delete(category);
        else selectedCategories.add(category);
        updateCategoryButtons(); scheduleApplyFilters();
      });
      categoryFiltersContainer.appendChild(btn);
      selectedCategories.add(category);
    });
    updateCategoryModeButtons();
  }
  function updateCategoryButtons(){
    categoryFiltersContainer.querySelectorAll('.filter-btn').forEach(btn=>{
      const cat = btn.dataset.category;
      btn.classList.toggle('active', selectedCategories.has(cat));
    });
  }
  function updateCategoryModeButtons(){
    categoryModeBtns.forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.mode === categoryFilterMode);
    });
  }
  function setCategoryMode(mode){
    categoryFilterMode = mode;
    updateCategoryModeButtons();
    scheduleApplyFilters();
  }
  function selectAllCategories(){ availableCategories.forEach(c=>selectedCategories.add(c)); updateCategoryButtons(); scheduleApplyFilters(); }
  function clearAllCategories(){ selectedCategories.clear(); updateCategoryButtons(); scheduleApplyFilters(); }

  function initializeSourceFilters(){
    sourceFiltersContainer.innerHTML = '';
    selectedSources = new Set();
    availableSources.forEach(source=>{
      const count = allPapers.filter(p=>p.source === source).length;
      const btn = document.createElement('button');
      btn.className = 'filter-btn active';
      btn.type = 'button';
      btn.dataset.source = source;
      btn.innerHTML = `<span class="filter-name">${escapeHtml(source)}</span><span class="filter-count">${count}</span>`;
      btn.addEventListener('click', ()=>{
        if(selectedSources.has(source)) selectedSources.delete(source);
        else selectedSources.add(source);
        updateSourceButtons(); scheduleApplyFilters();
      });
      sourceFiltersContainer.appendChild(btn);
      selectedSources.add(source);
    });
  }
  function updateSourceButtons(){
    sourceFiltersContainer.querySelectorAll('.filter-btn').forEach(btn=>{
      const src = btn.dataset.source;
      btn.classList.toggle('active', selectedSources.has(src));
    });
  }
  function selectAllSources(){ availableSources.forEach(s=>selectedSources.add(s)); updateSourceButtons(); scheduleApplyFilters(); }
  function clearAllSources(){ selectedSources.clear(); updateSourceButtons(); scheduleApplyFilters(); }

  function renderActiveFilterChips(){
    activeFiltersContainer.innerHTML = '';
    const chips = [];

    if(searchQuery){
      chips.push({ type:'search', label:`Search: ${searchQuery}`, remove:()=>{ searchInput.value=''; searchQuery=''; scheduleApplyFilters(); } });
    }

    selectedCategories.forEach(cat=>{
      chips.push({ type:'category', label:cat, remove:()=>{ selectedCategories.delete(cat); updateCategoryButtons(); scheduleApplyFilters(); } });
    });

    selectedSources.forEach(src=>{
      chips.push({ type:'source', label:src, remove:()=>{ selectedSources.delete(src); updateSourceButtons(); scheduleApplyFilters(); } });
    });

    const fromYear = parseInt(dateFrom.value);
    const toYear = parseInt(dateTo.value);
    const fullMin = actualDateRange.minDate ? actualDateRange.minDate.getFullYear() : fromYear;
    const fullMax = actualDateRange.maxDate ? actualDateRange.maxDate.getFullYear() : toYear;
    if(fromYear !== fullMin || toYear !== fullMax){
      chips.push({ type:'date', label:`Date: ${fromYear}–${toYear}`, remove:()=>{ resetTimeline(); } });
    }

    if(chips.length === 0){
      activeFiltersContainer.style.display = 'none';
      return;
    }
    activeFiltersContainer.style.display = 'flex';

    const wrapper = document.createElement('div');
    wrapper.className = 'chips-list';
    chips.forEach(chip=>{
      const el = document.createElement('button');
      el.className = `chip chip-${chip.type}`;
      el.type = 'button';
      el.innerHTML = `<span>${escapeHtml(chip.label)}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`;
      el.addEventListener('click', chip.remove);
      wrapper.appendChild(el);
    });

    const clear = document.createElement('button');
    clear.className = 'chip chip-clear';
    clear.type = 'button';
    clear.textContent = 'Clear all';
    clear.addEventListener('click', clearAllFilters);
    wrapper.appendChild(clear);

    activeFiltersContainer.appendChild(wrapper);
  }

  function clearAllFilters(){
    selectAllCategories();
    selectAllSources();
    resetTimeline();
    searchInput.value = '';
    searchQuery = '';
    sortSelect.value = 'date-desc';
    sortOrder = 'date-desc';
  }

  function parseSearchQuery(query){
    // Supports operators: author:smith, title:HACCP, year:2024, abstract:microbial, source:arxiv
    const terms = [];
    const regex = /(?:\b|^)(author|title|year|abstract|source):([^\s"']+|"[^"]*"|'[^']*')|([^\s]+)/gi;
    let m;
    while((m = regex.exec(query)) !== null){
      if(m[1]){
        const field = m[1].toLowerCase();
        let value = m[2].trim();
        if((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))){
          value = value.slice(1, -1);
        }
        terms.push({ field, value: value.toLowerCase() });
      }else if(m[3]){
        terms.push({ value: m[3].toLowerCase() });
      }
    }
    return terms;
  }

  function paperMatchesSearch(p, terms){
    if(!terms.length) return true;
    return terms.every(term => {
      const q = term.value;
      switch(term.field){
        case 'author':
          return (p.authors||[]).some(a=>a.toLowerCase().includes(q));
        case 'title':
          return (p.title||'').toLowerCase().includes(q);
        case 'abstract':
          return (p.abstract||'').toLowerCase().includes(q);
        case 'year':
          return p.date && String(new Date(p.date).getFullYear()).includes(q);
        case 'source':
          return (p.source||'').toLowerCase().includes(q);
        default:
          const haystack = [
            (p.title||'').toLowerCase(),
            (p.abstract||'').toLowerCase(),
            (p.authors||[]).join(' ').toLowerCase(),
            (p.categories||[]).join(' ').toLowerCase(),
            (p.source||'').toLowerCase()
          ].join(' ');
          return haystack.includes(q);
      }
    });
  }

  function getFilteredPapers(){
    let filtered = allPapers;
    // Search
    if (searchQuery) {
      const terms = parseSearchQuery(searchQuery);
      filtered = filtered.filter(p => paperMatchesSearch(p, terms));
    }
    // Filter by category
    if (selectedCategories.size > 0) {
      if(categoryFilterMode === 'and'){
        filtered = filtered.filter(p => {
          const cats = new Set(p.categories || []);
          return [...selectedCategories].every(cat => cats.has(cat));
        });
      }else{
        filtered = filtered.filter(p => p.categories?.some(cat => selectedCategories.has(cat)));
      }
    }
    // Filter by source
    if (selectedSources.size > 0) {
      filtered = filtered.filter(p => selectedSources.has(p.source));
    }
    // Filter by date
    const fromYear = parseInt(dateFrom.value);
    const toYear = parseInt(dateTo.value);
    const minDate = new Date(fromYear, 0, 1);
    const maxDate = new Date(toYear + 1, 0, 1);
    filtered = filtered.filter(p => {
      if (!p.date) return false;
      const d = new Date(p.date);
      return d >= minDate && d < maxDate;
    });
    // Sort
    switch (sortOrder) {
      case 'date-desc': filtered.sort((a, b) => new Date(b.date) - new Date(a.date)); break;
      case 'date-asc': filtered.sort((a, b) => new Date(a.date) - new Date(b.date)); break;
      case 'title-asc': filtered.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
      case 'title-desc': filtered.sort((a, b) => (b.title || '').localeCompare(a.title || '')); break;
    }
    return filtered;
  }

  function applyFilters(){
    filteredPapers = getFilteredPapers();
    renderActiveFilterChips();
    displayPapers(filteredPapers);
  }
  const scheduleApplyFilters = debounce(applyFilters, 100);

  // Timeline utils
  function updateDateRange(){
    let fromYear = parseInt(dateFrom.value);
    let toYear = parseInt(dateTo.value);
    if(fromYear > toYear){
      const tmp = fromYear;
      fromYear = toYear;
      toYear = tmp;
      dateFrom.value = String(fromYear);
      dateTo.value = String(toYear);
    }
    selectedRange.textContent = `${fromYear} – ${toYear}`;
    scheduleApplyFilters();
  }

  function initializeTimeline(papers){
    if (!papers.length) return;
    const dates = papers.map(p=>new Date(p.date)).filter(d=>!isNaN(d));
    if (!dates.length) return;
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    actualDateRange = { minDate, maxDate };
    const minYear = minDate.getFullYear();
    const maxYear = maxDate.getFullYear();
    dateRange = { min: minYear, max: maxYear };

    // Populate selects
    dateFrom.innerHTML = '';
    dateTo.innerHTML = '';
    for(let y = minYear; y <= maxYear; y++){
      const optFrom = document.createElement('option');
      optFrom.value = y; optFrom.textContent = y;
      dateFrom.appendChild(optFrom);
      const optTo = document.createElement('option');
      optTo.value = y; optTo.textContent = y;
      dateTo.appendChild(optTo);
    }
    dateFrom.value = String(minYear);
    dateTo.value = String(maxYear);
    selectedRange.textContent = `${minYear} – ${maxYear}`;
  }
  function resetTimeline(){ initializeTimeline(allPapers); updateDateRange(); }

  // Modal
  let currentModalPaper = null;
  function openModal(paper){
    currentModalPaper = paper;
    modalSource.textContent = paper.source || 'Unknown source';
    modalSource.className = `modal-source source-${paper.source || 'unknown'}`;
    modalTitle.textContent = truncateText(paper.title || 'Untitled', 300);
    modalAuthors.textContent = Array.isArray(paper.authors) ? paper.authors.join(', ') : 'N/A';
    modalDate.textContent = paper.date || 'N/A';
    const safeDoi = sanitizeDoi(paper.doi);
    if (safeDoi){
      modalDoi.innerHTML = '';
      const a = document.createElement('a');
      a.href = `https://doi.org/${safeDoi}`;
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = safeDoi;
      modalDoi.appendChild(a);
      modalDoi.style.display='block';
    }else{ modalDoi.style.display='none'; }
    modalAbstract.textContent = paper.abstract || 'No abstract available.';
    const safeUrl = sanitizeUrl(paper.url);
    modalLink.href = safeUrl;
    modalLink.style.display = safeUrl === '#' ? 'none' : 'inline-block';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(){ modal.classList.remove('open'); document.body.style.overflow = ''; currentModalPaper = null; }

  // Orchestration
  async function loadAllPapers(isBackground=false){
    if(!isBackground) showLoadingState();
    ['Crossref','SemanticScholar','arXiv'].forEach(s=>setApiStatus(s,'loading'));
    try{
      const results = await Promise.allSettled([
        searchCrossref(),
        searchSemanticScholar(),
        searchArxiv()
      ]);
      const crossref = results[0].status === 'fulfilled' ? results[0].value : [];
      const scholar = results[1].status === 'fulfilled' ? results[1].value : [];
      const arxiv = results[2].status === 'fulfilled' ? results[2].value : [];

      setApiStatus('Crossref', crossref.length ? 'ok' : 'error');
      setApiStatus('SemanticScholar', scholar.length ? 'ok' : 'error');
      setApiStatus('arXiv', arxiv.length ? 'ok' : 'error');

      let merged = [...crossref, ...scholar, ...arxiv];
      if (!merged.length){ showErrorState('No papers could be loaded from the APIs. Check your connection and try again.'); return; }
      // dedupe by title (case-insensitive)
      merged = Array.from(new Map(merged.map(p=>[ (p.title||'').toLowerCase().trim(), p ])).values());
      const cutoff = new Date('2023-01-01');
      merged = merged.filter(p=>p.date && !isNaN(new Date(p.date)) && new Date(p.date) >= cutoff);
      // Filter out agricultural papers (crop, yield, farm-related)
      const agriTerms = /\b(crop|crops|yield|yields|agricultural|farming|farm|planting|irrigation|harvest|agronomy|cultivation|field trial|soil|fertilizer|pesticide)\b/i;
      merged = merged.filter(p => !agriTerms.test(p.title + ' ' + (p.abstract || '')));
      merged.sort((a,b)=> new Date(b.date) - new Date(a.date));
      allPapers = merged;
      initializeTimeline(allPapers);
      initializeCategoryFilters();
      initializeSourceFilters();
      applyFilters();
      saveToLocal();
      if(isBackground) showToast(`Updated. ${allPapers.length} papers loaded.`, 'success');
    }catch(e){
      console.error(e);
      if(!isBackground) showErrorState('Unexpected error while loading papers. Please try again.');
      else showToast('Background update failed', 'error');
    }
  }

  // Events
  closeButton.addEventListener('click', closeModal);
  modalBackdrop?.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && modal.classList.contains('open')){
      closeModal();
    }else if(e.key === '/' && document.activeElement !== searchInput && !modal.classList.contains('open')){
      e.preventDefault();
      searchInput.focus();
    }
  });

  dateFrom.addEventListener('change', updateDateRange);
  dateTo.addEventListener('change', updateDateRange);
  resetButton.addEventListener('click', resetTimeline);
  selectAllBtn.addEventListener('click', selectAllCategories);
  clearAllBtn.addEventListener('click', clearAllCategories);
  selectAllSourcesBtn.addEventListener('click', selectAllSources);
  clearAllSourcesBtn.addEventListener('click', clearAllSources);

  categoryModeBtns.forEach(btn=>{
    btn.addEventListener('click', ()=> setCategoryMode(btn.dataset.mode));
  });

  searchInput.addEventListener('input', debounce(() => { searchQuery = searchInput.value.trim(); scheduleApplyFilters(); }, 200));
  sortSelect.addEventListener('change', () => { sortOrder = sortSelect.value; applyFilters(); });

  exportJsonBtn.addEventListener('click', exportToJson);
  exportCsvBtn.addEventListener('click', exportToCsv);
  exportRisBtn.addEventListener('click', exportToRis);
  exportMarkdownBtn.addEventListener('click', exportToMarkdown);
  saveLocalBtn.addEventListener('click', ()=>{ saveToLocal(); showToast('Snapshot saved locally', 'success'); });
  loadLocalBtn.addEventListener('click', loadFromLocal);
  refreshDataBtn.addEventListener('click', ()=> loadAllPapers(true));

  modalCitationBtn.addEventListener('click', ()=>{
    if(currentModalPaper) copyToClipboard(formatCitation(currentModalPaper));
  });

  panelHeaders.forEach(header=>{
    header.addEventListener('click', ()=>{
      const expanded = header.getAttribute('aria-expanded') === 'true';
      header.setAttribute('aria-expanded', String(!expanded));
      const body = document.getElementById(header.getAttribute('aria-controls'));
      if(body) body.classList.toggle('collapsed', expanded);
    });
  });

  function initialize(){
    const cached = loadFromLocal();
    if(cached){
      const age = new Date() - new Date(cached.timestamp);
      const twelveHours = 12*60*60*1000;
      if(age > twelveHours){
        showSaveStatus('Cache is old. Refreshing in background…', true);
        loadAllPapers(true);
      }
    }else{
      loadAllPapers(false);
    }
  }
  initialize();

});
