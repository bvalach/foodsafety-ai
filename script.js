document.addEventListener('DOMContentLoaded', () => {
  // DOM
  const paperGrid = document.getElementById('paper-grid');
  const modal = document.getElementById('modal');
  const closeButton = document.querySelector('.close-button');
  const modalTitle = document.getElementById('modal-title');
  const modalAuthors = document.getElementById('modal-authors');
  const modalDate = document.getElementById('modal-date');
  const modalDoi = document.getElementById('modal-doi');
  const modalAbstract = document.getElementById('modal-abstract');
  const modalLink = document.getElementById('modal-link');

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

  const resultCount = document.getElementById('result-count');
  const clearFiltersBtn = document.getElementById('clear-filters');

  // State
  let allPapers = [];
  let selectedCategories = new Set();
  let selectedSources = new Set();
  let dateRange = { min: 0, max: 48 };
  let actualDateRange = { minDate: null, maxDate: null };
  let availableCategories = new Set();
  let availableSources = new Set(['SemanticScholar', 'Crossref', 'arXiv']);

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
    setTimeout(()=>{ saveStatus.textContent=''; saveStatus.className='save-status'; }, 3000);
  }

  // Categories
  const categoryKeywords = {
    'Traceability & Supply Chain': ['traceability', 'supply chain', 'blockchain', 'provenance', 'food logistics'],
    'Contaminant & Adulteration Detection': ['contaminant', 'adulteration', 'food fraud', 'detection', 'spectroscopy', 'hyperspectral imaging', 'mycotoxin', 'pathogen'],
    'Quality Inspection & Grading': ['quality inspection', 'food quality', 'grading', 'computer vision', 'image analysis', 'defect detection', 'freshness'],
    'Predictive Analytics & Risk Assessment': ['risk assessment', 'predictive modeling', 'foodborne illness', 'spoilage prediction', 'shelf life', 'HACCP'],
    'Food Security & Forecasting': ['food security', 'yield forecasting', 'climate impact', 'market analysis', 'food access', 'food availability'],
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
        papers: allPapers,
        categories: Array.from(availableCategories),
        dateRange: actualDateRange,
        selectedCategories: Array.from(selectedCategories),
        selectedSources: Array.from(selectedSources)
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saveData));
    }catch(e){ console.error(e); showSaveStatus('Error saving data', false); }
  }
  function loadFromLocal(){
    try{
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if(!savedData) return null;
      const data = JSON.parse(savedData);
      allPapers = data.papers || [];
      availableCategories = new Set(data.categories || []);
      actualDateRange = data.dateRange || { minDate:null, maxDate:null };
      selectedCategories = new Set(data.selectedCategories || []);
      selectedSources = new Set(data.selectedSources || availableSources);
      initializeTimeline(allPapers);
      initializeCategoryFilters();
      initializeSourceFilters();
      applyFilters();
      showSaveStatus(`Loaded ${allPapers.length} papers from cache.`, true);
      return data;
    }catch(e){
      console.error(e); showSaveStatus('Error loading cached data', false); localStorage.removeItem(LOCAL_STORAGE_KEY);
      return null;
    }
  }

  // Exports
  function exportToJson(){
    try{
      const exportData = {
        exportDate: new Date().toISOString(),
        totalPapers: allPapers.length,
        dateRange: actualDateRange,
        categories: Array.from(availableCategories),
        papers: allPapers.map(p=>({...p, exportNote:'Generated by Food Safety & Security AI Observatory'}))
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `foodSafetyAI-Observatory-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      showSaveStatus('JSON exported');
    }catch(e){ console.error(e); showSaveStatus('Error exporting JSON', false); }
  }
  function exportToCsv(){
    try{
      const headers = ['Title','Authors','Date','Categories','DOI','URL','Abstract'];
      const rows = [headers.join(',')];
      allPapers.forEach(p=>{
        const row = [
          `"${(p.title||'').replace(/"/g,'""')}"`,
          `"${Array.isArray(p.authors)? p.authors.join('; '): ''}"`,
          `"${p.date||''}"`,
          `"${p.categories? p.categories.join('; '): ''}"`,
          `"${p.doi||''}"`,
          `"${p.url||''}"`,
          `"${(p.abstract||'').replace(/"/g,'""').substring(0,500)}"`,
        ];
        rows.push(row.join(','));
      });
      const blob = new Blob([rows.join('\\n')], {type:'text/csv'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `foodSafetyAI-Observatory-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      showSaveStatus('CSV exported');
    }catch(e){ console.error(e); showSaveStatus('Error exporting CSV', false); }
  }
  function exportToMarkdown(){
    try{
      const today = new Date().toLocaleDateString();
      let md = `# Food Safety & Security AI Observatory\\n\\n`;
      md += `**Generated:** ${today}  \\n`;
      md += `**Total Papers:** ${allPapers.length}  \\n`;
      md += `**Date Range:** ${actualDateRange.minDate?.toLocaleDateString()} - ${actualDateRange.maxDate?.toLocaleDateString()}  \\n\\n`;
      md += `## Categories\\n\\n`;
      Array.from(availableCategories).sort().forEach(cat=>{
        const count = allPapers.filter(p=>p.categories?.includes(cat)).length;
        md += `- **${cat}**: ${count} papers\\n`;
      });
      md += `\\n`;
      Array.from(availableCategories).sort().forEach(category=>{
        const catPapers = allPapers.filter(p=>p.categories?.includes(category));
        if(!catPapers.length) return;
        md += `## ${category} (${catPapers.length} papers)\\n\\n`;
        catPapers.sort((a,b)=> new Date(b.date)-new Date(a.date)).forEach(p=>{
          md += `### ${p.title||'Untitled'}\\n\\n`;
          md += `**Authors:** ${Array.isArray(p.authors)? p.authors.join(', '): 'N/A'}  \\n`;
          md += `**Date:** ${p.date||'N/A'}  \\n`;
          if(p.doi) md += `**DOI:** https://doi.org/${p.doi}  \\n`;
          if(p.url && p.url !== '#') md += `**URL:** ${p.url}  \\n`;
          md += `**Categories:** ${p.categories? p.categories.join(', '): 'N/A'}  \\n\\n`;
          if(p.abstract) md += `**Abstract:** \\n${p.abstract}\\n\\n`;
          md += `---\\n\\n`;
        });
      });
      const blob = new Blob([md], {type:'text/markdown'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `foodSafetyAI-Observatory-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      showSaveStatus('Markdown exported');
    }catch(e){ console.error(e); showSaveStatus('Error exporting Markdown', false); }
  }

  // API queries
  async function searchSemanticScholar(){
    const combinedQuery = [
      '(food safety OR food security OR HACCP)',
      'AND',
      '(machine learning OR "artificial intelligence" OR "deep learning" OR "computer vision" OR hyperspectral OR "generative adversarial networks" OR "reinforcement learning" OR "natural language processing")'
    ].join(' ');
    const allFound = [];
    const fields = 'title,authors,year,abstract,url,publicationDate,externalIds';
    try{
      const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(combinedQuery)}&fields=${fields}&limit=100&year=2023-`;
      const controller = new AbortController();
      const to = setTimeout(()=>controller.abort(), 15000);
      const resp = await fetch(url, {headers:{'Accept':'application/json'}, signal:controller.signal});
      clearTimeout(to);
      if(!resp.ok) throw new Error(`S2 status ${resp.status}`);
      const data = await resp.json();
      if(data && data.data){
        const papers = data.data.map(p=>{
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
        });
        allFound.push(...papers);
      }
      return allFound;
    }catch(e){ console.warn('Semantic Scholar error', e); return []; }
  }

  async function searchCrossref(){
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
                abstract: item.abstract ? truncateText(item.abstract.replace(/<\/?[^>]+(>|$)/g, ""), 3000) : 'No abstract available.',
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
    const query = `(all:"food safety" OR all:"food security") AND (all:"machine learning" OR all:"deep learning" OR all:"artificial intelligence" OR all:"computer vision")`;
    const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&sortBy=submittedDate&sortOrder=descending&max_results=100`;
    try{
      const controller = new AbortController();
      const to = setTimeout(()=>controller.abort(), 10000);
      const resp = await fetch(url, {method:'GET', signal:controller.signal});
      clearTimeout(to);
      if(!resp.ok) throw new Error(`arXiv status ${resp.status}`);
      const xmlText = await resp.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      if (xmlDoc.getElementsByTagName("parsererror").length>0) throw new Error('Invalid XML response');
      const entries = xmlDoc.getElementsByTagName("entry");
      const papers = [];
      for(let i=0; i<entries.length; i++){
        const entry = entries[i];
        try{
          const title = entry.getElementsByTagName("title")[0]?.textContent?.trim() || '';
          const abstract = entry.getElementsByTagName("summary")[0]?.textContent?.trim() || '';
          const authors = Array.from(entry.getElementsByTagName("author")).map(a=>a.getElementsByTagName("name")[0]?.textContent?.trim() || '').filter(Boolean);
          const date = entry.getElementsByTagName("published")[0]?.textContent?.trim() || null;
          const url = entry.getElementsByTagName("id")[0]?.textContent?.trim() || '';
          const processed = {
            title: truncateText(title, 300),
            authors,
            date,
            abstract: truncateText(abstract, 3000),
            url: sanitizeUrl(url),
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
    resultCount.textContent = String(n);
  }
  function renderSkeleton(count=12){
    paperGrid.setAttribute('aria-busy', 'true');
    paperGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    for(let i=0;i<count;i++){
      const div = document.createElement('div');
      div.className = 'skel';
      div.innerHTML = '<div class="bar title"></div><div class="bar meta"></div><div class="bar line"></div><div class="bar line" style="width:65%"></div>';
      frag.appendChild(div);
    }
    paperGrid.appendChild(frag);
  }
  function showLoadingState(){
    renderSkeleton(12);
  }
  function showErrorState(message){
    paperGrid.removeAttribute('aria-busy');
    paperGrid.innerHTML = `<div style="grid-column:1 / -1; text-align:center; padding:2rem;">
      <p style="font-size:1rem; color:#334155; margin:0;">${escapeHtml(message)}</p>
      <button id="retry-load" type="button" class="filter-action-btn" style="margin-top:1rem;">Try again</button>
    </div>`;
    document.getElementById('retry-load')?.addEventListener('click', ()=>location.reload());
  }

  function createPaperCard(paper){
    const card = document.createElement('div');
    card.className = 'paper-card';
    const safeDate = paper.date ? escapeHtml(new Date(paper.date).toLocaleDateString()) : 'N/A';
    const safeDoi = sanitizeDoi(paper.doi);

    const h3 = document.createElement('h3');
    h3.textContent = paper.title || 'Untitled';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const authorsEl = document.createElement('span');
    authorsEl.textContent = Array.isArray(paper.authors) ? paper.authors.join(', ') : 'N/A';
    const dateEl = document.createElement('span');
    dateEl.textContent = safeDate;
    meta.appendChild(authorsEl);
    meta.appendChild(dateEl);

    const tags = document.createElement('div');
    tags.className = 'tags';

    if (paper.source){
      const s = document.createElement('span');
      s.className = 'tag source';
      s.dataset.source = paper.source;
      s.textContent = paper.source;
      tags.appendChild(s);
    }
    if (paper.categories && paper.categories.length){
      paper.categories.forEach(cat=>{
        const c = document.createElement('span');
        c.className = 'tag';
        c.textContent = cat;
        tags.appendChild(c);
      });
    }

    card.appendChild(h3);
    card.appendChild(meta);
    if (tags.hasChildNodes()) card.appendChild(tags);

    if (safeDoi){
      const doiEl = document.createElement('p');
      doiEl.className = 'paper-doi';
      doiEl.textContent = safeDoi;
      card.appendChild(doiEl);
    }

    card.addEventListener('click', ()=>openModal({ ...paper, date: safeDate }));
    return card;
  }

  function renderInBatches(papers, batch=24){
    paperGrid.setAttribute('aria-busy', 'true');
    paperGrid.innerHTML = '';
    let i = 0;
    function chunk(){
      const frag = document.createDocumentFragment();
      for(let c=0; c<batch && i<papers.length; c++, i++){
        frag.appendChild(createPaperCard(papers[i]));
      }
      paperGrid.appendChild(frag);
      if(i < papers.length) requestAnimationFrame(chunk);
      else paperGrid.removeAttribute('aria-busy');
    }
    requestAnimationFrame(chunk);
  }

  function displayPapers(papers){
    if(!papers.length){
      paperGrid.innerHTML = '<p>No papers found matching the selected criteria.</p>';
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
      const btn = document.createElement('button');
      btn.className = 'category-filter-btn active';
      btn.textContent = category;
      btn.dataset.category = category;
      btn.addEventListener('click', ()=>{
        if (selectedCategories.has(category)) selectedCategories.delete(category);
        else selectedCategories.add(category);
        updateCategoryButtons(); scheduleApplyFilters();
      });
      categoryFiltersContainer.appendChild(btn);
      selectedCategories.add(category);
    });
  }
  function updateCategoryButtons(){
    categoryFiltersContainer.querySelectorAll('.category-filter-btn').forEach(btn=>{
      const cat = btn.dataset.category;
      btn.classList.toggle('active', selectedCategories.has(cat));
    });
  }
  function selectAllCategories(){ availableCategories.forEach(c=>selectedCategories.add(c)); updateCategoryButtons(); scheduleApplyFilters(); }
  function clearAllCategories(){ selectedCategories.clear(); updateCategoryButtons(); scheduleApplyFilters(); }

  function initializeSourceFilters(){
    sourceFiltersContainer.innerHTML = '';
    selectedSources = new Set();
    availableSources.forEach(source=>{
      const btn = document.createElement('button');
      btn.className = 'source-filter-btn active';
      btn.textContent = source;
      btn.dataset.source = source;
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
    sourceFiltersContainer.querySelectorAll('.source-filter-btn').forEach(btn=>{
      const src = btn.dataset.source;
      btn.classList.toggle('active', selectedSources.has(src));
    });
  }
  function selectAllSources(){ availableSources.forEach(s=>selectedSources.add(s)); updateSourceButtons(); scheduleApplyFilters(); }
  function clearAllSources(){ selectedSources.clear(); updateSourceButtons(); scheduleApplyFilters(); }

  function applyFilters(){
    // Filter by category
    const byCat = allPapers.filter(p=>{
      if (selectedCategories.size===0) return true;
      return p.categories?.some(cat=>selectedCategories.has(cat));
    });
    // Filter by source
    const bySrc = byCat.filter(p=>{
      if (selectedSources.size===0) return true;
      return selectedSources.has(p.source);
    });
    // Filter by date
    const minVal = parseInt(dateSliderMin.value);
    const maxVal = parseInt(dateSliderMax.value);
    const baseYear = actualDateRange.minDate ? actualDateRange.minDate.getFullYear() : 2025;
    const minDate = monthIndexToDate(minVal, baseYear);
    const maxDate = monthIndexToDate(maxVal + 1, baseYear);
    const filtered = bySrc.filter(p=>{
      if(!p.date) return false;
      const d = new Date(p.date);
      return d >= minDate && d < maxDate;
    });
    displayPapers(filtered);
  }
  const scheduleApplyFilters = debounce(applyFilters, 100);

  // Timeline utils
  function dateToMonthIndex(date, baseYear){ const y = date.getFullYear(); const m = date.getMonth(); return (y - baseYear)*12 + m; }
  function monthIndexToDate(index, baseYear){ const y = baseYear + Math.floor(index/12); const m = index % 12; return new Date(y, m, 1); }
  function formatMonthYear(index, baseYear){ const d = monthIndexToDate(index, baseYear); return `${monthNames[d.getMonth()]} ${d.getFullYear()}`; }

  function updateDateRange(){
    const minVal = parseInt(dateSliderMin.value);
    const maxVal = parseInt(dateSliderMax.value);
    if (minVal > maxVal) dateSliderMin.value = maxVal;
    if (maxVal < minVal) dateSliderMax.value = minVal;
    const finalMin = parseInt(dateSliderMin.value);
    const finalMax = parseInt(dateSliderMax.value);
    const baseYear = actualDateRange.minDate ? actualDateRange.minDate.getFullYear() : 2025;
    selectedRange.textContent = `${formatMonthYear(finalMin, baseYear)} - ${formatMonthYear(finalMax, baseYear)}`;
    scheduleApplyFilters();
  }

  function initializeTimeline(papers){
    if (!papers.length) return;
    const dates = papers.map(p=>new Date(p.date)).filter(d=>!isNaN(d));
    if (!dates.length) return;
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    actualDateRange = { minDate, maxDate };
    const baseYear = minDate.getFullYear();
    const minIndex = dateToMonthIndex(minDate, baseYear);
    const maxIndex = dateToMonthIndex(maxDate, baseYear);
    dateRange = { min: minIndex, max: maxIndex };
    dateSliderMin.min = dateSliderMax.min = String(minIndex);
    dateSliderMin.max = dateSliderMax.max = String(maxIndex);
    dateSliderMin.value = String(minIndex);
    dateSliderMax.value = String(maxIndex);
    document.getElementById('min-date').textContent = formatMonthYear(minIndex, baseYear);
    document.getElementById('max-date').textContent = formatMonthYear(maxIndex, baseYear);
    selectedRange.textContent = `${formatMonthYear(minIndex, baseYear)} - ${formatMonthYear(maxIndex, baseYear)}`;
  }
  function resetTimeline(){ dateSliderMin.value = dateRange.min; dateSliderMax.value = dateRange.max; updateDateRange(); }

  // Modal
  function openModal(paper){
    modalTitle.textContent = truncateText(paper.title || 'Untitled', 300);
    modalAuthors.textContent = 'Authors: ' + truncateText(Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors, 200);
    modalDate.textContent = 'Date: ' + (paper.date || 'N/A');
    const safeDoi = sanitizeDoi(paper.doi);
    if (safeDoi){
      modalDoi.innerHTML = '';
      const a = document.createElement('a');
      a.href = `https://doi.org/${safeDoi}`;
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = safeDoi; modalDoi.appendChild(a);
      modalDoi.style.display='block';
    }else{ modalDoi.style.display='none'; }
    modalAbstract.textContent = truncateText(paper.abstract || 'No abstract available.', 2000);
    const safeUrl = sanitizeUrl(paper.url);
    modalLink.href = safeUrl;
    modalLink.style.display = safeUrl === '#' ? 'none' : 'inline-block';
    modal.style.display = 'block';
  }
  function closeModal(){ modal.style.display='none'; }

  // Orchestration
  async function loadAllPapers(isBackground=false){
    if(!isBackground) showLoadingState();
    try{
      const [scholar, arxiv, crossref] = await Promise.all([
        searchSemanticScholar(),
        searchArxiv(),
        searchCrossref()
      ]);
      let merged = [...scholar, ...arxiv, ...crossref];
      if (!merged.length){ showErrorState('No papers could be loaded from the APIs. Check your connection and try again.'); return; }
      // dedupe by title (case-insensitive)
      merged = Array.from(new Map(merged.map(p=>[ (p.title||'').toLowerCase().trim(), p ])).values());
      const cutoff = new Date('2023-01-01');
      merged = merged.filter(p=>p.date && !isNaN(new Date(p.date)) && new Date(p.date) >= cutoff);
      merged.sort((a,b)=> new Date(b.date) - new Date(a.date));
      allPapers = merged;
      initializeTimeline(allPapers);
      initializeCategoryFilters();
      initializeSourceFilters();
      applyFilters();
      saveToLocal();
      if(isBackground) showSaveStatus(`Update complete. Total papers: ${allPapers.length}`, true);
    }catch(e){
      console.error(e);
      if(!isBackground) showErrorState('Unexpected error while loading papers. Please try again.');
      else showSaveStatus('Background update failed', false);
    }
  }

  // Events
  closeButton.addEventListener('click', closeModal);
  window.addEventListener('click', (e)=>{ if(e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && modal.style.display==='block') closeModal(); });

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
  saveLocalBtn.addEventListener('click', ()=>{ saveToLocal(); showSaveStatus('State saved', true); });
  loadLocalBtn.addEventListener('click', loadFromLocal);

  clearFiltersBtn.addEventListener('click', ()=>{
    selectAllCategories();
    selectAllSources();
    resetTimeline();
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
