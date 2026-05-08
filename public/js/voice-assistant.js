/**
 * Labour Connect - Smart Multilingual Voice Assistant
 * Supports English, Hindi, and Kannada
 */

(function () {
  'use strict';

  // ─── Translations ──────────────────────────────────────────────────────────
  const TRANSLATIONS = {
    'en-IN': {
      ready: 'Ready to listen',
      listening: 'Listening…',
      speaking: 'Speaking…',
      error: 'Error',
      not_supported: 'Not supported – use Chrome or Edge',
      no_speech: 'I couldn\'t hear anything. Please try again.',
      mic_error: 'Microphone error: ',
      unknown: (text) => `Sorry, I didn't understand "${text}". Try saying "help".`,
      navigating: 'Navigating…',
      help_resp: 'I can navigate pages, find jobs, open marketplace, and more. Say "help" for details.',
      help_title: '💡 Voice Commands',
      start_btn: 'Start Listening',
      stop_btn: 'Stop',
      show_cmds: 'Show available commands ▾',
      hide_cmds: 'Hide commands ▴',
      you_said: 'You said:'
    },
    'hi-IN': {
      ready: 'सुनने के लिए तैयार',
      listening: 'सुन रहा हूँ…',
      speaking: 'बोल रहा हूँ…',
      error: 'त्रुटि',
      not_supported: 'समर्थित नहीं है - क्रोम या एज का उपयोग करें',
      no_speech: 'मुझे कुछ सुनाई नहीं दिया। कृपया पुनः प्रयास करें।',
      mic_error: 'माइक्रोफ़ोन त्रुटि: ',
      unknown: (text) => `क्षमा करें, मुझे "${text}" समझ नहीं आया। "मदद" बोलें।`,
      navigating: 'नेविगेट कर रहा हूँ…',
      help_resp: 'मैं पेज नेविगेट कर सकता हूँ, नौकरियां ढूँढ सकता हूँ, मार्केटप्लेस खोल सकता हूँ। मदद के लिए "मदದ" कहें।',
      help_title: '💡 वॉयस कमांड',
      start_btn: 'सुनना शुरू करें',
      stop_btn: 'रुकें',
      show_cmds: 'उपलब्ध कमांड दिखाएं ▾',
      hide_cmds: 'कमांड छुपाएं ▴',
      you_said: 'आपने कहा:'
    },
    'kn-IN': {
      ready: 'ಕೇಳಲು ಸಿದ್ಧವಾಗಿದೆ',
      listening: 'ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದ್ದೇನೆ…',
      speaking: 'ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ…',
      error: 'ದೋಷ',
      not_supported: 'ಬೆಂಬಲಿತವಾಗಿಲ್ಲ - Chrome ಅಥವಾ Edge ಬಳಸಿ',
      no_speech: 'ನಮಗೆ ಏನೂ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      mic_error: 'ಮೈಕ್ರೊಫೋನ್ ದೋಷ: ',
      unknown: (text) => `ಕ್ಷಮಿಸಿ, ನಮಗೆ "${text}" ಅರ್ಥವಾಗಲಿಲ್ಲ. "ಸಹಾಯ" ಎಂದು ಹೇಳಿ.`,
      navigating: 'ನ್ಯಾವಿಗೇಟ್ ಮಾಡುತ್ತಿದ್ದೇನೆ…',
      help_resp: 'ನಾನು ಪುಟಗಳನ್ನು ನ್ಯಾವಿಗೇಟ್ ಮಾಡಬಲ್ಲೆ, ಉದ್ಯೋಗಗಳನ್ನು ಹುಡುಕಬಲ್ಲೆ, ಮಾರುಕಟ್ಟೆಯನ್ನು ತೆರೆಯಬಲ್ಲೆ. ಸಹಾಯಕ್ಕಾಗಿ "ಸಹಾಯ" ಎಂದು ಹೇಳಿ.',
      help_title: '💡 ಧ್ವನಿ ಆಜ್ಞೆಗಳು',
      start_btn: 'ಕೇಳಲು ಪ್ರಾರಂಭಿಸಿ',
      stop_btn: 'ನಿಲ್ಲಿಸಿ',
      show_cmds: 'ಲಭ್ಯವಿರುವ ಆಜ್ಞೆಗಳನ್ನು ತೋರಿಸಿ ▾',
      hide_cmds: 'ಆಜ್ಞೆಗಳನ್ನು ಮರೆಮಾಡಿ ▴',
      you_said: 'ನೀವು ಹೇಳಿದ್ದು:'
    }
  };

  // ─── Route Map (multilingual keyword groups → destination) ────────────────
  const COMMANDS = [
    {
      keywords: {
        'en-IN': ['home', 'landing', 'main page', 'homepage', 'index'],
        'hi-IN': ['होम', 'मुख्य पृष्ठ', 'घर'],
        'kn-IN': ['ಹೋಮ್', 'ಮುಖ್ಯ ಪುಟ', 'ಮನೆ']
      },
      url: '/',
      responses: { 'en-IN': 'Taking you home.', 'hi-IN': 'आपको होम पेज पर ले जा रहा हूँ।', 'kn-IN': 'ನಿಮ್ಮನ್ನು ಹೋಮ್ ಪುಟಕ್ಕೆ ಕರೆದೊಯ್ಯುತ್ತಿದ್ದೇನೆ.' },
      icon: '🏠'
    },
    {
      keywords: {
        'en-IN': ['farmer login', 'login as farmer', 'farmer sign in', 'farmer account'],
        'hi-IN': ['किसान लॉगिन', 'किसान साइन इन'],
        'kn-IN': ['ರೈತ ಲಾಗಿನ್', 'ರೈತರ ಸೈನ್ ಇನ್']
      },
      url: '/farmer/login',
      responses: { 'en-IN': 'Opening farmer login.', 'hi-IN': 'किसान लॉगिन खोल रहा हूँ।', 'kn-IN': 'ರೈತ ಲಾಗಿನ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ.' },
      icon: '🚜'
    },
    {
      keywords: {
        'en-IN': ['worker login', 'login as worker', 'worker sign in', 'worker account'],
        'hi-IN': ['मजदूर लॉगिन', 'श्रमिक लॉगिन', 'मजदूर साइन इन'],
        'kn-IN': ['ಕಾರ್ಮಿಕ ಲಾಗಿನ್', 'ಕೆಲಸಗಾರರ ಲಾಗಿನ್']
      },
      url: '/worker/login',
      responses: { 'en-IN': 'Opening worker login.', 'hi-IN': 'श्रमिक लॉगिन खोल रहा हूँ।', 'kn-IN': 'ಕಾರ್ಮಿಕ ಲಾಗಿನ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ.' },
      icon: '👷'
    },
    {
      keywords: {
        'en-IN': ['farmer dashboard', 'my dashboard', 'farm dashboard', 'farmer panel', 'farm panel'],
        'hi-IN': ['किसान डैशबोर्ड', 'मेरा डैशबोर्ड', 'किसान पैनल'],
        'kn-IN': ['ರೈತ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', 'ನನ್ನ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', 'ರೈತ ಪ್ಯಾನಲ್']
      },
      url: '/farmer/dashboard',
      responses: { 'en-IN': 'Opening farmer dashboard.', 'hi-IN': 'किसान डैशबोर्ड खोल रहा हूँ।', 'kn-IN': 'ರೈತ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ.' },
      icon: '📊'
    },
    {
      keywords: {
        'en-IN': ['worker dashboard', 'my worker dashboard', 'worker panel', 'labour dashboard'],
        'hi-IN': ['श्रमिक डैशबोर्ड', 'मजदूर डैशबोर्ड', 'मजदूर पैनल'],
        'kn-IN': ['ಕಾರ್ಮಿಕ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', 'ಕೆಲಸಗಾರ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', 'ಕಾರ್ಮಿಕ ಪ್ಯಾನಲ್']
      },
      url: '/worker/dashboard',
      responses: { 'en-IN': 'Opening worker dashboard.', 'hi-IN': 'श्रमिक डैशबोर्ड खोल रहा हूँ।', 'kn-IN': 'ಕಾರ್ಮಿಕ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ.' },
      icon: '📋'
    },
    {
      keywords: {
        'en-IN': ['jobs', 'find jobs', 'browse jobs', 'show jobs', 'available jobs', 'work'],
        'hi-IN': ['नौकरी', 'काम ढूंढो', 'नौकरियां दिखाओ', 'काम'],
        'kn-IN': ['ಕೆಲಸ', 'ಉದ್ಯೋಗ', 'ಕೆಲಸ ತೋರಿಸಿ', 'ಉದ್ಯೋಗಗಳು']
      },
      url: '/worker/jobs',
      responses: { 'en-IN': 'Opening available jobs.', 'hi-IN': 'उपलब्ध नौकरियां खोल रहा हूँ।', 'kn-IN': 'ಲಭ್ಯವಿರುವ ಉದ್ಯೋಗಗಳನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ.' },
      icon: '💼'
    },
    {
      keywords: {
        'en-IN': ['marketplace', 'market', 'shop', 'buy products', 'products'],
        'hi-IN': ['मार्केटप्लेस', 'बाजार', 'दुकान'],
        'kn-IN': ['ಮಾರುಕಟ್ಟೆ', 'ಮಾರ್ಕೆಟ್']
      },
      url: '/marketplace',
      responses: { 'en-IN': 'Opening the marketplace.', 'hi-IN': 'मार्केटप्लेस खोल रहा हूँ।', 'kn-IN': 'ಮಾರುಕಟ್ಟೆಯನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ.' },
      icon: '🛍️'
    },
    {
      keywords: {
        'en-IN': ['yojana', 'scheme', 'schemes', 'government scheme', 'govt scheme'],
        'hi-IN': ['योजना', 'सरकारी योजना', 'स्कीम'],
        'kn-IN': ['ಯೋಜನೆ', 'ಸರ್ಕಾರಿ ಯೋಜನೆ', 'ಸ್ಕೀಮ್']
      },
      url: '/krishi-yojanas',
      responses: { 'en-IN': 'Opening Krishi Yojanas.', 'hi-IN': 'कृषि योजनाएं खोल रहा हूँ।', 'kn-IN': 'ಕೃಷಿ ಯೋಜನೆಗಳನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ.' },
      icon: '🏛️'
    },
    {
      keywords: {
        'en-IN': ['post job', 'add job', 'new job', 'create job'],
        'hi-IN': ['नौकरी पोस्ट करें', 'काम डालें', 'नई नौकरी'],
        'kn-IN': ['ಕೆಲಸ ಪೋಸ್ಟ್ ಮಾಡಿ', 'ಹೊಸ ಕೆಲಸ']
      },
      url: '/farmer/post-job',
      responses: { 'en-IN': 'Opening post job page.', 'hi-IN': 'नौकरी पोस्ट पेज खोल रहा हूँ।', 'kn-IN': 'ಕೆಲಸ ಪೋಸ್ಟ್ ಪುಟವನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ.' },
      icon: '📝'
    },
    {
      keywords: {
        'en-IN': ['applications', 'my applications', 'applied jobs'],
        'hi-IN': ['आवेदन', 'मेरे आवेदन'],
        'kn-IN': ['ಅರ್ಜಿಗಳು', 'ನನ್ನ ಅರ್ಜಿಗಳು']
      },
      url: '/worker/my-applications',
      responses: { 'en-IN': 'Opening your applications.', 'hi-IN': 'आपके आवेदन खोल रहा हूँ।', 'kn-IN': 'ನಿಮ್ಮ ಅರ್ಜಿಗಳನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ.' },
      icon: '📄'
    },
    {
      keywords: {
        'en-IN': ['admin login', 'admin portal', 'admin panel', 'admin page'],
        'hi-IN': ['एडमिन लॉगिन', 'एडमिन पोर्टल', 'एडमिन पैनल'],
        'kn-IN': ['ಅಡ್ಮಿನ್ ಲಾಗಿನ್', 'ಅಡ್ಮಿನ್ ಪೋರ್ಟಲ್', 'ಅಡ್ಮಿನ್ ಪ್ಯಾನಲ್']
      },
      url: '/admin/login',
      responses: { 'en-IN': 'Opening admin portal.', 'hi-IN': 'एडमिन पोर्टल खोल रहा हूँ।', 'kn-IN': 'ಅಡ್ಮಿನ್ ಪೋರ್ಟಲ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ.' },
      icon: '🔐'
    },
    {
      keywords: {
        'en-IN': ['logout', 'log out', 'sign out', 'exit'],
        'hi-IN': ['लॉगआउट', 'साइन आउट'],
        'kn-IN': ['ಲಾಗಿನ್ ಔಟ್', 'ಸೈನ್ ಔಟ್']
      },
      url: '/logout',
      responses: { 'en-IN': 'Logging you out.', 'hi-IN': 'आपको लॉगआउट कर रहा हूँ।', 'kn-IN': 'ನಿಮ್ಮನ್ನು ಲಾಗಿನ್ ಔಟ್ ಮಾಡಲಾಗುತ್ತಿದೆ.' },
      icon: '👋'
    }
  ];

  // Help keywords
  const HELP_KEYWORDS = {
    'en-IN': ['help', 'commands', 'what can i say', 'assistant'],
    'hi-IN': ['मदद', 'सहायता', 'कमांड', 'क्या कर सकते हैं'],
    'kn-IN': ['ಸಹಾಯ', 'ಆಜ್ಞೆಗಳು']
  };

  // Search prefixes
  const SEARCH_PREFIXES = {
    'en-IN': ['search for', 'find', 'look for', 'search'],
    'hi-IN': ['ढूंढो', 'तलाश करो', 'सर्च करो'],
    'kn-IN': ['ಹುಡುಕಿ', 'ಹುಡುಕು']
  };

  // Filler words to strip before matching
  const FILLERS = {
    'en-IN': ['go to', 'open', 'show', 'show me', 'take me to', 'please', 'can you', 'the', 'i want to'],
    'hi-IN': ['दिखाओ', 'खोलो', 'जाओ', 'कृपया', 'चाहता हूँ'],
    'kn-IN': ['ತೋರಿಸಿ', 'ತೆರೆಯಿರಿ', 'ಹೋಗಿ', 'ಬೇಕು']
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function normalize(text, lang) {
    let t = text.toLowerCase().trim();
    if (lang && FILLERS[lang]) {
      FILLERS[lang].forEach(f => {
        t = t.replace(new RegExp('^' + f + '\\s+', 'g'), '');
        t = t.replace(new RegExp('\\s+' + f + '$', 'g'), '');
        t = t.replace(new RegExp('\\s+' + f + '\\s+', 'g'), ' ');
      });
    }
    return t.trim();
  }

  function getLang() {
    return document.getElementById('va-language')?.value || 'en-IN';
  }

  function matchCommand(transcript) {
    const lang = getLang();
    const cleanText = normalize(transcript, lang);
    const rawText = transcript.toLowerCase();

    // 1. Check Search Automation
    const searchPrefixes = SEARCH_PREFIXES[lang] || [];
    for (const prefix of searchPrefixes) {
      if (rawText.startsWith(prefix + ' ') || rawText.includes(' ' + prefix + ' ')) {
        const query = rawText.split(prefix).pop().trim();
        if (query) {
          return { type: 'search', query };
        }
      }
    }

    // 2. Check Help
    if (HELP_KEYWORDS[lang].some(k => rawText.includes(k) || cleanText.includes(k))) {
      return { type: 'help' };
    }

    // 3. Check Navigation
    for (const cmd of COMMANDS) {
      const keywords = cmd.keywords[lang] || [];
      // Try matching cleaned text or raw text
      if (keywords.some(k => cleanText.includes(normalize(k)) || rawText.includes(normalize(k)))) {
        return { type: 'navigate', cmd };
      }
    }

    return { type: 'unknown', transcript };
  }

  // ─── UI Builder ────────────────────────────────────────────────────────────
  function buildUI() {
    if (document.getElementById('va-container')) return;

    const html = `
      <button id="va-toggle" class="va-orb" title="Voice Assistant">
        <span class="va-orb-icon">🎤</span>
        <span class="va-orb-pulse"></span>
      </button>

      <div id="va-panel" class="va-panel va-hidden">
        <div class="va-panel-header">
          <div class="va-header-left">
            <div class="va-header-icon">🎙️</div>
            <div>
              <div class="va-title">Voice Assistant</div>
              <div class="va-subtitle">Labour Connect AI</div>
            </div>
          </div>
          <button id="va-close" class="va-close-btn">✕</button>
        </div>

        <div class="va-panel-body">
          <div class="va-section">
            <label class="va-label">🌐 Language</label>
            <select id="va-language" class="va-select">
              <option value="en-IN">English</option>
              <option value="hi-IN">हिंदी (Hindi)</option>
              <option value="kn-IN">ಕನ್ನಡ (Kannada)</option>
            </select>
          </div>

          <div class="va-status-row">
            <div class="va-status-dot" id="va-dot"></div>
            <span id="va-status-text">Ready to listen</span>
          </div>

          <div class="va-transcript-box">
            <div id="va-transcript-label" class="va-transcript-label">You said:</div>
            <div id="va-transcript" class="va-transcript-text">Press "Start Listening" and speak a command…</div>
          </div>

          <div id="va-response-box" class="va-response-box va-hidden">
            <div id="va-response-icon" class="va-resp-icon">🤖</div>
            <div id="va-response-text" class="va-resp-text"></div>
          </div>

          <div class="va-controls">
            <button id="va-start" class="va-btn-primary">
              <span class="va-btn-icon">🎤</span> <span id="va-start-label">Start Listening</span>
            </button>
            <button id="va-stop" class="va-btn-secondary" disabled>
              <span class="va-btn-icon">⏹</span> <span id="va-stop-label">Stop</span>
            </button>
          </div>

          <button id="va-help-toggle" class="va-help-link">Show available commands ▾</button>
          <div id="va-help-list" class="va-help-list-container va-hidden">
            <div class="va-help-title">💡 Commands</div>
            <div id="va-help-grid" class="va-help-grid">
              <!-- Dynamically populated -->
            </div>
          </div>
        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.id = 'va-container';
    div.innerHTML = html;
    document.body.appendChild(div);

    initLogic();
  }

  // ─── Logic ─────────────────────────────────────────────────────────────────
  function initLogic() {
    const toggleBtn = document.getElementById('va-toggle');
    const panel = document.getElementById('va-panel');
    const closeBtn = document.getElementById('va-close');
    const startBtn = document.getElementById('va-start');
    const stopBtn = document.getElementById('va-stop');
    const statusText = document.getElementById('va-status-text');
    const transcript = document.getElementById('va-transcript');
    const transcriptLabel = document.getElementById('va-transcript-label');
    const startLabel = document.getElementById('va-start-label');
    const stopLabel = document.getElementById('va-stop-label');
    const responseBox = document.getElementById('va-response-box');
    const responseIcon = document.getElementById('va-response-icon');
    const responseText = document.getElementById('va-response-text');
    const dot = document.getElementById('va-dot');
    const langSelect = document.getElementById('va-language');
    const helpToggle = document.getElementById('va-help-toggle');
    const helpList = document.getElementById('va-help-list');
    const orb = document.getElementById('va-toggle');

    // Helper to generate help items
    function getHelpListHTML(lang) {
      return COMMANDS.map(cmd => `
        <div class="va-help-chip" onclick="window.location.href='${cmd.url}'">
          ${cmd.icon} ${cmd.keywords[lang][0].charAt(0).toUpperCase() + cmd.keywords[lang][0].slice(1)}
        </div>
      `).join('') + `
        <div class="va-help-chip" style="background: rgba(56, 189, 248, 0.1); border-color: #38bdf8;">
          🔍 Search for [term]
        </div>
      `;
    }

    function updateUILanguage() {
      const lang = getLang();
      const t = TRANSLATIONS[lang];
      statusText.textContent = t.ready;
      transcriptLabel.textContent = t.you_said;
      startLabel.textContent = t.start_btn;
      stopLabel.textContent = t.stop_btn;
      helpToggle.textContent = helpList.classList.contains('va-hidden') ? t.show_cmds : t.hide_cmds;
      
      // Update dynamic help list
      const helpGrid = document.getElementById('va-help-grid');
      if (helpGrid) helpGrid.innerHTML = getHelpListHTML(lang);
    }

    toggleBtn.addEventListener('click', () => {
      panel.classList.toggle('va-hidden');
      orb.classList.toggle('va-orb-active');
      updateUILanguage();
    });

    closeBtn.addEventListener('click', () => {
      panel.classList.add('va-hidden');
      orb.classList.remove('va-orb-active');
    });

    helpToggle.addEventListener('click', () => {
      helpList.classList.toggle('va-hidden');
      updateUILanguage();
    });

    langSelect.addEventListener('change', updateUILanguage);

    function setStatus(text, state) {
      statusText.textContent = text;
      dot.className = 'va-status-dot';
      if (state === 'listening') dot.classList.add('va-dot-listening');
      else if (state === 'speaking') dot.classList.add('va-dot-speaking');
      else if (state === 'error') dot.classList.add('va-dot-error');
      else dot.classList.add('va-dot-idle');
    }

    function showResponse(icon, text, isError = false) {
      responseBox.classList.remove('va-hidden');
      responseIcon.textContent = icon;
      responseText.textContent = text;
      responseBox.className = 'va-response-box' + (isError ? ' va-resp-error' : '');
    }

    const synth = window.speechSynthesis;
    function speak(text, onEnd) {
      if (!synth) { onEnd && onEnd(); return; }
      const lang = getLang();
      synth.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = lang;
      utt.onstart = () => setStatus(TRANSLATIONS[lang].speaking, 'speaking');
      utt.onend = onEnd;
      synth.speak(utt);
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      statusText.textContent = 'Speech API not supported';
      startBtn.disabled = true;
      return;
    }

    let recognition = new SpeechRecognition();
    let isListening = false;

    startBtn.addEventListener('click', () => {
      const lang = getLang();
      recognition.lang = lang;
      recognition.interimResults = true;
      recognition.start();
      isListening = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;
      orb.classList.add('va-orb-listening');
      setStatus(TRANSLATIONS[lang].listening, 'listening');
    });

    stopBtn.addEventListener('click', () => {
      recognition.stop();
    });

    recognition.onresult = (event) => {
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
      }
      if (final) {
        transcript.textContent = final;
        const match = matchCommand(final);
        handleMatch(match, final);
      }
    };

    recognition.onend = () => {
      isListening = false;
      startBtn.disabled = false;
      stopBtn.disabled = true;
      orb.classList.remove('va-orb-listening');
      setStatus(TRANSLATIONS[getLang()].ready, 'idle');
    };

    function handleMatch(match, originalText) {
      const lang = getLang();
      if (match.type === 'navigate') {
        const { cmd } = match;
        const resp = cmd.responses[lang];
        showResponse(cmd.icon, resp);
        speak(resp, () => {
          setTimeout(() => { window.location.href = cmd.url; }, 500);
        });
      } else if (match.type === 'search') {
        const { query } = match;
        const resp = lang === 'hi-IN' ? `खोज रहे हैं: ${query}` : (lang === 'kn-IN' ? `ಹುಡುಕಲಾಗುತ್ತಿದೆ: ${query}` : `Searching for: ${query}`);
        showResponse('🔍', resp);
        speak(resp, () => {
          setTimeout(() => { window.location.href = `/krishi-yojanas?search=${encodeURIComponent(query)}`; }, 500);
        });
      } else if (match.type === 'help') {
        const resp = TRANSLATIONS[lang].help_resp;
        showResponse('💡', resp);
        speak(resp);
      } else {
        const resp = TRANSLATIONS[lang].unknown(originalText);
        showResponse('🤔', resp, true);
        speak(resp);
      }
    }

    // Initialize UI language and help list
    updateUILanguage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }
})();
