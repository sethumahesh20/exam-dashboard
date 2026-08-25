'use strict';

/* ============================================
   STATE
   ============================================ */

const state = {
  exams: [],
  filtered: [],
  searchTerm: '',
  category: 'all',
  status: 'all',
  timerIntervalId: null,
};


/* ============================================
   DOM ELEMENTS
   ============================================ */

const els = {
  examContainer: document.getElementById('examContainer'),
  emptyState: document.getElementById('emptyState'),

  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  statusFilter: document.getElementById('statusFilter'),

  examCountValue: document.getElementById('examCountValue'),

  statTotal: document.getElementById('statTotal'),
  statCompleted: document.getElementById('statCompleted'),
  statUpcoming: document.getElementById('statUpcoming'),
  statPending: document.getElementById('statPending'),

  completionBarFill: document.getElementById('completionBarFill'),
  completionPercent: document.getElementById('completionPercent'),
  realityInsight: document.getElementById('realityInsight'),

  modal: document.getElementById('resultModal'),
  modalImage: document.getElementById('modalImage'),
  modalExamName: document.getElementById('modalExamName'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
};


/* ============================================
   DATA LOADING
   ============================================ */

async function loadExams() {
  try {
    const res = await fetch('exam.json', {
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error(
        'Failed to fetch exam.json: ' + res.status
      );
    }

    const data = await res.json();

    state.exams = Array.isArray(data)
      ? data.map(normalizeExam)
      : [];

  } catch (err) {
    console.error('Could not load exam.json', err);

    state.exams = [];
  }

  populateCategoryFilter();
  applyFilters();
  updateAnalytics();
  startTimerLoop();
}


/* ============================================
   NORMALIZE EXAM DATA
   ============================================ */

function normalizeExam(raw, index) {
  return {
    id:
      raw.id ??
      `exam-${index}-${(raw.name || 'unnamed')
        .replace(/\s+/g, '-')}`,

    name: raw.name || 'Untitled Exam',

    category: raw.category || 'Other',

    code: raw.code || '',

    date: raw.date || '',

    examDateTime: raw.examDateTime || null,

    hallTicket: raw.hallTicket || null,

    result: raw.result || null,

    resultStatus: normalizeResultStatus(
      raw.resultStatus
    ),

    completed: Boolean(raw.completed)
  };
}


/* ============================================
   RESULT STATUS
   ============================================ */

function normalizeResultStatus(value) {
  const allowed = [
    'PASS',
    'FAIL',
    'PENDING',
    'RELEASED',
    'NOT APPEARED'
  ];

  const upper =
    (value || '')
      .toString()
      .trim()
      .toUpperCase();

  return allowed.includes(upper)
    ? upper
    : 'PENDING';
}


/* ============================================
   FILTER / SEARCH
   ============================================ */

function populateCategoryFilter() {
  const categories = [
    ...new Set(
      state.exams
        .map((e) => e.category)
        .filter(Boolean)
    )
  ].sort();

  els.categoryFilter.innerHTML =
    '<option value="all">All Categories</option>' +
    categories
      .map(
        (c) =>
          `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
      )
      .join('');
}


function getExamStatus(exam) {
  /*
    Returns:
    - upcoming
    - completed
  */

  if (exam.completed) {
    return 'completed';
  }

  if (exam.examDateTime) {
    const time =
      new Date(exam.examDateTime).getTime();

    if (
      !Number.isNaN(time) &&
      time <= Date.now()
    ) {
      return 'completed';
    }
  }

  return 'upcoming';
}


function getResultBucket(exam) {
  /*
    Returns:
    - result-available
    - result-pending
  */

  return exam.result
    ? 'result-available'
    : 'result-pending';
}


function searchExams(exams, term) {
  const q =
    term
      .trim()
      .toLowerCase();

  if (!q) {
    return exams;
  }

  return exams.filter((e) =>
    e.name
      .toLowerCase()
      .includes(q) ||

    e.category
      .toLowerCase()
      .includes(q) ||

    e.code
      .toLowerCase()
      .includes(q)
  );
}


function filterExams(
  exams,
  category,
  status
) {
  return exams.filter((e) => {

    const categoryMatch =
      category === 'all' ||
      e.category === category;

    let statusMatch = true;

    if (status === 'upcoming') {
      statusMatch =
        getExamStatus(e) === 'upcoming';

    } else if (status === 'completed') {
      statusMatch =
        getExamStatus(e) === 'completed';

    } else if (status === 'result-pending') {
      statusMatch =
        getResultBucket(e) === 'result-pending';

    } else if (status === 'result-available') {
      statusMatch =
        getResultBucket(e) === 'result-available';
    }

    return categoryMatch && statusMatch;
  });
}


function applyFilters() {
  let result = state.exams;

  result =
    searchExams(
      result,
      state.searchTerm
    );

  result =
    filterExams(
      result,
      state.category,
      state.status
    );

  state.filtered = result;

  renderExams();
}


/* ============================================
   RENDERING
   ============================================ */

function renderExams() {
  const exams = state.filtered;

  els.examCountValue.textContent =
    state.exams.length;

  if (exams.length === 0) {
    els.examContainer.innerHTML = '';

    els.emptyState.hidden = false;

    return;
  }

  els.emptyState.hidden = true;

  els.examContainer.innerHTML =
    exams
      .map(renderExamCard)
      .join('');
}


/* ============================================
   EXAM CARD
   ============================================ */

function renderExamCard(exam) {

  const examStatus =
    getExamStatus(exam);


  const statusTagHtml =
    examStatus === 'completed'

      ? `
        <span class="status-tag status-tag--completed">
          ✓ Completed
        </span>
      `

      : `
        <span class="status-tag status-tag--upcoming">
          ◷ Upcoming
        </span>
      `;


  const hallTicketHtml =
    exam.hallTicket

      ? `
        <button
          class="hall-ticket-btn"
          data-hall-ticket="${escapeHtml(exam.hallTicket)}"
        >
          🎫 View Hall Ticket
        </button>
      `

      : `
        <button
          class="hall-ticket-btn"
          disabled
        >
          Hall Ticket Unavailable
        </button>
      `;


  const timerHtml =
    renderTimerBlock(exam);


  const resultHtml =
    renderResultBlock(exam);


  return `
    <article
      class="exam-card"
      data-exam-id="${escapeHtml(exam.id)}"
    >

      <div class="card-top">

        <span class="card-category">
          ${escapeHtml(exam.category)}
        </span>

        <span class="card-code">
          ${escapeHtml(exam.code)}
        </span>

      </div>


      <div>

        <h3 class="card-name">
          ${escapeHtml(exam.name)}
        </h3>

        <p class="card-date">
          ${escapeHtml(exam.date)}
        </p>

      </div>


      ${statusTagHtml}


      ${hallTicketHtml}


      ${timerHtml}


      ${resultHtml}


    </article>
  `;
}


/* ============================================
   PANIC TIMER BLOCK
   ============================================ */

function renderTimerBlock(exam) {

  /*
    No exam date:
    Don't show timer at all.
  */

  if (!exam.examDateTime) {
    return '';
  }


  const target =
    new Date(
      exam.examDateTime
    ).getTime();


  /*
    Invalid date:
    Don't show timer.
  */

  if (Number.isNaN(target)) {
    return '';
  }


  /*
    Past exam:
    Don't show timer.
  */

  if (target <= Date.now()) {
    return '';
  }


  return `
    <div
      class="timer-block"
      data-timer-block
      data-exam-datetime="${escapeHtml(
        exam.examDateTime
      )}"
    >

      <p
        class="timer-label"
        data-timer-label
      >
        ⏱ Exam Countdown
      </p>


      <p
        class="timer-value"
        data-timer-value
      >
        Calculating…
      </p>

    </div>
  `;
}


/* ============================================
   RESULT BLOCK
   ============================================ */

function renderResultBlock(exam) {

  const tag =
    renderResultTag(
      exam.resultStatus
    );


  /*
    Result file exists
  */

  if (exam.result) {

    return `
      <div class="result-block">

        <div class="result-label-col">

          <span class="result-heading">
            Result
          </span>

          <button
            class="view-result-btn"
            data-view-result="${escapeHtml(
              exam.result
            )}"
            data-exam-name="${escapeHtml(
              exam.name
            )}"
          >
            View Result
          </button>

        </div>

        ${tag}

      </div>
    `;
  }


  /*
    Result file doesn't exist
  */

  return `
    <div class="result-block">

      <div class="result-label-col">

        <span class="result-heading">
          Result
        </span>

        <span class="result-pending-text">
          Result Pending
        </span>

      </div>

      ${tag}

    </div>
  `;
}


/* ============================================
   RESULT STATUS TAG
   ============================================ */

function renderResultTag(resultStatus) {

  const map = {

    PASS: {
      cls: 'result-tag--pass',
      label: 'PASS'
    },

    FAIL: {
      cls: 'result-tag--fail',
      label: 'FAIL'
    },

    PENDING: {
      cls: 'result-tag--pending',
      label: 'PENDING'
    },

    RELEASED: {
      cls: 'result-tag--released',
      label: 'RELEASED'
    },

    'NOT APPEARED': {
      cls: 'result-tag--not-appeared',
      label: 'NOT APPEARED'
    }

  };


  const entry =
    map[
      getResultStatus(
        resultStatus
      )
    ] || map.PENDING;


  return `
    <span
      class="result-tag ${entry.cls}"
    >
      ${entry.label}
    </span>
  `;
}


/* ============================================
   GET RESULT STATUS
   ============================================ */

function getResultStatus(value) {
  return normalizeResultStatus(value);
}


/* ============================================
   PANIC TIMER LOOP
   ============================================ */

function startTimerLoop() {

  if (state.timerIntervalId) {
    clearInterval(
      state.timerIntervalId
    );
  }

  updateTimers();

  state.timerIntervalId =
    setInterval(
      updateTimers,
      1000
    );
}


function updateTimers() {

  const blocks =
    document.querySelectorAll(
      '[data-timer-block]'
    );


  blocks.forEach((block) => {

    const iso =
      block.getAttribute(
        'data-exam-datetime'
      );


    /*
      No date
    */

    if (!iso) {
      block.remove();
      return;
    }


    const target =
      new Date(iso).getTime();


    /*
      Invalid date
    */

    if (Number.isNaN(target)) {
      block.remove();
      return;
    }


    const diff =
      target - Date.now();


    /*
      Exam time passed:
      remove timer completely.
    */

    if (diff <= 0) {
      block.remove();
      return;
    }


    const valueEl =
      block.querySelector(
        '[data-timer-value]'
      );


    const labelEl =
      block.querySelector(
        '[data-timer-label]'
      );


    if (!valueEl || !labelEl) {
      return;
    }


    block.classList.remove(
      'timer-block--warning',
      'timer-block--panic',
      'timer-block--passed'
    );


    const totalSeconds =
      Math.floor(
        diff / 1000
      );


    const days =
      Math.floor(
        totalSeconds / 86400
      );


    const hours =
      Math.floor(
        (totalSeconds % 86400) /
        3600
      );


    const minutes =
      Math.floor(
        (totalSeconds % 3600) /
        60
      );


    const seconds =
      totalSeconds % 60;


    const formatted =
      `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;


    /*
      Less than 24 hours
      PANIC MODE
    */

    if (
      diff <
      24 * 60 * 60 * 1000
    ) {

      block.classList.add(
        'timer-block--panic'
      );


      labelEl.textContent =
        '🚨 Panic Mode';


      valueEl.textContent =
        `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

      return;
    }


    /*
      Less than 7 days
      WARNING
    */

    if (
      diff <
      7 * 24 * 60 * 60 * 1000
    ) {

      block.classList.add(
        'timer-block--warning'
      );


      labelEl.textContent =
        '⏱ Exam Countdown';


      valueEl.textContent =
        formatted;

      return;
    }


    /*
      More than 7 days
    */

    labelEl.textContent =
      '⏱ Exam Countdown';


    valueEl.textContent =
      formatted;
  });
}


/* ============================================
   PAD NUMBERS
   ============================================ */

function pad(n) {
  return String(n)
    .padStart(2, '0');
}


/* ============================================
   ANALYTICS — REALITY CHECK
   ============================================ */

function updateAnalytics() {

  const total =
    state.exams.length;


  const completed =
    state.exams.filter(
      (e) =>
        getExamStatus(e) ===
        'completed'
    ).length;


  const upcoming =
    total - completed;


  const resultsPending =
    state.exams.filter(
      (e) =>
        getResultBucket(e) ===
        'result-pending'
    ).length;


  const percent =
    total > 0
      ? Math.round(
          (completed / total) * 100
        )
      : 0;


  els.statTotal.textContent =
    total;


  els.statCompleted.textContent =
    completed;


  els.statUpcoming.textContent =
    upcoming;


  els.statPending.textContent =
    resultsPending;


  els.completionBarFill.style.width =
    `${percent}%`;


  els.completionPercent.textContent =
    `${percent}%`;


  els.realityInsight.textContent =
    buildInsight({
      total,
      completed,
      upcoming,
      resultsPending,
      percent
    });
}


/* ============================================
   REALITY INSIGHT
   ============================================ */

function buildInsight({
  total,
  completed,
  upcoming,
  resultsPending,
  percent
}) {

  if (total === 0) {

    return (
      'No exams logged yet. Add one to exam.json to get started.'
    );
  }


  if (completed === total) {

    return (
      'All exams are done. Now the results decide the damage.'
    );
  }


  if (
    resultsPending >=
      Math.ceil(total / 2) &&
    completed > 0
  ) {

    return (
      'The exams are over. Now comes the waiting game.'
    );
  }


  if (
    upcoming >=
    Math.ceil(total / 2)
  ) {

    return (
      'More exams ahead. Preparation mode ON.'
    );
  }


  if (percent >= 75) {

    return (
      'Almost through the list. Keep the momentum going.'
    );
  }


  return (
    `${completed} down, ${upcoming} to go. Steady progress.`
  );
}


/* ============================================
   RESULT MODAL
   ============================================ */

function openResultModal(
  imageSrc,
  examName
) {

  els.modalImage.src =
    imageSrc;


  els.modalImage.alt =
    `${examName} result`;


  els.modalExamName.textContent =
    examName;


  els.modal.hidden =
    false;


  document.body.style.overflow =
    'hidden';
}


function closeResultModal() {

  els.modal.hidden =
    true;


  els.modalImage.src =
    '';


  document.body.style.overflow =
    '';
}


/* ============================================
   EVENT WIRING
   ============================================ */

function initEvents() {

  /*
    Search
  */

  els.searchInput.addEventListener(
    'input',
    (e) => {

      state.searchTerm =
        e.target.value;

      applyFilters();
    }
  );


  /*
    Category filter
  */

  els.categoryFilter.addEventListener(
    'change',
    (e) => {

      state.category =
        e.target.value;

      applyFilters();
    }
  );


  /*
    Status filter
  */

  els.statusFilter.addEventListener(
    'change',
    (e) => {

      state.status =
        e.target.value;

      applyFilters();
    }
  );


  /*
    Event delegation
    for dynamically rendered cards
  */

  els.examContainer.addEventListener(
    'click',
    (e) => {

      /*
        View Result
      */

      const viewResultBtn =
        e.target.closest(
          '[data-view-result]'
        );


      if (viewResultBtn) {

        openResultModal(
          viewResultBtn.getAttribute(
            'data-view-result'
          ),

          viewResultBtn.getAttribute(
            'data-exam-name'
          )
        );

        return;
      }


      /*
        View Hall Ticket
      */

      const hallTicketBtn =
        e.target.closest(
          '[data-hall-ticket]'
        );


      if (hallTicketBtn) {

        window.open(
          hallTicketBtn.getAttribute(
            'data-hall-ticket'
          ),
          '_blank',
          'noopener'
        );
      }

    }
  );


  /*
    Modal close button
  */

  els.modalCloseBtn.addEventListener(
    'click',
    closeResultModal
  );


  /*
    Close modal by clicking background
  */

  els.modal.addEventListener(
    'click',
    (e) => {

      if (e.target === els.modal) {
        closeResultModal();
      }

    }
  );


  /*
    Escape key
  */

  document.addEventListener(
    'keydown',
    (e) => {

      if (
        e.key === 'Escape' &&
        !els.modal.hidden
      ) {

        closeResultModal();
      }

    }
  );
}


/* ============================================
   UTIL
   ============================================ */

function escapeHtml(str) {

  return String(str)

    .replace(
      /&/g,
      '&amp;'
    )

    .replace(
      /</g,
      '&lt;'
    )

    .replace(
      />/g,
      '&gt;'
    )

    .replace(
      /"/g,
      '&quot;'
    )

    .replace(
      /'/g,
      '&#39;'
    );
}


/* ============================================
   INIT
   ============================================ */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    initEvents();

    loadExams();

  }
);