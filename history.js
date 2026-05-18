<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="history.css">
  <style>
    a,
    button,
    input,
    select,
    h1,
    h2,
    h3,
    h4,
    h5,
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        border: none;
        text-decoration: none;
        background: none;
        -webkit-font-smoothing: antialiased;
    }

    menu, ol, ul {
        list-style-type: none;
        margin: 0;
        padding: 0;
    }
  </style>
  <title>History — Recall AI</title>
</head>
<body>

  <div class="history-recall-ai">

    <!-- ── MAIN CONTENT CANVAS ── -->
    <div class="main-content-canvas">

      <!-- Background orbs -->
      <div class="abstract-background-orbs"></div>
      <div class="overlay-blur"></div>

      <!-- ── HEADER ── -->
      <div class="header-top-app-bar-authority-shared-components-json">
        <div class="container24">
          <div class="input">
            <svg class="search-icon-abs" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <div class="container25">
              <input
                class="search-input-el"
                type="text"
                id="searchInput"
                placeholder="Search past queries, topics, or insights..."
              />
            </div>
          </div>
        </div>
        <div class="container27">
          <div class="button-css-transform">
            <button class="button3" id="notifBtn" aria-label="Notifications">
              <svg width="18" height="18" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <div class="background-border5"></div>
            </button>
          </div>
          <div class="vertical-divider3"></div>
          <div class="container29">
            <div class="paragraph2">
              <div class="ronik-thapa" id="userName">Ronik Thapa</div>
              <div class="pro-account">Pro Account</div>
            </div>
            <img class="user-avatar" src="user-avatar0.png" alt="User Avatar" />
          </div>
        </div>
      </div>

      <!-- ── SECTION CONTENT ── -->
      <div class="section-content-canvas">

        <!-- Page heading + filter -->
        <div class="container">
          <div class="container2">
            <div class="container3"></div>
            <div class="heading-2">
              <div class="text">History</div>
            </div>
          </div>
          <div class="container4">
            <button class="button" id="filterBtn">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              <div class="text2">Filter</div>
            </button>
          </div>
        </div>

        <!-- ── TIMELINE ── -->
        <div class="timeline-structure">

          <!-- TODAY -->
          <div class="section-today">
            <div class="container6">
              <div class="container7">
                <div class="text3">Today</div>
              </div>
              <div class="horizontal-divider"></div>
            </div>
            <div class="container8">

              <!-- History Item 1 -->
              <div class="history-item" data-id="1">
                <div class="container9">
                  <div class="background-border">
                    <svg width="18" height="18" fill="none" stroke="rgba(99,102,241,0.8)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                    </svg>
                  </div>
                  <div class="margin">
                    <div class="text4">09:42</div>
                  </div>
                </div>
                <div class="vertical-divider"></div>
                <div class="overlay-border">
                  <div class="container11">
                    <div class="heading-3">
                      <div class="text5">
                        Analyze the neural efficiency of the MindTrace v1.0
                        architecture compared to standard transformer models.
                      </div>
                    </div>
                    <button class="item-action-btn" aria-label="More options">
                      <svg width="16" height="4" fill="#40485d" viewBox="0 0 16 4">
                        <circle cx="2" cy="2" r="2"/><circle cx="8" cy="2" r="2"/><circle cx="14" cy="2" r="2"/>
                      </svg>
                    </button>
                  </div>
                  <div class="container6">
                    <div class="overlay-border2">
                      <svg width="10" height="10" fill="none" stroke="rgba(99,102,241,0.8)" stroke-width="2" viewBox="0 0 24 24">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                      </svg>
                      <div class="text6">LLM-ULTRA</div>
                    </div>
                    <div class="overlay">
                      <svg width="10" height="10" fill="none" stroke="#94a3b8" stroke-width="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <div class="text7">Technical Analysis</div>
                    </div>
                    <div class="margin2">
                      <div class="container7">
                        <div class="text8">2,450 tokens • 1.2s latency</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- History Item 2 -->
              <div class="history-item" data-id="2">
                <div class="container9">
                  <div class="background-border2">
                    <svg width="18" height="18" fill="none" stroke="rgba(6,182,212,0.8)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                  <div class="margin">
                    <div class="text4">08:15</div>
                  </div>
                </div>
                <div class="overlay-border">
                  <div class="paragraph">
                    <div class="heading-3-generate-an-editorial-visual-concept-for-a-cognitive-data-visualization-dashboard">
                      Generate an editorial visual concept for a cognitive data
                      visualization dashboard.
                    </div>
                    <button class="item-action-btn" aria-label="More options">
                      <svg width="16" height="4" fill="#40485d" viewBox="0 0 16 4">
                        <circle cx="2" cy="2" r="2"/><circle cx="8" cy="2" r="2"/><circle cx="14" cy="2" r="2"/>
                      </svg>
                    </button>
                  </div>
                  <div class="container6">
                    <div class="overlay-border3">
                      <svg width="10" height="10" fill="none" stroke="rgba(6,182,212,0.8)" stroke-width="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <div class="text9">CREATIVE-GEN</div>
                    </div>
                    <div class="overlay">
                      <svg width="10" height="10" fill="none" stroke="#94a3b8" stroke-width="2" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <div class="text7">Visual Design</div>
                    </div>
                    <div class="margin3">
                      <div class="container7">
                        <div class="text8">Rendered Output • 4.5s latency</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- YESTERDAY -->
          <div class="section-yesterday">
            <div class="container6">
              <div class="container7">
                <div class="text10">Yesterday</div>
              </div>
              <div class="horizontal-divider"></div>
            </div>

            <!-- History Item 3 -->
            <div class="history-item2" data-id="3">
              <div class="container9">
                <div class="background-border3">
                  <svg width="18" height="18" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                  </svg>
                </div>
                <div class="margin">
                  <div class="text4">14:22</div>
                </div>
              </div>
              <div class="vertical-divider2"></div>
              <div class="overlay-border">
                <div class="paragraph">
                  <div class="heading-3-debug-the-recursive-function-for-the-distributed-vector-database-indexing-system">
                    Debug the recursive function for the distributed vector
                    database indexing system.
                  </div>
                  <button class="item-action-btn" aria-label="More options">
                    <svg width="16" height="4" fill="#40485d" viewBox="0 0 16 4">
                      <circle cx="2" cy="2" r="2"/><circle cx="8" cy="2" r="2"/><circle cx="14" cy="2" r="2"/>
                    </svg>
                  </button>
                </div>
                <div class="container18">
                  <div class="overlay">
                    <svg width="10" height="10" fill="none" stroke="#94a3b8" stroke-width="2" viewBox="0 0 24 24">
                      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                    </svg>
                    <div class="text7">CODE-ASSIST</div>
                  </div>
                  <div class="margin4">
                    <div class="container7">
                      <div class="text8">4,120 tokens • 0.8s latency</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- LAST WEEK -->
          <div class="section-last-week">
            <div class="container6">
              <div class="container7">
                <div class="text11">Last Week</div>
              </div>
              <div class="horizontal-divider"></div>
            </div>

            <div class="compact-bento-grid-for-older-history">

              <div class="overlay-border4" data-id="4">
                <div class="paragraph">
                  <div class="text12">MONDAY, OCT 23</div>
                  <svg class="bento-icon" width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <circle cx="4.5" cy="4.5" r="4.5" fill="rgba(129,140,248,0.3)"/>
                  </svg>
                </div>
                <div class="heading-4">
                  <div class="recent-trends-in-the-field-of-robotics-in-todays-world">
                    Recent trends in the field of robotics in todays world.
                  </div>
                </div>
              </div>

              <div class="overlay-border5" data-id="5">
                <div class="paragraph">
                  <div class="text12">SUNDAY, OCT 22</div>
                  <svg class="bento-icon" width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <circle cx="4.5" cy="4.5" r="4.5" fill="rgba(129,140,248,0.3)"/>
                  </svg>
                </div>
                <div class="heading-4">
                  <div class="what-is-an-ai">what is an AI?</div>
                </div>
              </div>

              <div class="overlay-border6" data-id="6">
                <div class="paragraph">
                  <div class="text12">SATURDAY, OCT 21</div>
                  <svg class="bento-icon" width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <circle cx="4.5" cy="4.5" r="4.5" fill="rgba(129,140,248,0.3)"/>
                  </svg>
                </div>
                <div class="heading-4">
                  <div class="convert-this-picture-into-smiley-face">
                    Convert this picture into smiley face.
                  </div>
                </div>
              </div>

              <div class="overlay-border7" data-id="7">
                <div class="paragraph">
                  <div class="text12">FRIDAY, OCT 20</div>
                  <svg class="bento-icon" width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <circle cx="4.5" cy="4.5" r="4.5" fill="rgba(129,140,248,0.3)"/>
                  </svg>
                </div>
                <div class="heading-4">
                  <div class="give-me-a-python-code-for-factorial-of-7">
                    Give me a Python Code for factorial of 7.
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>

        <!-- Load more -->
        <div class="load-more-interaction">
          <button class="button2" id="loadMoreBtn">
            <div class="older-traces">OLDER TRACES</div>
            <div class="background-border4">
              <svg width="16" height="16" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
              </svg>
            </div>
          </button>
        </div>

      </div>

      <!-- ── FOOTER ── -->
      <div class="aesthetic-footer-overlay">
        <div class="container21">
          <div class="container22">
            <div class="overlay2">
              <div class="background"></div>
            </div>
            <div class="container7">
              <div class="recall-ai-cloud-sync-active">Recall AI Cloud Sync Active</div>
            </div>
          </div>
          <div class="container23"></div>
        </div>
      </div>

    </div>

    <!-- ── SIDEBAR ── -->
    <aside class="aside-side-nav-bar-authority-shared-components-json">
      <div class="group-1">
        <img class="background2" src="background1.png" alt="Recall AI Logo" />
        <div class="recall-ai">Recall AI</div>
      </div>

      <nav class="nav">
        <div class="link-css-transform">
          <a class="link" href="../dashboard-page/dashboard.html">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            <div class="container7">
              <div class="text13">DASHBOARD</div>
            </div>
          </a>
        </div>
        <div class="link-active-state-history-css-transform">
          <a class="link-active-state-history" href="history.html">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <polyline points="12 8 12 12 14 14"/>
              <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>
            </svg>
            <div class="container7">
              <div class="text14">HISTORY</div>
            </div>
          </a>
        </div>
        <div class="link-css-transform">
          <a class="link" href="../setting-page/setting.html">

            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <div class="container7">
              <div class="text13">SETTINGS</div>
            </div>
          </a>
        </div>
      </nav>

      <div class="margin5"></div>
    </aside>

    <!-- ── FLOATING NEW QUERY BUTTON ── -->
    <button class="floating-ui-element-active-focus" id="newQueryBtn">
      <div class="floating-ui-element-active-focus-shadow"></div>
      <div class="background3">
        <svg width="16" height="16" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      <div class="container7">
        <div class="text15">NEW QUERY</div>
      </div>
    </button>

    <!-- Toast -->
    <div class="toast" id="toast" role="alert">
      <span class="toast-icon" id="toastIcon">✓</span>
      <span class="toast-msg" id="toastMsg"></span>
    </div>

  </div>

  <script src="history.js"></script>
</body>
</html>