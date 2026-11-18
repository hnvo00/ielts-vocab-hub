/* =========================================================================
   Vocabulary study tools for topic lesson pages
   - tick words as learned
   - add words manually or import an Excel/CSV file
   - auto-fill from free dictionary + translation APIs
   - quick links to Oxford, Cambridge, Tra từ and Thesaurus
   - practice learned words: cloze, word → Vietnamese, Vietnamese → word,
     example-sentence recall
   The lesson page's own inline script still owns the base vocabData array.
   This file only adds tools around it.
   ========================================================================= */
(function () {
  'use strict';

  if (window.__vocabToolsLoaded) return;
  window.__vocabToolsLoaded = true;

  const pageKey = (typeof storageKey !== 'undefined' && storageKey)
    ? storageKey
    : 'page_' + encodeURIComponent(location.pathname);

  const LEARNED_KEY = 'vocabLearned_' + pageKey;
  const CUSTOM_KEY = 'vocabCustom_' + pageKey;

  const $ = id => document.getElementById(id);

  const escapeHtml = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const normalizeWord = value => String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const normalizeAnswer = value => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const stripArticles = value => normalizeAnswer(value).replace(/^(the|a|an)\s+/, '');

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (error) {
      console.warn('Could not read', key, error);
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Could not save', key, error);
      notify('Could not save to this browser.', 'error');
    }
  }

  function notify(message, type) {
    if (typeof showToast === 'function') {
      try {
        showToast(message, type);
        return;
      } catch (error) { /* fall through */ }
    }
    console.log(message);
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  let learned = new Set(loadJSON(LEARNED_KEY, []).map(Number).filter(Number.isFinite));
  let customItems = loadJSON(CUSTOM_KEY, []);
  if (!Array.isArray(customItems)) customItems = [];

  let filterMode = 'all';
  let practiceState = null;

  function getVocab() {
    return (typeof vocabData !== 'undefined' && Array.isArray(vocabData)) ? vocabData : [];
  }

  function getFiltered() {
    return (typeof filteredItems !== 'undefined' && Array.isArray(filteredItems)) ? filteredItems : getVocab();
  }

  function mergeCustomWords() {
    const data = getVocab();
    if (!data.length) return;

    // Notes typed on a custom row are stored in the lesson's normal vocab
    // store. Copy them back onto the custom item before merging.
    const savedKey = (typeof storageKey !== 'undefined' && storageKey) ? storageKey : '';
    const saved = savedKey ? loadJSON(savedKey, []) : [];
    if (Array.isArray(saved)) {
      const savedByNo = new Map(saved.map(item => [Number(item.no), item]));
      customItems.forEach(item => {
        const match = savedByNo.get(Number(item.no));
        if (match && match.note) item.note = match.note;
      });
    }

    const existing = new Set(data.map(item => normalizeWord(item.vocab)));
    customItems.forEach(item => {
      if (!item || !item.vocab) return;
      const key = normalizeWord(item.vocab);
      if (!key || existing.has(key)) return;
      data.push(item);
      existing.add(key);
    });
  }

  function nextNo() {
    return getVocab().reduce((max, item) => Math.max(max, Number(item.no) || 0), 0) + 1;
  }

  function wordExists(word) {
    const key = normalizeWord(word);
    return getVocab().some(item => normalizeWord(item.vocab) === key);
  }

  // -----------------------------------------------------------------------
  // Toolbar
  // -----------------------------------------------------------------------
  function injectToolbar() {
    if ($('vocab-tools')) return;
    const hero = document.querySelector('section');
    if (!hero) return;

    const toolbar = document.createElement('section');
    toolbar.id = 'vocab-tools';
    toolbar.className = 'bg-white rounded-2xl border border-slate-200/80 shadow-apple p-4 sm:p-5 mb-4';
    toolbar.innerHTML = `
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/70 flex items-center justify-center shrink-0">
              <i data-lucide="check-check" class="w-4 h-4 text-emerald-700"></i>
            </span>
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-slate-900">Vocabulary study tools</h2>
              <p id="vt-learned-summary" class="text-[11px] text-slate-500 mt-0.5">0 of 0 words marked learned</p>
            </div>
          </div>
          <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2.5">
            <div id="vt-learned-bar" class="h-full bg-emerald-600 rounded-full transition-all duration-300" style="width: 0%"></div>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" id="vt-btn-add" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            Add word
          </button>
          <button type="button" id="vt-btn-import" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors">
            <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5 text-emerald-600"></i>
            Import Excel
          </button>
          <button type="button" id="vt-btn-practice" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors disabled:opacity-45 disabled:cursor-not-allowed">
            <i data-lucide="brain" class="w-3.5 h-3.5"></i>
            <span id="vt-practice-label">Practice learned</span>
          </button>
        </div>
      </div>

      <div id="vt-import-panel" class="hidden mt-3 rounded-xl border border-dashed border-emerald-300/80 bg-emerald-50/30 p-3.5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p class="text-xs font-semibold text-slate-800">Import vocabulary from Excel or CSV</p>
            <p class="text-[11px] text-slate-500 mt-0.5">Use headers like Word, IPA, English meaning, Vietnamese meaning, Collocation, Example, Synonyms, Antonyms, Note.</p>
          </div>
          <div class="flex flex-wrap gap-2 shrink-0">
            <input type="file" id="vt-file" accept=".xlsx,.xls,.csv" class="hidden">
            <button type="button" id="vt-import-pick" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
              <i data-lucide="upload" class="w-3.5 h-3.5"></i>
              Choose file
            </button>
            <button type="button" id="vt-template" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold">
              <i data-lucide="download" class="w-3.5 h-3.5 text-emerald-600"></i>
              Template
            </button>
          </div>
        </div>
        <p id="vt-import-status" class="text-[11px] text-slate-500 mt-2"></p>
      </div>

      <div class="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p class="text-[11px] text-slate-500">Tick a word as learned, then practise only the ticked ones.</p>
        <label class="inline-flex items-center gap-2 text-[11px] font-medium text-slate-600">
          Show
          <select id="vt-filter" class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 focus:outline-none focus:border-emerald-600">
            <option value="all">All words</option>
            <option value="learned">Learned only</option>
            <option value="not-yet">Not learned yet</option>
          </select>
        </label>
      </div>
    `;
    hero.insertAdjacentElement('afterend', toolbar);

    $('vt-btn-add').addEventListener('click', openAddModal);
    $('vt-btn-practice').addEventListener('click', openPractice);
    $('vt-btn-import').addEventListener('click', () => {
      const panel = $('vt-import-panel');
      panel.classList.toggle('hidden');
      refreshIcons();
    });
    $('vt-import-pick').addEventListener('click', () => $('vt-file').click());
    $('vt-file').addEventListener('change', event => {
      const file = event.target.files && event.target.files[0];
      if (file) handleImport(file);
      event.target.value = '';
    });
    $('vt-template').addEventListener('click', downloadTemplate);
    $('vt-filter').addEventListener('change', event => {
      filterMode = event.target.value;
      filterData();
    });
  }

  function updateToolbar() {
    const data = getVocab();
    const total = data.length;
    const count = data.filter(item => learned.has(Number(item.no))).length;
    const summary = $('vt-learned-summary');
    const bar = $('vt-learned-bar');
    const practiceBtn = $('vt-btn-practice');
    const practiceLabel = $('vt-practice-label');

    if (summary) summary.textContent = `${count} of ${total} words marked learned`;
    if (bar) bar.style.width = `${total ? Math.round((count / total) * 100) : 0}%`;
    if (practiceBtn) practiceBtn.disabled = count === 0;
    if (practiceLabel) practiceLabel.textContent = count ? `Practice ${count} learned` : 'Practice learned';
  }

  // -----------------------------------------------------------------------
  // Decorate the lesson table/cards with learned checkboxes
  // -----------------------------------------------------------------------
  function prepareNumberColumn() {
    document.querySelectorAll('#tableBody').forEach(tbody => {
      const table = tbody.closest('table');
      if (!table) return;
      const header = table.querySelector('thead th');
      if (header) {
        header.style.width = '60px';
        header.style.paddingLeft = '8px';
        header.style.paddingRight = '8px';
      }
      tbody.querySelectorAll('tr > td:first-child').forEach(td => {
        td.style.paddingLeft = '8px';
        td.style.paddingRight = '8px';
        // Keep the number and tick on the first line of the row instead of
        // floating in the vertical middle of a tall row.
        td.style.verticalAlign = 'top';
      });
    });
  }

  function decorateRows() {
    prepareNumberColumn();
    const data = getFiltered();

    document.querySelectorAll('#tableBody tr').forEach((row, index) => {
      const item = data[index];
      if (!item || row.querySelector('.vt-learned-toggle')) return;
      const firstCell = row.querySelector('td');
      if (!firstCell) return;

      // Keep the row number and its checkbox in one centered flex group.
      // Previously the checkbox was appended as an inline sibling with a top
      // margin, so it drifted down and looked misaligned from row to row.
      let numberWrap = firstCell.querySelector('.vt-number-wrap');
      if (!numberWrap) {
        numberWrap = document.createElement('div');
        numberWrap.className = 'vt-number-wrap flex items-center justify-center gap-1.5';
        // Fixed-width number slot keeps the checkbox in the same place for
        // both single-digit and double-digit rows.
        const numberSpan = document.createElement('span');
        numberSpan.className = 'vt-number inline-flex h-4 w-4 items-center justify-center leading-none text-center';
        while (firstCell.firstChild) numberSpan.appendChild(firstCell.firstChild);
        numberWrap.appendChild(numberSpan);
        firstCell.appendChild(numberWrap);
      }

      const label = document.createElement('label');
      label.className = 'vt-learned-toggle inline-flex items-center justify-center cursor-pointer';
      label.title = 'Mark this word as learned';
      label.innerHTML = `<input type="checkbox" data-no="${Number(item.no)}" class="vt-learned-check w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 accent-emerald-600 cursor-pointer" ${learned.has(Number(item.no)) ? 'checked' : ''}>`;
      numberWrap.appendChild(label);

      if (learned.has(Number(item.no))) row.classList.add('bg-emerald-50/30');
    });

    document.querySelectorAll('#mobileCards > div').forEach((card, index) => {
      const item = data[index];
      if (!item || card.querySelector('.vt-learned-toggle')) return;
      const header = card.firstElementChild;
      if (!header) return;

      const label = document.createElement('label');
      label.className = 'vt-learned-toggle inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-1 rounded-lg cursor-pointer shrink-0';
      label.title = 'Mark this word as learned';
      label.innerHTML = `<input type="checkbox" data-no="${Number(item.no)}" class="vt-learned-check w-3 h-3 rounded border-slate-300 text-emerald-600 accent-emerald-600 cursor-pointer" ${learned.has(Number(item.no)) ? 'checked' : ''}> Learned`;
      header.appendChild(label);

      if (learned.has(Number(item.no))) card.classList.add('border-emerald-200', 'bg-emerald-50/20');
    });
  }

  function bindLearnedEvents() {
    ['tableBody', 'mobileCards'].forEach(id => {
      const container = $(id);
      if (!container) return;
      container.addEventListener('change', event => {
        const checkbox = event.target.closest('.vt-learned-check');
        if (!checkbox) return;
        const no = Number(checkbox.dataset.no);
        if (checkbox.checked) learned.add(no); else learned.delete(no);
        saveJSON(LEARNED_KEY, Array.from(learned));
        filterData();
      });
    });
  }

  // -----------------------------------------------------------------------
  // Add-word modal
  // -----------------------------------------------------------------------
  function injectAddModal() {
    if ($('vt-add-modal')) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div id="vt-add-modal" class="fixed inset-0 z-[70] hidden">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" data-vt-close="add"></div>
        <div class="relative z-10 mx-auto mt-6 sm:mt-12 w-[calc(100%-1.5rem)] max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200">
          <div class="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-5 py-3.5 flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-slate-900">Add a vocabulary item</h3>
              <p class="text-[11px] text-slate-500 mt-0.5">Type it yourself, auto-fill from free dictionaries, or check Oxford / Tra từ.</p>
            </div>
            <button type="button" data-vt-close="add" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <form id="vt-add-form" class="p-4 sm:p-5 space-y-3.5">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="sm:col-span-2">
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Word / phrase *</label>
                <input id="vt-word" required autocomplete="off" placeholder="e.g., mitigate" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">IPA</label>
                <input id="vt-ipa" autocomplete="off" placeholder="/ˈmɪt.ɪ.ɡeɪt/" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Vietnamese meaning *</label>
                <input id="vt-vi" required autocomplete="off" placeholder="giảm thiểu, làm dịu bớt" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">English meaning</label>
                <input id="vt-eng" autocomplete="off" placeholder="to make something less harmful" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-semibold text-slate-600 mb-1">Collocation</label>
              <input id="vt-colloc" autocomplete="off" placeholder="mitigate the impact of" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
            </div>

            <div>
              <label class="block text-[11px] font-semibold text-slate-600 mb-1">Example sentence</label>
              <textarea id="vt-example" rows="2" placeholder="Carbon taxes can mitigate the impact of industrial emissions." class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"></textarea>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Synonyms</label>
                <input id="vt-syn" autocomplete="off" placeholder="reduce, lessen, ease" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Antonyms</label>
                <input id="vt-anto" autocomplete="off" placeholder="intensify, worsen" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-semibold text-slate-600 mb-1">Personal note</label>
              <input id="vt-note" autocomplete="off" placeholder="Optional note" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
            </div>

            <div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div class="flex flex-wrap items-center gap-2">
                <button type="button" id="vt-lookup" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold">
                  <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                  Auto-fill
                </button>
                <span class="text-[10px] text-slate-400">from Free Dictionary + MyMemory</span>
              </div>
              <div class="flex flex-wrap items-center gap-2 mt-2 text-[11px] font-medium">
                <a id="vt-link-oxford" target="_blank" rel="noopener" class="text-emerald-700 hover:underline">Oxford</a>
                <span class="text-slate-300">·</span>
                <a id="vt-link-cambridge" target="_blank" rel="noopener" class="text-emerald-700 hover:underline">Cambridge</a>
                <span class="text-slate-300">·</span>
                <a id="vt-link-tratu" target="_blank" rel="noopener" class="text-emerald-700 hover:underline">Tra từ</a>
                <span class="text-slate-300">·</span>
                <a id="vt-link-thesaurus" target="_blank" rel="noopener" class="text-emerald-700 hover:underline">Thesaurus</a>
              </div>
              <p id="vt-lookup-status" class="text-[11px] text-slate-500 mt-2"></p>
            </div>

            <div class="flex items-center justify-end gap-2 pt-1">
              <button type="button" data-vt-close="add" class="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">Add word</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper.firstElementChild);

    $('vt-add-form').addEventListener('submit', submitAddWord);
    $('vt-lookup').addEventListener('click', lookupWord);
    $('vt-word').addEventListener('input', updateLookupLinks);
    document.querySelectorAll('[data-vt-close="add"]').forEach(button => {
      button.addEventListener('click', () => closeModal('vt-add-modal'));
    });
    updateLookupLinks();
  }

  function openAddModal() {
    const modal = $('vt-add-modal');
    if (!modal) return;
    $('vt-add-form').reset();
    $('vt-lookup-status').textContent = '';
    updateLookupLinks();
    openModal('vt-add-modal');
    setTimeout(() => $('vt-word') && $('vt-word').focus(), 50);
  }

  function updateLookupLinks() {
    const word = ($('vt-word') && $('vt-word').value.trim()) || 'word';
    const slug = word.toLowerCase().replace(/\s+/g, '-');
    const encoded = encodeURIComponent(word);
    if ($('vt-link-oxford')) $('vt-link-oxford').href = 'https://www.oxfordlearnersdictionaries.com/definition/english/' + encodeURIComponent(slug);
    if ($('vt-link-cambridge')) $('vt-link-cambridge').href = 'https://dictionary.cambridge.org/dictionary/english/' + encodeURIComponent(slug);
    if ($('vt-link-tratu')) $('vt-link-tratu').href = 'https://tratu.soha.vn/dict/en_vn/' + encoded;
    if ($('vt-link-thesaurus')) $('vt-link-thesaurus').href = 'https://www.thesaurus.com/browse/' + encoded;
  }

  function fillIfEmpty(id, value) {
    const input = $(id);
    if (!input || !value) return false;
    if (input.value.trim()) return false;
    input.value = value;
    return true;
  }

  async function lookupWord() {
    const word = ($('vt-word') && $('vt-word').value.trim());
    if (!word) {
      notify('Type a word first.', 'error');
      return;
    }

    const status = $('vt-lookup-status');
    const button = $('vt-lookup');
    if (status) status.textContent = 'Looking up IPA, meaning and Vietnamese translation…';
    if (button) button.disabled = true;

    const dictUrl = 'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word);
    const transUrl = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(word) + '&langpair=en|vi';

    const [dictResult, transResult] = await Promise.allSettled([
      fetch(dictUrl).then(response => response.ok ? response.json() : null).catch(() => null),
      fetch(transUrl).then(response => response.ok ? response.json() : null).catch(() => null)
    ]);

    const filled = [];

    try {
      const dict = dictResult.status === 'fulfilled' ? dictResult.value : null;
      if (Array.isArray(dict) && dict[0]) {
        const entry = dict[0];
        const phonetic = entry.phonetic || (Array.isArray(entry.phonetics) ? (entry.phonetics.find(item => item && item.text) || {}).text : '');
        if (fillIfEmpty('vt-ipa', phonetic)) filled.push('IPA');

        const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];
        const firstMeaning = meanings[0] || {};
        const firstDefinition = (firstMeaning.definitions && firstMeaning.definitions[0]) || {};
        if (fillIfEmpty('vt-eng', firstDefinition.definition)) filled.push('English meaning');
        if (fillIfEmpty('vt-example', firstDefinition.example)) filled.push('example');

        const synonyms = [];
        meanings.forEach(meaning => {
          (meaning.synonyms || []).forEach(item => synonyms.push(item));
          (meaning.definitions || []).forEach(definition => {
            (definition.synonyms || []).forEach(item => synonyms.push(item));
          });
        });
        const uniqueSynonyms = Array.from(new Set(synonyms)).slice(0, 10);
        if (uniqueSynonyms.length && fillIfEmpty('vt-syn', uniqueSynonyms.join(', '))) filled.push('synonyms');
      }
    } catch (error) {
      console.warn('Dictionary lookup failed', error);
    }

    try {
      const trans = transResult.status === 'fulfilled' ? transResult.value : null;
      const text = trans && trans.responseData && trans.responseData.translatedText;
      if (text && normalizeWord(text) !== normalizeWord(word) && fillIfEmpty('vt-vi', text)) {
        filled.push('Vietnamese meaning');
      }
    } catch (error) {
      console.warn('Translation lookup failed', error);
    }

    if (status) {
      status.textContent = filled.length
        ? `Auto-filled ${filled.join(', ')}. Check the result against Oxford or Tra từ before saving.`
        : 'No automatic data found. Fill the fields manually or open one of the dictionary links.';
    }
    if (button) button.disabled = false;
  }

  function submitAddWord(event) {
    event.preventDefault();
    const word = $('vt-word').value.trim();
    const vi = $('vt-vi').value.trim();
    if (!word || !vi) {
      notify('Word and Vietnamese meaning are required.', 'error');
      return;
    }
    if (wordExists(word)) {
      notify(`"${word}" is already in this topic.`, 'error');
      return;
    }

    const item = {
      no: nextNo(),
      vocab: word,
      ipa: $('vt-ipa').value.trim(),
      viMean: vi,
      engMean: $('vt-eng').value.trim(),
      collocation: $('vt-colloc').value.trim(),
      example1: $('vt-example').value.trim(),
      example2: '',
      synonyms: $('vt-syn').value.trim(),
      antonyms: $('vt-anto').value.trim(),
      note: $('vt-note').value.trim()
    };

    getVocab().push(item);
    customItems.push(item);
    saveJSON(CUSTOM_KEY, customItems);

    closeModal('vt-add-modal');
    filterData();
    notify(`Added "${word}" to this topic.`);
  }

  // -----------------------------------------------------------------------
  // Excel / CSV import
  // -----------------------------------------------------------------------
  const HEADER_ALIASES = {
    vocab: ['vocab', 'vocabulary', 'word', 'phrase', 'wordphrase', 'term', 'tuvung', 'cumtu'],
    ipa: ['ipa', 'pronunciation', 'phonetic'],
    engMean: ['engmean', 'english', 'englishmeaning', 'meaning', 'definition', 'nghiatienganh'],
    viMean: ['vimean', 'vietnamese', 'vietnamesemeaning', 'meaningvi', 'nghia', 'nghiatiengviet', 'translation'],
    collocation: ['collocation', 'collocations', 'colloc', 'cumtu'],
    example1: ['example', 'example1', 'sentence', 'examplesentence', 'vidu'],
    example2: ['example2'],
    synonyms: ['synonyms', 'synonym', 'dongnghia'],
    antonyms: ['antonyms', 'antonym', 'traidnghia'],
    note: ['note', 'notes', 'ghichu']
  };

  const DEFAULT_ORDER = ['vocab', 'ipa', 'engMean', 'viMean', 'collocation', 'example1', 'synonyms', 'antonyms', 'note'];

  function normalizeHeader(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function buildHeaderMap(headerRow) {
    const normalized = headerRow.map(normalizeHeader);
    const map = {};
    let recognized = 0;

    Object.keys(HEADER_ALIASES).forEach(field => {
      const aliases = HEADER_ALIASES[field];
      const index = normalized.findIndex(value => aliases.includes(value));
      if (index !== -1) {
        map[field] = index;
        recognized += 1;
      }
    });

    if (!recognized || map.vocab == null) {
      const fallback = {};
      DEFAULT_ORDER.forEach((field, index) => { fallback[field] = index; });
      return { map: fallback, hasHeader: false };
    }
    return { map, hasHeader: true };
  }

  function loadScriptOnce(src) {
    if (window.XLSX) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-vt-xlsx]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.dataset.vtXlsx = '1';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function parseSpreadsheet(file) {
    if (/\.csv$/i.test(file.name)) {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      return lines.map(line => {
        // Small CSV parser that handles quoted commas.
        const cells = [];
        let current = '';
        let quoted = false;
        for (let index = 0; index < line.length; index += 1) {
          const character = line[index];
          if (character === '"') {
            if (quoted && line[index + 1] === '"') {
              current += '"';
              index += 1;
            } else {
              quoted = !quoted;
            }
          } else if (character === ',' && !quoted) {
            cells.push(current);
            current = '';
          } else {
            current += character;
          }
        }
        cells.push(current);
        return cells;
      });
    }

    await loadScriptOnce('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  }

  async function handleImport(file) {
    const status = $('vt-import-status');
    if (status) status.textContent = `Reading ${file.name}…`;
    try {
      const rows = await parseSpreadsheet(file);
      if (!rows.length) {
        if (status) status.textContent = 'The file is empty.';
        return;
      }

      const headerInfo = buildHeaderMap(rows[0] || []);
      const dataRows = headerInfo.hasHeader ? rows.slice(1) : rows;
      let added = 0;
      let skipped = 0;

      dataRows.forEach(row => {
        if (!row || !row.length) return;
        const get = field => {
          const index = headerInfo.map[field];
          return index == null || index < 0 ? '' : String(row[index] || '').trim();
        };

        const word = get('vocab');
        const vi = get('viMean');
        if (!word) return;
        if (wordExists(word)) {
          skipped += 1;
          return;
        }

        const item = {
          no: nextNo(),
          vocab: word,
          ipa: get('ipa'),
          viMean: vi,
          engMean: get('engMean'),
          collocation: get('collocation'),
          example1: get('example1'),
          example2: get('example2'),
          synonyms: get('synonyms'),
          antonyms: get('antonyms'),
          note: get('note')
        };

        getVocab().push(item);
        customItems.push(item);
        added += 1;
      });

      if (added) saveJSON(CUSTOM_KEY, customItems);
      if (status) {
        status.textContent = `Imported ${added} word${added === 1 ? '' : 's'}${skipped ? ` · skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}.`;
      }
      filterData();
      notify(added ? `Imported ${added} word${added === 1 ? '' : 's'}.` : 'No new words imported.', added ? 'success' : 'error');
    } catch (error) {
      console.error('Import failed', error);
      if (status) status.textContent = 'Could not read this file. Try .xlsx, .xls or .csv.';
      notify('Could not read the Excel file.', 'error');
    }
  }

  async function downloadTemplate() {
    const headers = ['Word / Phrase', 'IPA', 'English meaning', 'Vietnamese meaning', 'Collocation', 'Example sentence', 'Synonyms', 'Antonyms', 'Note'];
    const sample = ['mitigate', '/ˈmɪt.ɪ.ɡeɪt/', 'to make something less harmful', 'giảm thiểu', 'mitigate the impact of', 'Carbon taxes can mitigate the impact of industrial emissions.', 'reduce, lessen', 'intensify', ''];
    const status = $('vt-import-status');
    if (status) status.textContent = 'Preparing template…';

    try {
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
      const workbook = window.XLSX.utils.book_new();
      const sheet = window.XLSX.utils.aoa_to_sheet([headers, sample]);
      window.XLSX.utils.book_append_sheet(workbook, sheet, 'Vocabulary');
      window.XLSX.writeFile(workbook, 'vocabulary-template.xlsx');
      if (status) status.textContent = 'Template downloaded. Fill it in, then import it here.';
    } catch (error) {
      console.warn('Template download failed', error);
      if (status) status.textContent = 'Could not create the template. You can still import any .xlsx or .csv with the supported headers.';
    }
  }

  // -----------------------------------------------------------------------
  // Practice modal
  // -----------------------------------------------------------------------
  function injectPracticeModal() {
    if ($('vt-practice-modal')) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div id="vt-practice-modal" class="fixed inset-0 z-[70] hidden">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" data-vt-close="practice"></div>
        <div class="relative z-10 mx-auto mt-6 sm:mt-12 w-[calc(100%-1.5rem)] max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200">
          <div class="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-5 py-3.5 flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-slate-900">Practice learned words</h3>
              <p id="vt-p-subtitle" class="text-[11px] text-slate-500 mt-0.5">Only words you ticked as learned are included.</p>
            </div>
            <button type="button" data-vt-close="practice" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <div class="p-4 sm:p-5 space-y-4">
            <div id="vt-p-modes" class="flex flex-wrap gap-1.5">
              <button type="button" data-practice-mode="cloze" class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-emerald-200 bg-emerald-50 text-emerald-800">Fill the word</button>
              <button type="button" data-practice-mode="word-vi" class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">Word → Vietnamese</button>
              <button type="button" data-practice-mode="vi-word" class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">Vietnamese → Word</button>
              <button type="button" data-practice-mode="example" class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">Example recall</button>
            </div>

            <div class="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span id="vt-p-progress">Word 1 of 1</span>
              <span id="vt-p-score">0 correct · 0 to review</span>
            </div>
            <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div id="vt-p-bar" class="h-full bg-emerald-600 rounded-full transition-all duration-300" style="width: 0%"></div>
            </div>

            <div id="vt-p-card" class="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 min-h-[220px] flex flex-col justify-center"></div>
            <div id="vt-p-feedback" class="text-xs leading-relaxed"></div>

            <div class="flex flex-wrap items-center justify-end gap-2">
              <button type="button" id="vt-p-reveal" class="hidden px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">Show answer</button>
              <button type="button" id="vt-p-check" class="hidden px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">Check</button>
              <button type="button" id="vt-p-next" class="hidden px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">Next</button>
              <button type="button" id="vt-p-again" class="hidden px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold">Again</button>
              <button type="button" id="vt-p-got" class="hidden px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">Got it</button>
              <button type="button" id="vt-p-restart" class="hidden px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold">Practice again</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper.firstElementChild);

    document.querySelectorAll('[data-vt-close="practice"]').forEach(button => {
      button.addEventListener('click', () => closeModal('vt-practice-modal'));
    });
    document.querySelectorAll('[data-practice-mode]').forEach(button => {
      button.addEventListener('click', () => setPracticeMode(button.dataset.practiceMode));
    });
    $('vt-p-reveal').addEventListener('click', revealPractice);
    $('vt-p-check').addEventListener('click', checkPractice);
    $('vt-p-next').addEventListener('click', nextPractice);
    $('vt-p-again').addEventListener('click', () => markPractice(false));
    $('vt-p-got').addEventListener('click', () => markPractice(true));
    $('vt-p-restart').addEventListener('click', openPractice);

    $('vt-p-card').addEventListener('keydown', event => {
      if (event.key !== 'Enter' || !practiceState) return;
      event.preventDefault();
      if (practiceState.mode === 'word-vi' || practiceState.mode === 'example') {
        if (!practiceState.revealed) revealPractice();
        return;
      }
      if (practiceState.answered) nextPractice();
      else checkPractice();
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      closeModal('vt-add-modal');
      closeModal('vt-practice-modal');
    });
  }

  function openModal(id) {
    const modal = $(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    refreshIcons();
  }

  function closeModal(id) {
    const modal = $(id);
    if (!modal) return;
    modal.classList.add('hidden');
    const anyOpen = document.querySelector('#vt-add-modal:not(.hidden), #vt-practice-modal:not(.hidden)');
    if (!anyOpen) document.body.classList.remove('overflow-hidden');
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const random = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[random]] = [copy[random], copy[index]];
    }
    return copy;
  }

  function candidatesFor(item) {
    const parts = String(item.vocab || '').split(',').map(part => part.trim()).filter(Boolean);
    const candidates = [];
    parts.forEach(part => {
      candidates.push(part);
      const withoutParentheses = part.replace(/\([^)]*\)/g, '').trim();
      if (withoutParentheses) {
        candidates.push(withoutParentheses);
        withoutParentheses.split('/').forEach(alternative => {
          if (alternative.trim()) candidates.push(alternative.trim());
        });
      }
    });
    return Array.from(new Set(candidates.filter(Boolean)));
  }

  function englishExample(item) {
    const raw = String(item.example1 || item.example2 || '');
    return raw.split('\n')[0].trim();
  }

  function buildCloze(item) {
    const text = englishExample(item);
    if (!text) return null;
    const candidates = candidatesFor(item).sort((a, b) => b.length - a.length);
    const hasWord = candidate => new RegExp(`\\b${escapeRegExp(candidate)}\\b`, 'i').test(text);

    let target = candidates.find(hasWord);

    if (!target) {
      for (const candidate of candidates) {
        const firstWord = candidate.split(/\s+/)[0];
        if (firstWord && firstWord.length > 2 && hasWord(firstWord)) {
          target = firstWord;
          break;
        }
      }
    }
    if (!target) return null;

    const sentence = text.replace(new RegExp(`\\b${escapeRegExp(target)}\\b`, 'i'), '__________');
    return { sentence, answer: target };
  }

  function openPractice() {
    const pool = getVocab().filter(item => learned.has(Number(item.no)));
    if (!pool.length) {
      notify('Tick at least one word as learned first.', 'error');
      return;
    }
    practiceState = {
      items: shuffle(pool),
      idx: 0,
      mode: 'cloze',
      correct: 0,
      review: 0,
      revealed: false,
      answered: false,
      wasCorrect: false
    };
    openModal('vt-practice-modal');
    renderPractice();
  }

  function setPracticeMode(mode) {
    if (!practiceState) return;
    practiceState.mode = mode;
    practiceState.idx = 0;
    practiceState.correct = 0;
    practiceState.review = 0;
    practiceState.revealed = false;
    practiceState.answered = false;
    practiceState.wasCorrect = false;
    practiceState.items = shuffle(practiceState.items);
    renderPractice();
  }

  function currentPracticeItem() {
    return practiceState && practiceState.items[practiceState.idx];
  }

  function setPracticeButtons(visibleButtons) {
    ['vt-p-reveal', 'vt-p-check', 'vt-p-next', 'vt-p-again', 'vt-p-got', 'vt-p-restart'].forEach(id => {
      const button = $(id);
      if (button) button.classList.toggle('hidden', !visibleButtons.includes(id));
    });
  }

  function renderPractice() {
    if (!practiceState) return;
    const progress = $('vt-p-progress');
    const score = $('vt-p-score');
    const bar = $('vt-p-bar');
    const card = $('vt-p-card');
    const feedback = $('vt-p-feedback');
    if (!card) return;

    document.querySelectorAll('[data-practice-mode]').forEach(button => {
      const active = button.dataset.practiceMode === practiceState.mode;
      button.className = active
        ? 'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50';
    });

    const total = practiceState.items.length;
    if (progress) progress.textContent = practiceState.idx >= total ? 'Session complete' : `Word ${practiceState.idx + 1} of ${total}`;
    if (score) score.textContent = `${practiceState.correct} correct · ${practiceState.review} to review`;
    if (bar) bar.style.width = `${total ? Math.round((practiceState.idx / total) * 100) : 0}%`;
    if (feedback) feedback.innerHTML = '';

    if (practiceState.idx >= total) {
      card.innerHTML = `
        <div class="text-center space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <i data-lucide="party-popper" class="w-6 h-6"></i>
          </div>
          <h4 class="text-lg font-bold text-slate-900">Session complete</h4>
          <p class="text-xs text-slate-600">${practiceState.correct} correct · ${practiceState.review} to review</p>
          <p class="text-[11px] text-slate-400">Switch mode or practise the same learned set again.</p>
        </div>
      `;
      setPracticeButtons(['vt-p-restart']);
      refreshIcons();
      return;
    }

    const item = currentPracticeItem();
    practiceState.revealed = false;
    practiceState.answered = false;
    practiceState.wasCorrect = false;

    if (practiceState.mode === 'cloze') {
      const cloze = buildCloze(item);
      if (cloze) {
        card.innerHTML = `
          <p class="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2">Fill in the missing word</p>
          <p class="text-sm sm:text-base leading-relaxed text-slate-800">${escapeHtml(cloze.sentence).replace('__________', '<span class="inline-block min-w-[90px] border-b-2 border-emerald-500 align-baseline">&nbsp;</span>')}</p>
          <p class="text-[11px] text-slate-400 mt-3">Vietnamese hint: ${escapeHtml(item.viMean || '')}</p>
          <input id="vt-p-input" autocomplete="off" placeholder="Type the missing word or phrase" class="mt-3 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
        `;
        setPracticeButtons(['vt-p-check']);
      } else {
        renderTypedVietnamesePrompt(item);
      }
    } else if (practiceState.mode === 'word-vi') {
      card.innerHTML = `
        <p class="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2">Word → Vietnamese</p>
        <h4 class="text-2xl sm:text-3xl font-bold text-slate-900">${escapeHtml((item.vocab || '').split(',')[0].trim())}</h4>
        <p class="text-xs font-mono text-slate-400 mt-1">${escapeHtml(item.ipa || '')}</p>
        <div id="vt-p-answer" class="hidden mt-4 space-y-2">
          <p class="text-sm font-semibold text-emerald-800">${escapeHtml(item.viMean || '')}</p>
          <p class="text-xs text-slate-600">${escapeHtml(item.engMean || '')}</p>
          <p class="text-[11px] text-slate-500 italic">${escapeHtml(englishExample(item))}</p>
        </div>
      `;
      setPracticeButtons(['vt-p-reveal']);
    } else if (practiceState.mode === 'vi-word') {
      renderTypedVietnamesePrompt(item);
    } else {
      card.innerHTML = `
        <p class="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2">Example recall</p>
        <h4 class="text-xl sm:text-2xl font-bold text-slate-900">${escapeHtml((item.vocab || '').split(',')[0].trim())}</h4>
        <p class="text-xs text-slate-600 mt-1">${escapeHtml(item.viMean || '')}</p>
        <p class="text-[11px] text-slate-400 mt-3">Try to say or write the example sentence before revealing it.</p>
        <div id="vt-p-answer" class="hidden mt-3 rounded-xl bg-white border border-slate-200 p-3">
          <p class="text-xs text-slate-800">${escapeHtml(englishExample(item) || 'No example sentence saved yet.')}</p>
          <p class="text-[11px] text-slate-500 mt-1">${escapeHtml(String(item.example1 || '').split('\n')[1] || '')}</p>
        </div>
      `;
      setPracticeButtons(['vt-p-reveal']);
    }

    refreshIcons();
  }

  function renderTypedVietnamesePrompt(item) {
    const card = $('vt-p-card');
    card.innerHTML = `
      <p class="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2">Vietnamese → Word</p>
      <p class="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">${escapeHtml(item.viMean || '')}</p>
      <p class="text-[11px] text-slate-400 mt-2">Type the English word or phrase.</p>
      <input id="vt-p-input" autocomplete="off" placeholder="Type the English word or phrase" class="mt-3 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
    `;
    setPracticeButtons(['vt-p-check']);
  }

  function answerIsCorrect(input, answers) {
    const normalized = normalizeAnswer(input);
    if (!normalized) return false;
    const stripped = stripArticles(normalized);
    return answers.some(answer => {
      const target = normalizeAnswer(answer);
      return normalized === target || stripped === stripArticles(target);
    });
  }

  function practiceAnswer() {
    const item = currentPracticeItem();
    if (!item) return { answers: [], display: '' };
    if (practiceState.mode === 'cloze') {
      const cloze = buildCloze(item);
      if (cloze) return { answers: [cloze.answer], display: cloze.answer };
    }
    const candidates = candidatesFor(item);
    return { answers: candidates, display: candidates[0] || item.vocab || '' };
  }

  function checkPractice() {
    if (!practiceState || practiceState.answered) return;
    const input = $('vt-p-input');
    if (!input) return;
    const { answers, display } = practiceAnswer();
    const correct = answerIsCorrect(input.value, answers);
    practiceState.answered = true;
    practiceState.wasCorrect = correct;
    if (correct) practiceState.correct += 1; else practiceState.review += 1;

    const feedback = $('vt-p-feedback');
    if (feedback) {
      feedback.innerHTML = correct
        ? `<span class="text-emerald-700 font-semibold">Correct.</span> ${escapeHtml(display)}`
        : `<span class="text-rose-600 font-semibold">Not quite.</span> Answer: <strong>${escapeHtml(display)}</strong>`;
    }
    input.disabled = true;
    setPracticeButtons(['vt-p-next']);
    const score = $('vt-p-score');
    if (score) score.textContent = `${practiceState.correct} correct · ${practiceState.review} to review`;
  }

  function revealPractice() {
    if (!practiceState) return;
    practiceState.revealed = true;
    const answer = $('vt-p-answer');
    if (answer) answer.classList.remove('hidden');
    setPracticeButtons(['vt-p-again', 'vt-p-got']);
  }

  function markPractice(correct) {
    if (!practiceState) return;
    if (correct) practiceState.correct += 1; else practiceState.review += 1;
    advancePractice();
  }

  function nextPractice() {
    advancePractice();
  }

  function advancePractice() {
    if (!practiceState) return;
    practiceState.idx += 1;
    practiceState.revealed = false;
    practiceState.answered = false;
    practiceState.wasCorrect = false;
    renderPractice();
  }

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  function init() {
    mergeCustomWords();
    injectToolbar();
    injectAddModal();
    injectPracticeModal();
    bindLearnedEvents();

    // Wrap the lesson page render functions so learned controls survive every
    // search, filter and note update.
    if (typeof renderUI === 'function') {
      const baseRenderUI = renderUI;
      renderUI = function () {
        baseRenderUI();
        decorateRows();
        updateToolbar();
      };
    }

    if (typeof filterData === 'function') {
      const baseFilterData = filterData;
      filterData = function () {
        baseFilterData();
        if (filterMode !== 'all') {
          filteredItems = filteredItems.filter(item => (
            filterMode === 'learned' ? learned.has(Number(item.no)) : !learned.has(Number(item.no))
          ));
          renderUI();
        }
      };
    }

    updateToolbar();
    filterData();
    refreshIcons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
