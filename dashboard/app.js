const FILTERS = ["ALL", "AUTO_APPROVED", "NEEDS_REVIEW", "DUPLICATE"];
const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 30;
const HISTORY_STORAGE_KEY_PREFIX = "receiptpulse-upload-history";
const AUTH_STORAGE_KEY = "receiptpulse-auth-session";
const AUTH_SIGNIN_PATH = "./index.html";
const AUTH_SIGNUP_PATH = "./signup.html";
const MAX_HISTORY_ITEMS = 8;
const authClient = window.ReceiptPulseAuth || null;
const HOW_IT_WORKS = [
  {
    eyebrow: "Stage 01",
    frontTitle: "Upload File",
    frontBody: "A signed-in user selects a PDF or image from the browser.",
    backTitle: "S3 Intake",
    backBody:
      "The frontend requests a presigned URL so the file can be uploaded directly into S3.",
  },
  {
    eyebrow: "Stage 02",
    frontTitle: "Extract Fields",
    frontBody: "Textract reads vendor, amount, date, and visible line items.",
    backTitle: "Lambda Processing",
    backBody:
      "A Lambda function calls Textract and normalizes the receipt into a structured record.",
  },
  {
    eyebrow: "Stage 03",
    frontTitle: "Check Quality",
    frontBody: "Simple rules mark low-confidence or duplicate receipts for review.",
    backTitle: "Review Logic",
    backBody:
      "This keeps the dashboard from treating uncertain OCR output as clean data by default.",
  },
  {
    eyebrow: "Stage 04",
    frontTitle: "Show Results",
    frontBody: "The processed records appear in charts, tables, and review lists.",
    backTitle: "Project Dashboard",
    backBody:
      "The goal is to demonstrate an end-to-end cloud workflow through a single dashboard view.",
  },
];
const VISUAL_PRESETS = [
  {
    key: "food",
    icon: "🍜",
    color: "#ff8a5b",
    soft: "rgba(255, 138, 91, 0.18)",
    ring: "rgba(255, 138, 91, 0.42)",
    keywords: ["food", "dining", "restaurant", "cafe", "coffee", "snack", "lunch", "dinner", "pizza", "burger"],
  },
  {
    key: "shopping",
    icon: "🛍️",
    color: "#ff6fb5",
    soft: "rgba(255, 111, 181, 0.18)",
    ring: "rgba(255, 111, 181, 0.42)",
    keywords: ["shopping", "retail", "amazon", "store", "mart", "fashion", "gift", "boutique"],
  },
  {
    key: "travel",
    icon: "✈️",
    color: "#63b3ff",
    soft: "rgba(99, 179, 255, 0.18)",
    ring: "rgba(99, 179, 255, 0.42)",
    keywords: ["travel", "flight", "trip", "hotel", "uber", "cab", "ola", "taxi", "air", "booking"],
  },
  {
    key: "electricity",
    icon: "⚡",
    color: "#ffd84d",
    soft: "rgba(255, 216, 77, 0.18)",
    ring: "rgba(255, 216, 77, 0.4)",
    keywords: ["electricity", "electric", "power", "current", "bill", "utility", "utilities", "meter"],
  },
  {
    key: "groceries",
    icon: "🛒",
    color: "#63df97",
    soft: "rgba(99, 223, 151, 0.18)",
    ring: "rgba(99, 223, 151, 0.4)",
    keywords: ["groceries", "grocery", "vegetable", "supermarket", "mart", "fresh"],
  },
  {
    key: "medical",
    icon: "🩺",
    color: "#65d8ff",
    soft: "rgba(101, 216, 255, 0.18)",
    ring: "rgba(101, 216, 255, 0.4)",
    keywords: ["medical", "hospital", "clinic", "pharma", "medicine", "doctor", "health"],
  },
  {
    key: "fuel",
    icon: "⛽",
    color: "#ffb258",
    soft: "rgba(255, 178, 88, 0.18)",
    ring: "rgba(255, 178, 88, 0.4)",
    keywords: ["fuel", "petrol", "diesel", "gas", "station"],
  },
  {
    key: "entertainment",
    icon: "🎉",
    color: "#a88cff",
    soft: "rgba(168, 140, 255, 0.18)",
    ring: "rgba(168, 140, 255, 0.42)",
    keywords: ["movie", "entertainment", "party", "game", "fun", "event", "ticket"],
  },
  {
    key: "home",
    icon: "🏠",
    color: "#7ed6ff",
    soft: "rgba(126, 214, 255, 0.18)",
    ring: "rgba(126, 214, 255, 0.42)",
    keywords: ["rent", "home", "house", "repair", "furniture", "decor"],
  },
  {
    key: "subscription",
    icon: "📱",
    color: "#62e1d9",
    soft: "rgba(98, 225, 217, 0.18)",
    ring: "rgba(98, 225, 217, 0.42)",
    keywords: ["subscription", "internet", "wifi", "netflix", "spotify", "phone", "mobile", "broadband"],
  },
];
const FUN_FALLBACK_SWATCHES = [
  { icon: "🌈", color: "#ff7ecf", soft: "rgba(255, 126, 207, 0.18)", ring: "rgba(255, 126, 207, 0.42)" },
  { icon: "✨", color: "#7de7ff", soft: "rgba(125, 231, 255, 0.18)", ring: "rgba(125, 231, 255, 0.42)" },
  { icon: "🎈", color: "#ffae5f", soft: "rgba(255, 174, 95, 0.18)", ring: "rgba(255, 174, 95, 0.42)" },
  { icon: "💜", color: "#b48fff", soft: "rgba(180, 143, 255, 0.18)", ring: "rgba(180, 143, 255, 0.42)" },
  { icon: "🪄", color: "#6ee7b7", soft: "rgba(110, 231, 183, 0.18)", ring: "rgba(110, 231, 183, 0.42)" },
];
const SAFE_THEME_ICONS = {
  receipt: "\u{1F9FE}",
  food: "\u{1F35C}",
  shopping: "\u{1F6CD}\u{FE0F}",
  travel: "\u{2708}\u{FE0F}",
  electricity: "\u{26A1}",
  groceries: "\u{1F6D2}",
  medical: "\u{1FA7A}",
  fuel: "\u{26FD}",
  entertainment: "\u{1F389}",
  home: "\u{1F3E0}",
  subscription: "\u{1F4F1}",
};
const SAFE_FALLBACK_ICONS = [
  "\u{1F308}",
  "\u{2728}",
  "\u{1F388}",
  "\u{1F49C}",
  "\u{1FA84}",
];
const IGNORED_LABELS = new Set(["", "finance desk", "receiptpulse", "ops"]);
const FALLBACK_DASHBOARD = {
  summary: {
    receiptCount: 18,
    totalSpend: 4826.48,
    averageConfidence: 91.4,
    duplicateCount: 2,
    needsReviewCount: 4,
    autoApprovedCount: 14,
  },
  categoryBreakdown: [
    { label: "Travel", amount: 1620.9, share: 33.6 },
    { label: "Food & Dining", amount: 1182.44, share: 24.5 },
    { label: "Retail", amount: 954.17, share: 19.8 },
    { label: "Office Supplies", amount: 612.37, share: 12.7 },
    { label: "Utilities", amount: 456.6, share: 9.4 },
  ],
  topVendors: [
    { vendor: "Amazon", amount: 954.17, share: 19.8 },
    { vendor: "SkyRoute Travels", amount: 842.6, share: 17.5 },
    { vendor: "Mellu Trading Pty Ltd", amount: 694.12, share: 14.4 },
    { vendor: "Urban Brew Cafe", amount: 512.41, share: 10.6 },
  ],
  monthlyTrend: [
    { month: "2026-01", amount: 1186.25, count: 4 },
    { month: "2026-02", amount: 1464.48, count: 5 },
    { month: "2026-03", amount: 2175.75, count: 9 },
  ],
  reviewQueue: [
    {
      receiptId: "rcpt-104",
      vendor: "Metro Medical",
      category: "Medical",
      totalAmount: "88.40",
      reviewStatus: "NEEDS_REVIEW",
      reasons: [
        "Confidence score 78.30 is below threshold 85.00.",
        "No line items were detected from the receipt.",
      ],
    },
    {
      receiptId: "rcpt-109",
      vendor: "Amazon",
      category: "Retail",
      totalAmount: "241.99",
      reviewStatus: "DUPLICATE",
      reasons: ["Potential duplicate of rcpt-083."],
    },
    {
      receiptId: "rcpt-114",
      vendor: "Unknown Vendor",
      category: "Uncategorized",
      totalAmount: "0.00",
      reviewStatus: "NEEDS_REVIEW",
      reasons: [
        "Vendor could not be identified confidently.",
        "Total amount is missing or invalid.",
      ],
    },
  ],
  workflow: [
    {
      step: "01",
      title: "Receipt Intake",
      description:
        "Receipts are uploaded into Amazon S3 with uploader metadata for ownership, audit trail, and traceability.",
    },
    {
      step: "02",
      title: "Field Extraction",
      description: "Lambda uses Textract AnalyzeExpense to capture totals, merchant, date, and line items.",
    },
    {
      step: "03",
      title: "Review Rules",
      description:
        "Confidence thresholds, duplicate keys, and missing-field checks assign posted or needs-review states.",
    },
    {
      step: "04",
      title: "Store Results",
      description:
        "DynamoDB stores the processed receipt records so the dashboard can load them later.",
    },
    {
      step: "05",
      title: "Render Dashboard",
      description: "The frontend reads the stored records and renders charts, tables, and review states.",
    },
  ],
  heroHeadline:
    "Low-confidence and duplicate receipts are separated before they affect the summary cards.",
  receipts: [
    {
      receiptId: "rcpt-118",
      vendor: "SkyRoute Travels",
      category: "Travel",
      reviewStatus: "AUTO_APPROVED",
      totalAmount: "384.50",
      confidenceScore: "96.2",
      expenseMonth: "2026-03",
      uploadedBy: "finance@receiptpulse.dev",
    },
    {
      receiptId: "rcpt-117",
      vendor: "Urban Brew Cafe",
      category: "Food & Dining",
      reviewStatus: "AUTO_APPROVED",
      totalAmount: "63.20",
      confidenceScore: "94.1",
      expenseMonth: "2026-03",
      uploadedBy: "ops@receiptpulse.dev",
    },
    {
      receiptId: "rcpt-116",
      vendor: "Amazon",
      category: "Retail",
      reviewStatus: "AUTO_APPROVED",
      totalAmount: "241.99",
      confidenceScore: "92.7",
      expenseMonth: "2026-03",
      uploadedBy: "procurement@receiptpulse.dev",
    },
    {
      receiptId: "rcpt-115",
      vendor: "OfficeVerse",
      category: "Office Supplies",
      reviewStatus: "AUTO_APPROVED",
      totalAmount: "126.75",
      confidenceScore: "90.3",
      expenseMonth: "2026-03",
      uploadedBy: "ops@receiptpulse.dev",
    },
    {
      receiptId: "rcpt-114",
      vendor: "Unknown Vendor",
      category: "Uncategorized",
      reviewStatus: "NEEDS_REVIEW",
      totalAmount: "0.00",
      confidenceScore: "71.1",
      expenseMonth: "2026-03",
      uploadedBy: "finance@receiptpulse.dev",
    },
    {
      receiptId: "rcpt-113",
      vendor: "Mellu Trading Pty Ltd",
      category: "Retail",
      reviewStatus: "AUTO_APPROVED",
      totalAmount: "322.37",
      confidenceScore: "93.9",
      expenseMonth: "2026-03",
      uploadedBy: "ops@receiptpulse.dev",
    },
    {
      receiptId: "rcpt-112",
      vendor: "Cloud Telecom",
      category: "Utilities",
      reviewStatus: "AUTO_APPROVED",
      totalAmount: "178.80",
      confidenceScore: "95.0",
      expenseMonth: "2026-03",
      uploadedBy: "infra@receiptpulse.dev",
    },
    {
      receiptId: "rcpt-111",
      vendor: "CityCab",
      category: "Travel",
      reviewStatus: "AUTO_APPROVED",
      totalAmount: "58.45",
      confidenceScore: "93.0",
      expenseMonth: "2026-03",
      uploadedBy: "ops@receiptpulse.dev",
    },
    {
      receiptId: "rcpt-110",
      vendor: "Metro Medical",
      category: "Medical",
      reviewStatus: "NEEDS_REVIEW",
      totalAmount: "88.40",
      confidenceScore: "78.3",
      expenseMonth: "2026-03",
      uploadedBy: "hr@receiptpulse.dev",
    },
    {
      receiptId: "rcpt-109",
      vendor: "Amazon",
      category: "Retail",
      reviewStatus: "DUPLICATE",
      totalAmount: "241.99",
      confidenceScore: "91.2",
      expenseMonth: "2026-02",
      uploadedBy: "procurement@receiptpulse.dev",
    },
    {
      receiptId: "rcpt-108",
      vendor: "Urban Brew Cafe",
      category: "Food & Dining",
      reviewStatus: "AUTO_APPROVED",
      totalAmount: "49.60",
      confidenceScore: "96.4",
      expenseMonth: "2026-02",
      uploadedBy: "marketing@receiptpulse.dev",
    },
    {
      receiptId: "rcpt-107",
      vendor: "SkyRoute Travels",
      category: "Travel",
      reviewStatus: "AUTO_APPROVED",
      totalAmount: "399.65",
      confidenceScore: "95.7",
      expenseMonth: "2026-02",
      uploadedBy: "finance@receiptpulse.dev",
    },
  ],
};

const elements = {
  cursorOrb: document.querySelector("#cursorOrb"),
  cursorRing: document.querySelector("#cursorRing"),
  cursorDrips: document.querySelector("#cursorDrips"),
  dashboardPeriodSelect: document.querySelector("#dashboardPeriodSelect"),
  metricsGrid: document.querySelector("#metricsGrid"),
  categoryChart: document.querySelector("#categoryChart"),
  vendorList: document.querySelector("#vendorList"),
  workflowTrack: document.querySelector("#workflowTrack"),
  queueList: document.querySelector("#queueList"),
  trendBars: document.querySelector("#trendBars"),
  expenseMonthSelect: document.querySelector("#expenseMonthSelect"),
  expenseDonut: document.querySelector("#expenseDonut"),
  expenseLegend: document.querySelector("#expenseLegend"),
  receiptsBody: document.querySelector("#receiptsBody"),
  filterRow: document.querySelector("#filterRow"),
  modeBadge: document.querySelector("#modeBadge"),
  statusNote: document.querySelector("#statusNote"),
  authSummary: document.querySelector("#authSummary"),
  authCta: document.querySelector("#authCta"),
  authSecondaryCta: document.querySelector("#authSecondaryCta"),
  signOutButton: document.querySelector("#signOutButton"),
  riskHeadline: document.querySelector("#riskHeadline"),
  opsStrip: document.querySelector("#opsStrip"),
  spotlightKicker: document.querySelector("#spotlightKicker"),
  spotlightTitle: document.querySelector("#spotlightTitle"),
  spotlightNarrative: document.querySelector("#spotlightNarrative"),
  spotlightFacts: document.querySelector("#spotlightFacts"),
  spotlightPanel: document.querySelector(".spotlight-panel"),
  flipGrid: document.querySelector("#flipGrid"),
  heroUploadTrigger: document.querySelector("#heroUploadTrigger"),
  archiveToggle: document.querySelector("#archiveToggle"),
  archiveClose: document.querySelector("#archiveClose"),
  archivePanel: document.querySelector("#receiptsTable"),
  uploadForm: document.querySelector("#uploadForm"),
  fileInput: document.querySelector("#fileInput"),
  dropzone: document.querySelector("#dropzone"),
  fileMeta: document.querySelector("#fileMeta"),
  previewFrame: document.querySelector("#previewFrame"),
  previewMeta: document.querySelector("#previewMeta"),
  uploadName: document.querySelector("#uploadName"),
  uploadAccount: document.querySelector("#uploadAccount"),
  uploadHelper: document.querySelector("#uploadHelper"),
  uploadSubmit: document.querySelector("#uploadSubmit"),
  uploadTimeline: document.querySelector("#uploadTimeline"),
  uploadMessage: document.querySelector("#uploadMessage"),
  uploadMotionScene: document.querySelector("#uploadMotionScene"),
  uploadMotionReceipt: document.querySelector("#uploadMotionReceipt"),
  uploadMotionIcon: document.querySelector("#uploadMotionIcon"),
  uploadMotionLabel: document.querySelector("#uploadMotionLabel"),
  uploadMotionDetail: document.querySelector("#uploadMotionDetail"),
  uploadMotionStage: document.querySelector("#uploadMotionStage"),
  uploadMotionStageCopy: document.querySelector("#uploadMotionStageCopy"),
  historyToggle: document.querySelector("#historyToggle"),
  historyClose: document.querySelector("#historyClose"),
  historyDelete: document.querySelector("#historyDelete"),
  historyDeleteAction: document.querySelector("#historyDeleteAction"),
  historyClearLocal: document.querySelector("#historyClearLocal"),
  historyRangeStart: document.querySelector("#historyRangeStart"),
  historyRangeEnd: document.querySelector("#historyRangeEnd"),
  historyDrawer: document.querySelector("#historyDrawer"),
  historyList: document.querySelector("#historyList"),
  historyScrim: document.querySelector("#historyScrim"),
  confirmModal: document.querySelector("#confirmModal"),
  confirmScrim: document.querySelector("#confirmScrim"),
  confirmTitle: document.querySelector("#confirmTitle"),
  confirmBody: document.querySelector("#confirmBody"),
  confirmAccept: document.querySelector("#confirmAccept"),
  confirmCancel: document.querySelector("#confirmCancel"),
  successBurst: document.querySelector("#successBurst"),
};

const authConfig = normalizeAuthConfig(window.RECEIPTPULSE_CONFIG?.auth || {});
let dashboardData = null;
let activeDashboardView = null;
let activeFilter = "ALL";
let apiBase = "";
let uploadHistory = [];
let previewObjectUrl = "";
let latestPreview = null;
let archiveOpen = false;
let selectedDashboardPeriod = "all";
let selectedExpenseMonth = "";
let donutRefreshTimer = 0;
let panelRefreshTimer = 0;
let pendingVisualRefresh = null;
let uploadState = {
  phase: "idle",
  stage: "slot",
  message: "Choose a receipt from your device to start a new upload.",
  objectKey: "",
  receipt: null,
  customLabel: "",
  fileName: "",
  startedAt: 0,
  durationMs: null,
};
let confirmState = {
  resolve: null,
  previousFocus: null,
};
let authState = {
  status: "idle",
  tokens: loadStoredTokens(),
  user: null,
};

function normalizeAuthConfig(raw) {
  if (authClient?.normalizeConfig) {
    return authClient.normalizeConfig(raw, {
      fallbackUrl: `${window.location.origin}${window.location.pathname}`,
    });
  }

  const fallbackUrl = `${window.location.origin}${window.location.pathname}`;
  const hostedUiDomain = String(raw?.hostedUiDomain || "").trim().replace(/\/$/, "");
  const regionFromDomain = hostedUiDomain.match(/\.auth\.([a-z0-9-]+)\.amazoncognito\.com$/i)?.[1] || "";

  return {
    hostedUiDomain,
    clientId: String(raw?.clientId || "").trim(),
    region: String(raw?.region || regionFromDomain).trim(),
    redirectSignIn: String(raw?.redirectSignIn || fallbackUrl).trim(),
    redirectSignOut: String(raw?.redirectSignOut || fallbackUrl).trim(),
    appPath: "./app.html",
  };
}

function isAuthConfigured() {
  if (authClient?.isConfigured) {
    return authClient.isConfigured(authConfig);
  }

  return Boolean(authConfig.clientId && authConfig.region);
}

function isSignedIn() {
  return authState.status === "signed_in" && Boolean(authState.tokens?.accessToken);
}

function loadStoredTokens() {
  if (authClient?.loadStoredTokens) {
    return authClient.loadStoredTokens();
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.warn("Unable to read stored auth session.", error);
    return null;
  }
}

function persistAuthTokens(tokens) {
  authState.tokens = tokens;

  if (authClient?.persistTokens) {
    authClient.persistTokens(tokens);
    return;
  }

  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
  } catch (error) {
    console.warn("Unable to persist auth session.", error);
  }
}

function clearStoredTokens() {
  authState.tokens = null;

  if (authClient?.clearTokens) {
    authClient.clearTokens();
    return;
  }

  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to clear auth session.", error);
  }
}

function decodeJwtPayload(token) {
  if (authClient?.decodeJwtPayload) {
    return authClient.decodeJwtPayload(token);
  }

  if (!token || !token.includes(".")) {
    return {};
  }

  try {
    const encodedPayload = token.split(".")[1];
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = atob(padded);
    const bytes = Array.from(decoded, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join("");
    return JSON.parse(decodeURIComponent(bytes));
  } catch (error) {
    console.warn("Unable to decode JWT payload.", error);
    return {};
  }
}

function buildUserFromTokens(tokens) {
  if (authClient?.buildUserFromTokens) {
    return authClient.buildUserFromTokens(tokens);
  }

  const claims = decodeJwtPayload(tokens?.idToken || tokens?.accessToken || "");
  return {
    id: claims.sub || claims["cognito:username"] || claims.username || "",
    email: claims.email || "",
    name:
      claims.name ||
      claims.preferred_username ||
      claims["cognito:username"] ||
      claims.username ||
      claims.email ||
      "Workspace user",
  };
}

function isTokenExpired(bufferMs = 60000) {
  if (authClient?.isTokenExpired) {
    return authClient.isTokenExpired(authState.tokens, bufferMs);
  }

  const expiresAt = Number(authState.tokens?.expiresAt || 0);
  if (!expiresAt) {
    return true;
  }

  return Date.now() + bufferMs >= expiresAt;
}

function setSignedOutState() {
  clearStoredTokens();
  authState = {
    ...authState,
    status: isAuthConfigured() ? "signed_out" : "unavailable",
    user: null,
    tokens: null,
  };
}

function updateAuthFromTokens(tokens) {
  const user = buildUserFromTokens(tokens);
  if (!user.id) {
    throw new Error("Signed-in session is missing a stable user id.");
  }

  persistAuthTokens(tokens);
  authState = {
    ...authState,
    status: "signed_in",
    tokens,
    user,
  };
  updateAuthUI();
}

async function refreshAuthSession() {
  if (!authState.tokens?.refreshToken) {
    throw new Error("No refresh token is available for this session.");
  }
  if (!authClient?.refreshSession) {
    throw new Error("Front-end auth helper did not load.");
  }

  authState = {
    ...authState,
    status: "refreshing",
  };
  updateAuthUI();

  const refreshed = await authClient.refreshSession(
    authConfig,
    authState.tokens.refreshToken,
    authState.tokens
  );
  updateAuthFromTokens(refreshed);
}

async function initializeAuth() {
  if (!isAuthConfigured()) {
    authState = {
      ...authState,
      status: "unavailable",
      user: null,
      tokens: null,
    };
    updateAuthUI();
    reloadUploadHistory();
    return;
  }

  authState = {
    ...authState,
    status: authState.tokens ? "restoring" : "signed_out",
  };
  updateAuthUI();

  try {
    if (authState.tokens) {
      if (isTokenExpired()) {
        await refreshAuthSession();
      } else {
        updateAuthFromTokens(authState.tokens);
      }
    } else {
      authState = {
        ...authState,
        status: "signed_out",
        user: null,
      };
    }
  } catch (error) {
    console.error("Authentication bootstrap failed.", error);
    setSignedOutState();
    elements.statusNote.textContent =
      error.message || "Authentication failed. Sign in again to continue.";
  }

  updateAuthUI();
  reloadUploadHistory();
}

async function ensureValidAccessToken() {
  if (!isAuthConfigured()) {
    throw new Error("Authentication is not configured for this dashboard.");
  }
  if (!authState.tokens?.accessToken) {
    throw new Error("Sign in to open your account view.");
  }

  if (isTokenExpired()) {
    await refreshAuthSession();
  }

  return authState.tokens.accessToken;
}

async function apiFetch(path, options = {}, retry = true) {
  if (!apiBase) {
    throw new Error("Live API is not configured for this dashboard.");
  }

  const token = await ensureValidAccessToken();
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${apiBase.replace(/\/$/, "")}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && retry && authState.tokens?.refreshToken) {
    await refreshAuthSession();
    return apiFetch(path, options, false);
  }

  if (response.status === 401) {
    setSignedOutState();
    updateAuthUI();
    throw new Error("Your session expired. Sign in again to continue.");
  }

  return response;
}

function getHistoryStorageKey() {
  return `${HISTORY_STORAGE_KEY_PREFIX}:${authState.user?.id || "guest"}`;
}

function reloadUploadHistory() {
  uploadHistory = loadUploadHistory();
  renderUploadHistory();
}

function updateAuthUI() {
  const configured = isAuthConfigured();
  const signedIn = isSignedIn();
  const authBusy = ["refreshing", "restoring"].includes(authState.status);

  if (elements.authSummary) {
    elements.authSummary.textContent = signedIn
      ? authState.user.name || "Signed In"
      : configured
        ? "Sign In Required"
        : "Config Needed";
  }

  if (elements.authCta) {
    elements.authCta.hidden = signedIn || !configured;
    elements.authCta.disabled = authBusy;
    elements.authCta.textContent = "Sign In";
  }

  if (elements.authSecondaryCta) {
    elements.authSecondaryCta.hidden = signedIn || !configured;
    elements.authSecondaryCta.disabled = authBusy;
    elements.authSecondaryCta.textContent = "Create Account";
  }

  if (elements.signOutButton) {
    elements.signOutButton.hidden = !signedIn;
    elements.signOutButton.disabled = authBusy;
  }

  if (elements.uploadAccount) {
    elements.uploadAccount.value = signedIn
      ? `${authState.user.name}${authState.user.email ? ` (${authState.user.email})` : ""}`
      : configured
        ? "Sign in to upload under your own workspace."
        : "Add Cognito config to enable signed-in uploads.";
  }

  if (elements.uploadHelper) {
    elements.uploadHelper.textContent = signedIn
      ? "Files uploaded from this browser are stored under your signed-in workspace and shown only in your dashboard."
      : configured
        ? "Sign in or create an account first. Uploads, history, analytics, and delete actions stay tied to that user."
        : "Live uploads need both an API URL and Cognito settings in dashboard/config.js.";
  }
}

function goToSignInPage() {
  window.location.assign(AUTH_SIGNIN_PATH);
}

function goToSignUpPage() {
  window.location.assign(AUTH_SIGNUP_PATH);
}

function bindAuthControls() {
  if (elements.authCta && elements.authCta.dataset.bound !== "true") {
    elements.authCta.dataset.bound = "true";
    elements.authCta.addEventListener("click", () => {
      goToSignInPage();
    });
  }

  if (elements.authSecondaryCta && elements.authSecondaryCta.dataset.bound !== "true") {
    elements.authSecondaryCta.dataset.bound = "true";
    elements.authSecondaryCta.addEventListener("click", () => {
      goToSignUpPage();
    });
  }

  if (elements.signOutButton && elements.signOutButton.dataset.bound !== "true") {
    elements.signOutButton.dataset.bound = "true";
    elements.signOutButton.addEventListener("click", () => {
      clearPreviewObjectUrl();
      setSignedOutState();
      updateAuthUI();
      goToSignInPage();
    });
  }
}

function cloneDashboardState(source) {
  return JSON.parse(JSON.stringify(source));
}

async function loadDashboard() {
  apiBase =
    new URLSearchParams(window.location.search).get("api") ||
    window.RECEIPTPULSE_CONFIG?.apiBaseUrl ||
    "";
  dashboardData = cloneDashboardState(FALLBACK_DASHBOARD);
  renderDashboard();

  if (!apiBase) {
    elements.modeBadge.textContent = "Project Demo";
    elements.statusNote.textContent =
      "The live API is not configured yet, so the page is showing built-in sample data.";
    return;
  }

  if (!isAuthConfigured()) {
    elements.modeBadge.textContent = "Preview Mode";
    elements.statusNote.textContent =
      "The API is configured, but Cognito settings are missing, so the page stays in preview mode.";
    return;
  }

  if (!isSignedIn()) {
    elements.modeBadge.textContent = "Sign In Required";
    elements.statusNote.textContent =
      "Sign in to load your own receipts and dashboard data.";
    return;
  }

  elements.modeBadge.textContent = "Syncing";
  elements.statusNote.textContent =
    "Loading the latest receipts for the signed-in account.";

  try {
    await refreshLiveSnapshot();
    elements.modeBadge.textContent = "Signed In";
    elements.statusNote.textContent = "Connected to live project data.";
  } catch (error) {
    console.error("Live API mode failed, falling back to demo data.", error);
    elements.modeBadge.textContent = "Preview Mode";
    elements.statusNote.textContent =
      error.message || "Live sync failed, so the page is staying on its built-in sample state.";
  }
}

function mapReceipt(receipt) {
  return {
    receiptId: receipt.receiptId || receipt.receipt_id || "receipt",
    vendor: receipt.vendor || "Unknown Vendor",
    category: receipt.category || "Uncategorized",
    receiptLabel: receipt.receiptLabel || receipt.receipt_label || "",
    reviewStatus: receipt.reviewStatus || receipt.review_status || "UNKNOWN",
    totalAmount: receipt.totalAmount || receipt.total_amount || "0.00",
    confidenceScore: receipt.confidenceScore || receipt.confidence_score || "0.00",
    expenseMonth: receipt.expenseMonth || receipt.expense_month || "--",
    uploadedBy: receipt.uploadedBy || receipt.uploaded_by || "demo@receiptpulse.dev",
    fileName: receipt.fileName || receipt.file_name || "receipt",
    objectKey: receipt.objectKey || receipt.key || "",
    currencySymbol: receipt.currencySymbol || receipt.currency_symbol || "$",
    itemCount: Number(receipt.itemCount || receipt.item_count || 0),
    duplicateOf: receipt.duplicateOf || receipt.duplicate_of || "",
    reviewReasons: receipt.reviewReasons || receipt.review_reasons || [],
    processedAt: receipt.processedAt || receipt.processed_timestamp || "",
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeVisualText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hashString(value) {
  return Array.from(String(value || "")).reduce(
    (sum, char) => (sum * 31 + char.charCodeAt(0)) % 2147483647,
    7
  );
}

function getReceiptLabelOverride(receipt) {
  const label = String(receipt?.receiptLabel || "").trim();
  if (!label) {
    return "";
  }
  const normalized = normalizeVisualText(label);
  if (IGNORED_LABELS.has(normalized)) {
    return "";
  }
  return label;
}

function buildFallbackTheme(label) {
  const index = hashString(label) % FUN_FALLBACK_SWATCHES.length;
  const swatch = FUN_FALLBACK_SWATCHES[index];
  return {
    key: `custom-${index}`,
    icon: SAFE_FALLBACK_ICONS[index] || swatch.icon,
    color: swatch.color,
    soft: swatch.soft,
    ring: swatch.ring,
  };
}

function applySafeThemeIcon(theme) {
  if (!theme) {
    return {
      key: "receipt",
      icon: SAFE_THEME_ICONS.receipt,
      color: "#7de7ff",
      soft: "rgba(125, 231, 255, 0.18)",
      ring: "rgba(125, 231, 255, 0.42)",
    };
  }

  if (SAFE_THEME_ICONS[theme.key]) {
    return { ...theme, icon: SAFE_THEME_ICONS[theme.key] };
  }

  if (theme.key?.startsWith("custom-")) {
    const customIndex = Number(theme.key.split("-")[1]) || 0;
    return {
      ...theme,
      icon: SAFE_FALLBACK_ICONS[customIndex % SAFE_FALLBACK_ICONS.length] || theme.icon,
    };
  }

  return theme;
}

function getVisualTheme(source) {
  const normalized = normalizeVisualText(source);
  if (!normalized) {
    return {
      key: "receipt",
      icon: "🧾",
      color: "#7de7ff",
      soft: "rgba(125, 231, 255, 0.18)",
      ring: "rgba(125, 231, 255, 0.42)",
    };
  }

  const preset = VISUAL_PRESETS.find((item) =>
    item.keywords.some((keyword) => normalized.includes(keyword))
  );

  if (preset) {
    return applySafeThemeIcon(preset);
  }

  return applySafeThemeIcon(buildFallbackTheme(normalized));
}

function getReceiptDisplayLabel(receipt) {
  return getReceiptLabelOverride(receipt) || receipt.category || receipt.vendor || "Receipt";
}

function getReceiptTheme(receipt) {
  return getVisualTheme(getReceiptDisplayLabel(receipt));
}

function getRowThemeVars(theme) {
  return `--theme-accent:${theme.color};--theme-soft:${theme.soft};--theme-ring:${theme.ring};`;
}

function groupReceiptsByVisualLabel(receipts) {
  const totals = new Map();

  receipts.forEach((receipt) => {
    const label = getReceiptDisplayLabel(receipt);
    const theme = getReceiptTheme(receipt);
    const amount = Number(receipt.totalAmount || 0);
    const existing = totals.get(label) || {
      label,
      amount: 0,
      share: 0,
      theme,
    };
    existing.amount += amount;
    existing.theme = theme;
    totals.set(label, existing);
  });

  const rows = Array.from(totals.values()).sort((left, right) => right.amount - left.amount);
  const total = rows.reduce((sum, item) => sum + item.amount, 0) || 1;
  rows.forEach((row) => {
    row.share = (row.amount / total) * 100;
  });
  return rows;
}

function adaptApiPayload(analytics, receipts) {
  return {
    generatedAt: analytics.generatedAt || new Date().toISOString(),
    summary: analytics.summary || {
      receiptCount: 0,
      totalSpend: 0,
      averageConfidence: 0,
      duplicateCount: 0,
      needsReviewCount: 0,
      autoApprovedCount: 0,
    },
    categoryBreakdown: (analytics.categoryBreakdown || []).map((item) => ({
      label: item.label,
      amount: item.amount,
      share: item.share,
    })),
    topVendors: (analytics.topVendors || []).map((item) => ({
      vendor: item.vendor,
      amount: item.amount,
      share: item.share,
    })),
    monthlyTrend: analytics.monthlyTrend || [],
    reviewQueue: (analytics.reviewQueue || []).map((receipt) => ({
      receiptId: receipt.receiptId || receipt.receipt_id || "receipt",
      vendor: receipt.vendor || "Unknown Vendor",
      category: receipt.category || "Uncategorized",
      totalAmount: receipt.totalAmount || receipt.total_amount || "0.00",
      reviewStatus: receipt.reviewStatus || receipt.review_status || "UNKNOWN",
      reasons: receipt.reasons || [],
    })),
    receipts: receipts.map(mapReceipt),
    workflow: [
      {
        step: "01",
        title: "Receipt Intake",
        description: "Receipts land in S3 and metadata captures who uploaded them.",
      },
      {
        step: "02",
        title: "Field Extraction",
        description: "Textract AnalyzeExpense parses totals, merchants, dates, and line items.",
      },
      {
        step: "03",
        title: "Review Rules",
        description: "Confidence scoring and duplicate detection assign clean or review status.",
      },
      {
        step: "04",
        title: "Store Results",
        description: "Structured records are stored in DynamoDB for later queries and charts.",
      },
      {
        step: "05",
        title: "Render Dashboard",
        description: "API endpoints return the stored records to the dashboard and review controls.",
      },
    ],
    heroHeadline:
      "Low-confidence and duplicate receipts are flagged before they affect the dashboard summary.",
  };
}

function adaptSnapshotPayload(snapshot) {
  const adapted = adaptApiPayload(snapshot.analytics || {}, snapshot.receipts || []);
  adapted.generatedAt = snapshot.generatedAt || new Date().toISOString();
  return adapted;
}

function getReceiptDate(receipt) {
  if (receipt?.processedAt) {
    const processed = new Date(receipt.processedAt);
    if (!Number.isNaN(processed.getTime())) {
      return processed;
    }
  }

  if (receipt?.expenseMonth && /^\d{4}-\d{2}$/.test(receipt.expenseMonth)) {
    return new Date(`${receipt.expenseMonth}-01T00:00:00`);
  }

  return new Date(0);
}

function getReferenceDate(receipts) {
  const timestamps = receipts
    .map((receipt) => getReceiptDate(receipt).getTime())
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!timestamps.length) {
    return new Date();
  }

  return new Date(Math.max(...timestamps));
}

function matchesDashboardPeriod(receipt, period, referenceDate) {
  if (period === "all") {
    return true;
  }

  const receiptDate = getReceiptDate(receipt);
  if (Number.isNaN(receiptDate.getTime()) || receiptDate.getTime() <= 0) {
    return false;
  }

  const sameMonth =
    receiptDate.getFullYear() === referenceDate.getFullYear() &&
    receiptDate.getMonth() === referenceDate.getMonth();

  if (period === "month") {
    return sameMonth;
  }

  if (period === "year") {
    return receiptDate.getFullYear() === referenceDate.getFullYear();
  }

  const monthDistance =
    (referenceDate.getFullYear() - receiptDate.getFullYear()) * 12 +
    (referenceDate.getMonth() - receiptDate.getMonth());

  if (period === "quarter") {
    return monthDistance >= 0 && monthDistance < 3;
  }

  if (period === "half") {
    return monthDistance >= 0 && monthDistance < 6;
  }

  return true;
}

function buildSummaryFromReceipts(receipts) {
  const totalSpend = receipts.reduce((sum, receipt) => sum + Number(receipt.totalAmount || 0), 0);
  const receiptCount = receipts.length;
  const averageConfidence = receiptCount
    ? receipts.reduce((sum, receipt) => sum + Number(receipt.confidenceScore || 0), 0) / receiptCount
    : 0;
  const autoApprovedCount = receipts.filter((receipt) => receipt.reviewStatus === "AUTO_APPROVED").length;
  const needsReviewCount = receipts.filter((receipt) => receipt.reviewStatus === "NEEDS_REVIEW").length;
  const duplicateCount = receipts.filter((receipt) => receipt.reviewStatus === "DUPLICATE").length;

  return {
    receiptCount,
    totalSpend,
    averageConfidence,
    autoApprovedCount,
    needsReviewCount,
    duplicateCount,
  };
}

function buildTopVendorsFromReceipts(receipts) {
  const totals = new Map();

  receipts.forEach((receipt) => {
    const vendor = receipt.vendor || "Unknown Vendor";
    const existing = totals.get(vendor) || { vendor, amount: 0, share: 0 };
    existing.amount += Number(receipt.totalAmount || 0);
    totals.set(vendor, existing);
  });

  const rows = Array.from(totals.values()).sort((left, right) => right.amount - left.amount);
  const totalSpend = rows.reduce((sum, item) => sum + item.amount, 0) || 1;
  return rows.slice(0, 6).map((item) => ({
    ...item,
    share: Number(((item.amount / totalSpend) * 100).toFixed(1)),
  }));
}

function buildMonthlyTrendFromReceipts(receipts) {
  const grouped = new Map();

  receipts.forEach((receipt) => {
    const month = receipt.expenseMonth && receipt.expenseMonth !== "--"
      ? receipt.expenseMonth
      : `${getReceiptDate(receipt).getFullYear()}-${String(getReceiptDate(receipt).getMonth() + 1).padStart(2, "0")}`;
    const existing = grouped.get(month) || { month, amount: 0, count: 0 };
    existing.amount += Number(receipt.totalAmount || 0);
    existing.count += 1;
    grouped.set(month, existing);
  });

  return Array.from(grouped.values()).sort((left, right) => left.month.localeCompare(right.month));
}

function buildReviewQueueFromReceipts(receipts) {
  return receipts
    .filter((receipt) => receipt.reviewStatus !== "AUTO_APPROVED")
    .map((receipt) => ({
      ...receipt,
      reasons:
        receipt.reviewReasons && receipt.reviewReasons.length
          ? receipt.reviewReasons
          : ["Receipt needs one more manual check before it is treated as posted spend."],
    }))
    .sort((left, right) => getReceiptDate(right) - getReceiptDate(left));
}

function formatDashboardPeriodLabel(period) {
  switch (period) {
    case "month":
      return "this month";
    case "quarter":
      return "the last 3 months";
    case "half":
      return "the last 6 months";
    case "year":
      return "this year";
    default:
      return "all time";
  }
}

function buildRiskHeadlineForPeriod(summary) {
  if (!summary.receiptCount) {
    return "No receipts match this time range yet, so the dashboard is waiting for fresh spend data.";
  }

  if (summary.needsReviewCount) {
    return `${summary.needsReviewCount} receipt${summary.needsReviewCount === 1 ? "" : "s"} still need review in ${formatDashboardPeriodLabel(selectedDashboardPeriod)}.`;
  }

  return `Spending insight for ${formatDashboardPeriodLabel(selectedDashboardPeriod)} is clean and ready to review.`;
}

function buildDashboardView() {
  const receipts = dashboardData?.receipts || [];
  const referenceDate = getReferenceDate(receipts);
  const filteredReceipts = receipts.filter((receipt) =>
    matchesDashboardPeriod(receipt, selectedDashboardPeriod, referenceDate)
  );
  const summary = buildSummaryFromReceipts(filteredReceipts);

  return {
    receipts: filteredReceipts,
    summary,
    topVendors: buildTopVendorsFromReceipts(filteredReceipts),
    reviewQueue: buildReviewQueueFromReceipts(filteredReceipts),
    monthlyTrend: buildMonthlyTrendFromReceipts(filteredReceipts),
    heroHeadline: buildRiskHeadlineForPeriod(summary),
  };
}

function renderDashboard() {
  activeDashboardView = buildDashboardView();
  if (elements.dashboardPeriodSelect) {
    elements.dashboardPeriodSelect.value = selectedDashboardPeriod;
  }
  renderOpsStrip();
  renderUploadTimeline();
  renderSpotlight();
  renderFlipCards();
  renderUploadHistory();
  renderMetrics();
  renderCategoryChart();
  renderVendors();
  renderWorkflow();
  renderQueue();
  renderTrend();
  renderFilters();
  renderReceipts();
  setArchiveVisibility(archiveOpen);
  elements.riskHeadline.textContent = activeDashboardView?.heroHeadline || dashboardData.heroHeadline;
  syncUploadMotion();
  bindInteractiveFX();
}

function renderOpsStrip() {
  if (!elements.opsStrip) {
    return;
  }

  const summary = activeDashboardView?.summary || buildSummaryFromReceipts([]);
  const total = Math.max(Number(summary.receiptCount || 0), 1);
  const cards = [
    {
      label: "Auto Approved",
      value: `${Math.round((Number(summary.autoApprovedCount || 0) / total) * 100)}%`,
      detail: `${summary.autoApprovedCount || 0} receipts passed the rules without manual review.`,
    },
    {
      label: "Needs Review",
      value: `${Math.round((Number(summary.needsReviewCount || 0) / total) * 100)}%`,
      detail: `${summary.needsReviewCount || 0} receipts were flagged by confidence or missing-field checks.`,
    },
    {
      label: "Duplicate Alerts",
      value: `${summary.duplicateCount || 0}`,
      detail: "Potential repeats were detected before they could be counted twice.",
    },
    {
      label: "Data Freshness",
      value: formatFreshness(dashboardData.generatedAt),
      detail: "How recent the current dashboard snapshot is.",
    },
    {
      label: "Last Upload Cycle",
      value: formatProcessingDuration(uploadState.durationMs),
      detail:
        uploadState.phase === "success"
          ? "Measured from upload start to the receipt appearing in the dashboard."
          : "Timing appears after the next receipt finishes processing.",
    },
    {
      label: "Upload Status",
      value: formatUploadPhase(uploadState.phase),
      detail: uploadState.message,
    },
  ];

  elements.opsStrip.innerHTML = cards
    .map(
      (card) => `
        <article class="panel ops-card">
          <p class="eyebrow">${card.label}</p>
          <strong>${card.value}</strong>
          <span>${card.detail}</span>
        </article>
      `
    )
    .join("");
}

function renderUploadTimeline() {
  if (!elements.uploadTimeline) {
    return;
  }

  const steps = [
    ["slot", "Create Upload Slot", "Prepare a signed upload session for your receipt."],
    ["transfer", "Store In S3", "Move the selected file into the intake bucket."],
    ["textract", "Extract Fields", "Read merchant, total, date, and line items."],
    ["quality", "Run Review Rules", "Check confidence and screen for duplicates."],
    ["stored", "Update Dashboard", "Show the processed receipt in the dashboard view."],
  ];
  const order = steps.map((step) => step[0]);
  const activeIndex =
    uploadState.phase === "idle"
      ? -1
      : uploadState.phase === "success"
        ? order.length - 1
        : Math.max(order.indexOf(uploadState.stage || "slot"), 0);

  elements.uploadTimeline.innerHTML = steps
    .map(([id, title, detail], index) => {
      let tone = "pending";
      if (index < activeIndex || uploadState.phase === "success") {
        tone = "done";
      } else if (index === activeIndex && uploadState.phase !== "idle") {
        tone = uploadState.phase === "error" ? "error" : "active";
      }

      return `
        <article class="timeline-step timeline-${tone}">
          <span class="timeline-dot">${index + 1}</span>
          <div>
            <strong>${title}</strong>
            <p>${detail}</p>
          </div>
        </article>
      `;
    })
    .join("");

  elements.uploadMessage.textContent = uploadState.message;
  if (elements.uploadSubmit) {
    const busy = ["preparing", "uploading", "processing"].includes(uploadState.phase);
    const canUpload = isSignedIn();
    elements.uploadSubmit.disabled = busy || !canUpload;
    elements.uploadSubmit.textContent =
      uploadState.phase === "uploading"
        ? "Uploading Receipt..."
        : busy
          ? "Processing Receipt..."
          : canUpload
            ? "Upload And Process"
            : isAuthConfigured()
              ? "Sign In To Upload"
              : "Config Needed";
  }
}

function getUploadMotionCopy() {
  if (uploadState.phase === "error") {
    return {
      title: "Upload interrupted",
      detail: uploadState.message || "Receipt processing hit an error before the dashboard could update.",
      scene: "Check the message, then try the upload again.",
    };
  }

  if (uploadState.phase === "success") {
    return {
      title: "Dashboard refreshed",
      detail: "Your new receipt has landed in the archive, totals, review queue, and charts.",
      scene: uploadState.message,
    };
  }

  switch (uploadState.stage) {
    case "slot":
      return {
        title: uploadState.phase === "idle" ? "Waiting for upload" : "Securing upload slot",
        detail:
          uploadState.phase === "idle"
            ? "AI extraction begins after the cloud upload completes."
            : "The app is opening a signed cloud path for your file.",
        scene:
          uploadState.phase === "idle"
            ? "Pick a file to preview its upload path."
            : "Preparing a secure destination for this receipt.",
      };
    case "transfer":
      return {
        title: "Moving into cloud intake",
        detail: "The file card is traveling upward into S3 before extraction starts.",
        scene: uploadState.message,
      };
    case "textract":
      return {
        title: "Extracting merchant and totals",
        detail: "AI is reading the vendor, amount, date, and line items from the receipt.",
        scene: uploadState.message,
      };
    case "quality":
      return {
        title: "Checking confidence and duplicates",
        detail: "Review rules are verifying the extracted fields before the receipt is posted.",
        scene: uploadState.message,
      };
    case "stored":
      return {
        title: "Updating the dashboard",
        detail: "The new receipt is being folded into your charts, history, and spotlight summary.",
        scene: uploadState.message,
      };
    default:
      return {
        title: "Preparing receipt flow",
        detail: "The app is lining up the next upload stages.",
        scene: uploadState.message,
      };
  }
}

function syncUploadMotion() {
  if (!elements.uploadMotionScene) {
    return;
  }

  const currentFile = elements.fileInput?.files?.[0] || null;
  const receiptTheme = uploadState.receipt
    ? getReceiptTheme(uploadState.receipt)
    : getVisualTheme(uploadState.customLabel || currentFile?.name || uploadState.fileName || "receipt");
  const primaryLabel =
    uploadState.customLabel ||
    uploadState.receipt?.receiptLabel ||
    currentFile?.name ||
    uploadState.fileName ||
    "Next receipt";
  const motionCopy = getUploadMotionCopy();

  elements.uploadMotionScene.dataset.phase = uploadState.phase;
  elements.uploadMotionScene.dataset.stage = uploadState.stage || "slot";
  elements.uploadMotionScene.style.setProperty("--motion-accent", receiptTheme.color);
  elements.uploadMotionScene.style.setProperty("--motion-soft", receiptTheme.soft);
  elements.uploadMotionScene.style.setProperty("--motion-ring", receiptTheme.ring);

  if (elements.uploadMotionIcon) {
    elements.uploadMotionIcon.textContent = receiptTheme.icon;
  }
  if (elements.uploadMotionLabel) {
    elements.uploadMotionLabel.textContent = primaryLabel;
  }
  if (elements.uploadMotionDetail) {
    elements.uploadMotionDetail.textContent = motionCopy.scene;
  }
  if (elements.uploadMotionStage) {
    elements.uploadMotionStage.textContent = motionCopy.title;
  }
  if (elements.uploadMotionStageCopy) {
    elements.uploadMotionStageCopy.textContent = motionCopy.detail;
  }

  elements.uploadMotionReceipt?.classList.toggle(
    "motion-receipt-armed",
    Boolean(currentFile || uploadState.fileName || uploadState.receipt)
  );
}

function renderSpotlight() {
  if (!elements.spotlightTitle) {
    return;
  }

  const receipt = uploadState.receipt;
  if (!receipt) {
    elements.spotlightKicker.textContent = "Current upload";
    elements.spotlightTitle.textContent = isSignedIn()
      ? "No receipt from this browser session yet."
      : "Sign in to process receipts for your account.";
    elements.spotlightNarrative.textContent =
      isSignedIn()
        ? "Select a file from your device and this panel will show the latest processed receipt from the current session."
        : "After sign-in, uploads from this device are tied to your account and this panel shows the latest processed result.";
    elements.spotlightFacts.innerHTML = "";
    elements.spotlightPanel?.style.removeProperty("--theme-accent");
    elements.spotlightPanel?.style.removeProperty("--theme-soft");
    elements.spotlightPanel?.style.removeProperty("--theme-ring");
    return;
  }

  const theme = getReceiptTheme(receipt);
  const displayLabel = getReceiptDisplayLabel(receipt);
  elements.spotlightPanel?.setAttribute("style", getRowThemeVars(theme));
  elements.spotlightKicker.textContent = "Latest processed receipt";
  elements.spotlightTitle.innerHTML = `<span class="receipt-icon-badge">${theme.icon}</span>${escapeHtml(
    displayLabel
  )} · ${escapeHtml(formatLabel(receipt.reviewStatus))}`;
  elements.spotlightNarrative.textContent = buildSpotlightNarrative(receipt);

  const facts = [
    ["Receipt Label", displayLabel],
    ["Total", `${receipt.currencySymbol || "$"}${Number(receipt.totalAmount || 0).toFixed(2)}`],
    ["Confidence", `${Number(receipt.confidenceScore || 0).toFixed(1)}%`],
    ["Category", receipt.category],
    ["Month", receipt.expenseMonth],
    ["Items", `${receipt.itemCount || 0}`],
    ["Process Time", formatProcessingDuration(uploadState.durationMs)],
    ["Uploaded By", receipt.uploadedBy || "demo@receiptpulse.dev"],
    ["File", receipt.fileName || "receipt"],
    ["Duplicate Of", receipt.duplicateOf || "No prior match"],
  ];

  elements.spotlightFacts.innerHTML = facts
    .map(
      ([label, value]) => `
        <article class="spotlight-stat${label === "Uploaded By" || label === "File" ? " spotlight-stat--wrap" : ""}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(String(value))}</strong>
        </article>
      `
    )
    .join("");
}

function renderFlipCards() {
  if (!elements.flipGrid) {
    return;
  }

  elements.flipGrid.innerHTML = HOW_IT_WORKS.map(
    (card) => `
      <button class="flip-card" type="button" aria-pressed="false">
        <span class="flip-card-inner">
          <span class="flip-card-face flip-card-front">
            <span class="mini-label">${card.eyebrow}</span>
            <strong>${card.frontTitle}</strong>
            <p>${card.frontBody}</p>
            <span class="flip-cta">Open details</span>
          </span>
          <span class="flip-card-face flip-card-back">
            <span class="mini-label">${card.eyebrow}</span>
            <strong>${card.backTitle}</strong>
            <p>${card.backBody}</p>
            <span class="flip-cta">Return to overview</span>
          </span>
        </span>
      </button>
    `
  ).join("");

  elements.flipGrid.querySelectorAll(".flip-card").forEach((card) => {
    card.addEventListener("click", () => {
      const shouldFlip = !card.classList.contains("is-flipped");
      elements.flipGrid.querySelectorAll(".flip-card").forEach((peer) => {
        peer.classList.remove("is-flipped");
        peer.setAttribute("aria-pressed", "false");
      });
      card.classList.toggle("is-flipped", shouldFlip);
      card.setAttribute("aria-pressed", shouldFlip ? "true" : "false");
    });
  });
}

function renderUploadHistory() {
  if (!elements.historyList) {
    return;
  }

  const signedIn = isSignedIn();

  if (elements.historyToggle) {
    elements.historyToggle.textContent = `Past Uploads (${uploadHistory.length})`;
  }
  if (elements.historyDelete) {
    elements.historyDelete.disabled = !signedIn || !dashboardData?.receipts?.length;
  }
  if (elements.historyDeleteAction) {
    elements.historyDeleteAction.disabled = !signedIn || !dashboardData?.receipts?.length;
  }
  if (elements.historyClearLocal) {
    elements.historyClearLocal.disabled = uploadHistory.length === 0;
    elements.historyClearLocal.textContent = uploadHistory.length
      ? `Clear Local Only (${uploadHistory.length})`
      : "Clear Local Only";
  }

  if (!uploadHistory.length) {
    elements.historyList.innerHTML = `
      <article class="history-empty">
        ${
          signedIn
            ? "No uploads have been saved in this browser for your account yet. Process a receipt once and this drawer turns into a running activity log with status, amount, and preview context."
            : "Sign in and process a receipt to start upload history for this account."
        }
      </article>
    `;
    return;
  }

  elements.historyList.innerHTML = uploadHistory
    .map((entry) => {
      const fauxReceipt = {
        category: entry.category || "Uncategorized",
        receiptLabel: entry.receiptLabel || "",
        vendor: entry.vendor || "Unknown Vendor",
      };
      const theme = getReceiptTheme(fauxReceipt);
      const displayLabel = getReceiptDisplayLabel(fauxReceipt);

      return `
        <article class="history-item panel" style="${getRowThemeVars(theme)}">
          ${
            entry.previewDataUrl
              ? `<img class="history-thumb" src="${entry.previewDataUrl}" alt="${entry.fileName} preview" />`
              : `<div class="history-thumb-placeholder">${entry.previewType === "pdf" ? "PDF" : "FILE"}</div>`
          }
          <div class="history-meta">
            <div class="history-topline">
              <span class="history-name"><span class="receipt-icon-badge">${theme.icon}</span>${escapeHtml(entry.fileName)}</span>
              <span class="status-tag status-${entry.reviewStatus.toLowerCase().replace(/_/g, "-")}">${formatLabel(entry.reviewStatus)}</span>
            </div>
            <div class="history-subline">
              <strong>${escapeHtml(displayLabel)}</strong>
              <span class="muted">${entry.currencySymbol}${Number(entry.totalAmount || 0).toFixed(2)}</span>
            </div>
            <div class="history-subline">
              <span class="receipt-mini-pill">${theme.icon} ${escapeHtml(entry.vendor)}</span>
              <span class="muted">${formatRelativeTime(entry.processedAt)}</span>
              <span class="muted">${formatProcessingDuration(entry.durationMs)}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMetrics() {
  const summary = activeDashboardView?.summary || buildSummaryFromReceipts([]);
  const metrics = [
    {
      label: "Receipts Processed",
      value: summary.receiptCount,
      suffix: "",
    },
    {
      label: "Total Spend Captured",
      value: summary.totalSpend,
      prefix: "$",
      decimals: 2,
    },
    {
      label: "OCR Confidence",
      value: summary.averageConfidence,
      suffix: "%",
      decimals: 1,
    },
    {
      label: "Posted Cleanly",
      value: summary.autoApprovedCount,
      suffix: "",
    },
    {
      label: "Needs Review",
      value: summary.needsReviewCount,
      suffix: "",
    },
    {
      label: "Duplicate Alerts",
      value: summary.duplicateCount,
      suffix: "",
    },
  ];

  elements.metricsGrid.innerHTML = metrics
    .map(
      (metric) => `
        <article class="panel metric-card">
          <p class="eyebrow">${metric.label}</p>
          <strong data-counter="${metric.value}" data-prefix="${metric.prefix || ""}" data-suffix="${metric.suffix || ""}" data-decimals="${metric.decimals || 0}">
            ${metric.prefix || ""}0${metric.suffix || ""}
          </strong>
          <span>${metricDescription(metric.label)}</span>
        </article>
      `
    )
    .join("");

  animateCounters();
}

function renderCategoryChart() {
  const grouped = groupReceiptsByVisualLabel(activeDashboardView?.receipts || []);

  if (!grouped.length) {
    elements.categoryChart.innerHTML =
      '<p class="muted">No category data is available yet.</p>';
    return;
  }

  const maxAmount = Math.max(...grouped.map((item) => item.amount), 1);
  elements.categoryChart.innerHTML = grouped
    .map(
      (item) => `
        <div class="chart-row themed-card" data-label="${escapeHtml(item.label)}" style="${getRowThemeVars(item.theme)}">
          <div class="chart-meta">
            <strong><span class="receipt-icon-badge">${item.theme.icon}</span>${escapeHtml(item.label)}</strong>
            <span class="muted">$${Number(item.amount).toFixed(2)} - ${item.share.toFixed(1)}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${(item.amount / maxAmount) * 100}%; background:${item.theme.color}"></div>
          </div>
        </div>
      `
    )
    .join("");
}

function renderVendors() {
  const topVendors = activeDashboardView?.topVendors || [];
  const scopedReceipts = activeDashboardView?.receipts || [];

  if (!topVendors.length) {
    elements.vendorList.innerHTML =
      '<p class="muted">Vendor concentration appears once receipts are available inside this range.</p>';
    return;
  }

  elements.vendorList.innerHTML = topVendors
    .map((vendor) => {
      const matchingReceipt =
        scopedReceipts.find((receipt) => receipt.vendor === vendor.vendor) || vendor;
      const theme = getReceiptTheme(matchingReceipt);
      return `
        <div class="vendor-row" style="${getRowThemeVars(theme)}">
          <div class="vendor-meta">
            <strong><span class="receipt-icon-badge">${theme.icon}</span>${escapeHtml(vendor.vendor)}</strong>
            <span class="vendor-share">${vendor.share}% of spend</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${vendor.share}%; background:${theme.color}"></div>
          </div>
          <span class="muted">$${Number(vendor.amount).toFixed(2)}</span>
        </div>
      `;
    })
    .join("");
}

function renderWorkflow() {
  elements.workflowTrack.innerHTML = dashboardData.workflow
    .map(
      (node) => `
        <article class="workflow-node">
          <span class="workflow-step">${node.step}</span>
          <h4>${node.title}</h4>
          <p>${node.description}</p>
        </article>
      `
    )
    .join("");
}

function renderQueue() {
  const reviewQueue = activeDashboardView?.reviewQueue || [];

  if (!reviewQueue.length) {
    elements.queueList.innerHTML = '<p class="muted">No receipts are waiting for review in this range.</p>';
    return;
  }

  elements.queueList.innerHTML = reviewQueue
    .map((receipt) => {
      const theme = getReceiptTheme(receipt);
      const displayLabel = getReceiptDisplayLabel(receipt);
      return `
        <article class="queue-item" style="${getRowThemeVars(theme)}">
          <div class="queue-header">
            <strong><span class="receipt-icon-badge">${theme.icon}</span>${escapeHtml(displayLabel)}</strong>
            <span class="status-tag status-${receipt.reviewStatus.toLowerCase().replace(/_/g, "-")}">${formatLabel(receipt.reviewStatus)}</span>
          </div>
          <div class="receipt-line">
            <span class="receipt-mini-pill">${theme.icon} ${escapeHtml(receipt.vendor)}</span>
            <span>$${Number(receipt.totalAmount).toFixed(2)}</span>
          </div>
          <ul class="reason-list">
            ${(receipt.reasons || []).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
          </ul>
        </article>
      `;
    })
    .join("");
}

function renderTrend() {
  if (!elements.trendBars || !elements.expenseMonthSelect || !elements.expenseDonut || !elements.expenseLegend) {
    return;
  }

  const monthlyTrend = activeDashboardView?.monthlyTrend || [];
  const scopedReceipts = activeDashboardView?.receipts || [];

  if (!monthlyTrend.length) {
    elements.trendBars.innerHTML =
      '<p class="muted">Monthly throughput appears once receipts exist in this time range.</p>';
    elements.expenseMonthSelect.innerHTML = '<option value="">No months yet</option>';
    elements.expenseMonthSelect.disabled = true;
    elements.expenseDonut.classList.add("expense-donut-empty");
    elements.expenseDonut.style.background = "";
    elements.expenseDonut.innerHTML = `
      <div class="expense-donut-center">
        <span>Month view</span>
        <strong>Awaiting data</strong>
      </div>
    `;
    elements.expenseLegend.innerHTML =
      '<p class="muted expense-empty-note">Process receipts to unlock spend-by-category view.</p>';
    return;
  }

  const availableMonths = Array.from(
    new Set(
      scopedReceipts
        .map((receipt) => receipt.expenseMonth)
        .filter((month) => month && month !== "--")
    )
  ).sort((left, right) => right.localeCompare(left));

  if (!selectedExpenseMonth || (selectedExpenseMonth !== "__all" && !availableMonths.includes(selectedExpenseMonth))) {
    selectedExpenseMonth = availableMonths[0] || "__all";
  }

  const monthOptions = [
    { value: "__all", label: "All Months" },
    ...availableMonths.map((month) => ({ value: month, label: formatMonthLabel(month) })),
  ];
  elements.expenseMonthSelect.disabled = monthOptions.length === 1;
  elements.expenseMonthSelect.innerHTML = monthOptions
    .map(
      (option) => `
        <option value="${option.value}" ${option.value === selectedExpenseMonth ? "selected" : ""}>
          ${option.label}
        </option>
      `
    )
    .join("");

  const maxAmount = Math.max(...monthlyTrend.map((item) => item.amount), 1);
  elements.trendBars.innerHTML = monthlyTrend
    .map(
      (item) => `
        <div class="trend-bar ${item.month === selectedExpenseMonth ? "trend-bar-active" : ""}">
          <div class="trend-meta">
            <strong>${formatMonthLabel(item.month)}</strong>
            <span class="muted">$${Number(item.amount).toFixed(2)} - ${item.count} receipts</span>
          </div>
          <div class="trend-track">
            <div class="trend-fill" style="width:${(item.amount / maxAmount) * 100}%"></div>
          </div>
        </div>
      `
    )
    .join("");

  renderExpenseDonut();
}

function renderFilters() {
  elements.filterRow.innerHTML = FILTERS.map(
    (filter) => `
      <button type="button" class="filter-chip ${filter === activeFilter ? "active" : ""}" data-filter="${filter}">
        ${formatLabel(filter)}
      </button>
    `
  ).join("");

  elements.filterRow.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      renderFilters();
      renderReceipts();
    });
  });
}

function renderReceipts() {
  const rows = (activeDashboardView?.receipts || []).filter((receipt) =>
    activeFilter === "ALL" ? true : receipt.reviewStatus === activeFilter
  );

  if (!rows.length) {
    elements.receiptsBody.innerHTML =
      '<tr><td colspan="7" class="muted receipt-empty">No receipts match this filter.</td></tr>';
    return;
  }

  const latestId = uploadState.receipt?.receiptId || "";

  elements.receiptsBody.innerHTML = rows
    .map((receipt) => {
      const theme = getReceiptTheme(receipt);
      const displayLabel = getReceiptDisplayLabel(receipt);
      const hasOverride = Boolean(getReceiptLabelOverride(receipt));
      return `
        <tr class="${receipt.receiptId === latestId ? "receipt-highlight-row" : ""}" style="${getRowThemeVars(theme)}">
          <td>
            <div class="receipt-stack">
              <strong class="receipt-mainline"><span class="receipt-icon-badge">${theme.icon}</span>${escapeHtml(displayLabel)}</strong>
              <span class="muted">${escapeHtml(receipt.fileName || receipt.receiptId || "receipt")}</span>
            </div>
          </td>
          <td><span class="receipt-mini-pill">${theme.icon} ${escapeHtml(receipt.vendor)}</span></td>
          <td>
            <div class="category-cell">
              <span class="receipt-mini-pill">${theme.icon} ${escapeHtml(displayLabel)}</span>
              ${
                hasOverride
                  ? `<span class="receipt-detected muted">AI detected: ${escapeHtml(receipt.category)}</span>`
                  : ""
              }
            </div>
          </td>
          <td>
            <span class="status-tag status-${receipt.reviewStatus.toLowerCase().replace(/_/g, "-")}">
              ${formatLabel(receipt.reviewStatus)}
            </span>
          </td>
          <td>${receipt.currencySymbol || "$"}${Number(receipt.totalAmount).toFixed(2)}</td>
          <td>${Number(receipt.confidenceScore).toFixed(1)}%</td>
          <td>${receipt.expenseMonth}</td>
        </tr>
      `;
    })
    .join("");
}

function animateCounters() {
  const counters = document.querySelectorAll("[data-counter]");
  counters.forEach((counter) => {
    const target = Number(counter.dataset.counter);
    const prefix = counter.dataset.prefix || "";
    const suffix = counter.dataset.suffix || "";
    const decimals = Number(counter.dataset.decimals || 0);
    const duration = 900;
    const start = performance.now();

    const update = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const current = target * eased;
      counter.textContent = `${prefix}${current.toFixed(decimals)}${suffix}`;
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);
  });
}

function metricDescription(label) {
  switch (label) {
    case "Receipts Processed":
      return "Uploaded files that made it through extraction and storage.";
    case "Total Spend Captured":
      return "Total value captured from the processed receipt set.";
    case "OCR Confidence":
      return "Average extraction confidence from the OCR step.";
    case "Posted Cleanly":
      return "Receipts that passed the rule checks without review.";
    case "Needs Review":
      return "Receipts flagged for low confidence, missing data, or duplicates.";
    case "Duplicate Alerts":
      return "Potential repeat uploads detected by the duplicate check.";
    default:
      return "";
  }
}

function buildSpotlightNarrative(receipt) {
  const reasons = receipt.reviewReasons?.length
    ? ` Review reasons: ${receipt.reviewReasons.join(" ")}`
    : "";
  const labelOverride = getReceiptLabelOverride(receipt);
  const labelText = labelOverride
    ? ` It is being styled as ${labelOverride} because you overrode the detected category.`
    : "";
  return `${receipt.vendor} was classified as ${receipt.category} with a ${Number(
    receipt.confidenceScore || 0
  ).toFixed(1)}% confidence score and routed to ${formatLabel(
    receipt.reviewStatus
  ).toLowerCase()} by the review rules.${labelText}${reasons}`;
}

function formatLabel(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatUploadPhase(phase) {
  if (phase === "preparing") return "Securing";
  if (phase === "uploading") return "Uploading";
  if (phase === "processing") return "Processing";
  if (phase === "success") return "Complete";
  if (phase === "error") return "Needs Retry";
  return "Ready";
}

function formatFreshness(isoString) {
  const stamp = new Date(isoString).getTime();
  if (!stamp) {
    return "Unknown";
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - stamp) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  return `${Math.round(diffMinutes / 60)} hours ago`;
}

function formatRelativeTime(isoString) {
  return formatFreshness(isoString);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatProcessingDuration(durationMs) {
  if (!durationMs || durationMs < 1) {
    return "Pending";
  }

  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}

function guessContentType(file) {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function isSupportedFile(file) {
  return ["application/pdf", "image/png", "image/jpeg"].includes(guessContentType(file));
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function bindInteractiveFX() {
  bindGlowTargets();
  observeRevealTargets();
}

function bindGlowTargets() {
  document
    .querySelectorAll(
      ".panel, .glass-card, .vendor-row, .queue-item, .workflow-node, .metric-card, .ops-card, .spotlight-stat, .flip-card, .timeline-step, .dropzone, .chart-row, .legend-row"
    )
    .forEach((element) => {
      if (element.dataset.fxBound === "true") {
        return;
      }

      element.dataset.fxBound = "true";

      element.addEventListener("pointermove", (event) => {
        const bounds = element.getBoundingClientRect();
        const glowX = ((event.clientX - bounds.left) / bounds.width) * 100;
        const glowY = ((event.clientY - bounds.top) / bounds.height) * 100;
        element.style.setProperty("--glow-x", `${glowX}%`);
        element.style.setProperty("--glow-y", `${glowY}%`);
      });

      element.addEventListener("pointerenter", () => {
        element.classList.add("is-hovered");
        document.body.classList.add("cursor-hover");
        if (element.matches("button, a, .primary-button, .secondary-button, .ghost-link, .filter-chip")) {
          document.body.classList.add("cursor-cta");
        } else {
          document.body.classList.remove("cursor-cta");
        }
      });

      element.addEventListener("pointerleave", () => {
        element.classList.remove("is-hovered");
        document.body.classList.remove("cursor-hover");
        document.body.classList.remove("cursor-cta");
      });
    });
}

function observeRevealTargets() {
  const targets = document.querySelectorAll(
    ".panel, .glass-card, .vendor-row, .queue-item, .workflow-node, .metric-card, .ops-card, .spotlight-stat, .flip-card, .timeline-step, .chart-row, .legend-row"
  );

  targets.forEach((target) => {
    target.classList.remove("reveal-ready");
    target.classList.add("is-visible");
  });
}

function bindUploadControls() {
  if (!elements.uploadForm || elements.uploadForm.dataset.bound === "true") {
    return;
  }

  elements.uploadForm.dataset.bound = "true";

  elements.heroUploadTrigger?.addEventListener("click", () => {
    if (isAuthConfigured() && !isSignedIn()) {
      goToSignInPage();
      return;
    }
    document.querySelector("#uploadLab")?.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.fileInput?.click();
  });

  elements.fileInput.addEventListener("change", () => {
    const file = elements.fileInput.files[0] || null;
    elements.fileMeta.textContent = file
      ? `${file.name} - ${formatFileSize(file.size)} - ready for upload`
      : "No receipt selected yet.";
    void updatePreviewFromFile(file);
  });

  elements.uploadName?.addEventListener("input", () => {
    void updatePreviewFromFile(elements.fileInput.files[0] || null);
  });

  elements.uploadForm.addEventListener("submit", handleUpload);

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropzone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    elements.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropzone.classList.remove("is-dragging");
    });
  });

  elements.dropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0] || null;
    if (!file) {
      return;
    }

    if (typeof DataTransfer !== "undefined") {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      elements.fileInput.files = transfer.files;
    }

    elements.fileMeta.textContent = `${file.name} - ${formatFileSize(file.size)} - ready for upload`;
    void updatePreviewFromFile(file);
  });
}

async function handleUpload(event) {
  event.preventDefault();

  if (!apiBase) {
    setUploadState("error", "slot", "Live API is not configured, so uploads cannot run here.");
    return;
  }

  if (!isSignedIn()) {
    setUploadState("error", "slot", "Sign in to upload receipts for your account.");
    return;
  }

  const file = elements.fileInput.files[0];
  if (!file) {
    setUploadState("error", "slot", "Choose a receipt file first.");
    return;
  }

  if (!isSupportedFile(file)) {
    setUploadState("error", "slot", "Use a PDF, PNG, JPG, or JPEG receipt.");
    return;
  }

  const receiptLabel = elements.uploadName.value.trim();

  try {
    uploadState = {
      ...uploadState,
      objectKey: "",
      receipt: null,
      customLabel: receiptLabel,
      fileName: file.name,
      startedAt: Date.now(),
      durationMs: null,
    };
    setUploadState("preparing", "slot", "Requesting a secure upload slot for your account.");

    const session = await requestUploadSession(file, receiptLabel);
    uploadState.objectKey = session.objectKey;

    setUploadState("uploading", "transfer", "Uploading the receipt into the S3 intake bucket.");
    await uploadToS3(session, file);

    setUploadState("processing", "textract", "Receipt uploaded. AI extraction is running.");
    const processedReceipt = await pollUntilProcessed(
      session.objectKey,
      session.pollAfterMs || POLL_INTERVAL_MS
    );

    processedReceipt.receiptLabel = receiptLabel || processedReceipt.receiptLabel;
    uploadState.receipt = processedReceipt;
    uploadState.durationMs = Math.max(0, Date.now() - uploadState.startedAt);
    pendingVisualRefresh = {
      label: getReceiptDisplayLabel(processedReceipt),
      theme: getReceiptTheme(processedReceipt),
    };
    setUploadState("processing", "stored", "Updating charts and history with your new receipt.");
    await refreshLiveSnapshot();
    setUploadState("success", "stored", "Receipt processed and added to the console.");
    addUploadHistoryEntry(file, processedReceipt, receiptLabel);
    triggerSuccessBurst(elements.uploadSubmit);
    scrollToProcessedResult();
  } catch (error) {
    console.error("Upload failed.", error);
    setUploadState("error", uploadState.stage || "transfer", error.message || "Upload failed.");
  }
}

async function requestUploadSession(file, receiptLabel) {
  const response = await apiFetch("/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: guessContentType(file),
      uploaderName: receiptLabel,
      receiptLabel,
    }),
  });

  if (!response.ok) {
    throw new Error(`Unable to create upload session (${response.status}).`);
  }

  return response.json();
}

async function uploadToS3(session, file) {
  const headers = new Headers();
  Object.entries(session.headers || {}).forEach(([key, value]) => headers.set(key, value));
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", guessContentType(file));
  }

  const response = await fetch(session.uploadUrl, {
    method: "PUT",
    headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload to S3 failed (${response.status}).`);
  }
}

async function pollUntilProcessed(objectKey, firstDelay) {
  let lastMessage = "Receipt is still processing.";

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
    await sleep(attempt === 1 ? firstDelay : POLL_INTERVAL_MS);

    const response = await apiFetch(`/uploads/status?key=${encodeURIComponent(objectKey)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Status polling failed (${response.status}).`);
    }

    const payload = await response.json();
    lastMessage = payload.message || lastMessage;

    if (payload.status === "PROCESSED" && payload.receipt) {
      return mapReceipt(payload.receipt);
    }

    const stage = payload.stage === "stored" ? "quality" : payload.stage || "textract";
    setUploadState("processing", stage, lastMessage);
  }

  throw new Error(lastMessage);
}

async function refreshLiveSnapshot() {
  const snapshotResponse = await apiFetch("/snapshot", {
    cache: "no-store",
  });
  if (!snapshotResponse.ok) {
    throw new Error(`Snapshot request failed with status ${snapshotResponse.status}`);
  }

  const snapshotPayload = await snapshotResponse.json();
  dashboardData = adaptSnapshotPayload(snapshotPayload);

  if (uploadState.receipt?.objectKey) {
    const matched = dashboardData.receipts.find(
      (receipt) => receipt.objectKey === uploadState.receipt.objectKey
    );
    if (matched) {
      uploadState.receipt = matched;
    } else {
      uploadState.receipt = null;
      uploadState.durationMs = null;
    }
  }

  renderDashboard();

  if (pendingVisualRefresh && uploadState.receipt) {
    playDashboardArrivalEffects(uploadState.receipt, pendingVisualRefresh);
    pendingVisualRefresh = null;
  }
}

function setUploadState(phase, stage, message) {
  uploadState = {
    ...uploadState,
    phase,
    stage,
    message,
  };
  renderOpsStrip();
  renderUploadTimeline();
  renderSpotlight();
  syncUploadMotion();
}

function loadUploadHistory() {
  try {
    const raw = window.localStorage.getItem(getHistoryStorageKey());
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Unable to read upload history.", error);
    return [];
  }
}

function persistUploadHistory() {
  try {
    window.localStorage.setItem(getHistoryStorageKey(), JSON.stringify(uploadHistory));
  } catch (error) {
    console.warn("Unable to persist upload history.", error);
  }
}

function addUploadHistoryEntry(file, receipt, receiptLabel = "") {
  const previewType = latestPreview?.type || (guessContentType(file) === "application/pdf" ? "pdf" : "file");
  const entry = {
    id: receipt.receiptId || `${Date.now()}`,
    fileName: receipt.fileName || file.name,
    vendor: receipt.vendor || "Unknown Vendor",
    receiptLabel: receipt.receiptLabel || receiptLabel || "",
    category: receipt.category || "Uncategorized",
    reviewStatus: receipt.reviewStatus || "UNKNOWN",
    totalAmount: receipt.totalAmount || "0.00",
    currencySymbol: receipt.currencySymbol || "$",
    processedAt: new Date().toISOString(),
    durationMs: uploadState.durationMs || 0,
    previewType,
    previewDataUrl: latestPreview?.previewDataUrl || "",
  };

  uploadHistory = [entry, ...uploadHistory.filter((item) => item.id !== entry.id)].slice(
    0,
    MAX_HISTORY_ITEMS
  );
  persistUploadHistory();
  renderUploadHistory();
}

async function updatePreviewFromFile(file) {
  if (!elements.previewFrame || !elements.previewMeta) {
    return;
  }

  if (!file) {
    clearPreviewObjectUrl();
    latestPreview = null;
    elements.previewFrame.innerHTML = `
      <div class="preview-empty">
        <span class="mini-label">Preview</span>
        <strong>Receipt preview will appear here</strong>
        <p>Image receipts show a live thumbnail. PDFs get a document preview card with file metadata.</p>
      </div>
    `;
    elements.previewMeta.innerHTML = `
      <article class="preview-stat">
        <span>Status</span>
        <strong>Awaiting file</strong>
      </article>
      <article class="preview-stat">
        <span>Theme</span>
        <strong>Auto detect</strong>
      </article>
      <article class="preview-stat">
        <span>Override</span>
        <strong>Add a label for custom styling</strong>
      </article>
    `;
    syncUploadMotion();
    return;
  }

  latestPreview = await createPreviewPayload(file);
  const labelOverride = elements.uploadName?.value.trim() || "";
  const theme = getVisualTheme(labelOverride || file.name);

  if (latestPreview.type === "image" && latestPreview.objectUrl) {
    elements.previewFrame.innerHTML = `<img class="preview-image" src="${latestPreview.objectUrl}" alt="${file.name} preview" />`;
  } else {
    elements.previewFrame.innerHTML = `
      <div class="preview-pdf-card">
        <span class="mini-label">Document preview</span>
        <strong>${file.name}</strong>
        <p>This receipt will upload directly to S3, then Textract will read it and send the structured result back into the console.</p>
      </div>
    `;
  }

  elements.previewMeta.innerHTML = `
    <article class="preview-stat">
      <span>Status</span>
      <strong>Ready to upload</strong>
    </article>
    <article class="preview-stat">
      <span>Theme</span>
      <strong>${theme.icon} ${escapeHtml(labelOverride || "Auto detect from receipt")}</strong>
    </article>
    <article class="preview-stat">
      <span>Size</span>
      <strong>${formatFileSize(file.size)} · ${latestPreview.type === "image" ? "Image" : "PDF"}</strong>
    </article>
  `;
  syncUploadMotion();
}

async function createPreviewPayload(file) {
  clearPreviewObjectUrl();
  const contentType = guessContentType(file);

  if (contentType.startsWith("image/")) {
    previewObjectUrl = URL.createObjectURL(file);
    let previewDataUrl = "";
    if (file.size <= 380000) {
      previewDataUrl = await fileToDataUrl(file);
    }

    return {
      type: "image",
      objectUrl: previewObjectUrl,
      previewDataUrl,
    };
  }

  return {
    type: "pdf",
    objectUrl: "",
    previewDataUrl: "",
  };
}

function clearPreviewObjectUrl() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = "";
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Preview generation failed."));
    reader.readAsDataURL(file);
  });
}

function bindHistoryControls() {
  if (!elements.historyToggle || elements.historyToggle.dataset.bound === "true") {
    return;
  }

  elements.historyToggle.dataset.bound = "true";
  elements.historyToggle.addEventListener("click", () => {
    document.body.classList.toggle("history-open");
    const isOpen = document.body.classList.contains("history-open");
    elements.historyDrawer?.setAttribute("aria-hidden", isOpen ? "false" : "true");
    if (elements.historyScrim) {
      elements.historyScrim.hidden = !isOpen;
    }
  });

  elements.historyClose?.addEventListener("click", closeHistoryDrawer);
  elements.historyDelete?.addEventListener("click", () => {
    elements.historyDeleteAction?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  elements.historyDeleteAction?.addEventListener("click", clearStoredReceiptData);
  elements.historyClearLocal?.addEventListener("click", clearUploadHistory);
  elements.historyScrim?.addEventListener("click", closeHistoryDrawer);
  elements.confirmAccept?.addEventListener("click", () => closeConfirmDialog(true));
  elements.confirmCancel?.addEventListener("click", () => closeConfirmDialog(false));
  elements.confirmScrim?.addEventListener("click", () => closeConfirmDialog(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!elements.confirmModal?.hidden) {
        closeConfirmDialog(false);
        return;
      }
      closeHistoryDrawer();
    }
  });
}

function closeHistoryDrawer() {
  document.body.classList.remove("history-open");
  elements.historyDrawer?.setAttribute("aria-hidden", "true");
  if (elements.historyScrim) {
    elements.historyScrim.hidden = true;
  }
}

function closeConfirmDialog(confirmed = false) {
  const { confirmModal, confirmScrim } = elements;
  if (!confirmModal || !confirmScrim) {
    if (confirmState.resolve) {
      const resolve = confirmState.resolve;
      confirmState.resolve = null;
      resolve(confirmed);
    }
    return;
  }

  confirmModal.classList.remove("is-open");
  confirmScrim.classList.remove("is-open");
  confirmModal.setAttribute("aria-hidden", "true");

  const resolve = confirmState.resolve;
  const previousFocus = confirmState.previousFocus;
  confirmState.resolve = null;
  confirmState.previousFocus = null;

  window.setTimeout(() => {
    confirmModal.hidden = true;
    confirmScrim.hidden = true;
  }, 180);

  if (previousFocus?.focus) {
    previousFocus.focus();
  }

  if (resolve) {
    resolve(confirmed);
  }
}

function openConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
} = {}) {
  const {
    confirmModal,
    confirmScrim,
    confirmTitle,
    confirmBody,
    confirmAccept,
    confirmCancel,
  } = elements;

  if (!confirmModal || !confirmScrim || !confirmTitle || !confirmBody || !confirmAccept || !confirmCancel) {
    return Promise.resolve(window.confirm(message || title || "Please confirm this action."));
  }

  if (confirmState.resolve) {
    closeConfirmDialog(false);
  }

  confirmState.previousFocus = document.activeElement;
  confirmTitle.textContent = title || "Confirm action";
  confirmBody.textContent = message || "";
  confirmAccept.textContent = confirmLabel;
  confirmCancel.textContent = cancelLabel;
  confirmModal.hidden = false;
  confirmScrim.hidden = false;
  confirmModal.setAttribute("aria-hidden", "false");

  window.requestAnimationFrame(() => {
    confirmModal.classList.add("is-open");
    confirmScrim.classList.add("is-open");
    confirmCancel.focus();
  });

  return new Promise((resolve) => {
    confirmState.resolve = resolve;
  });
}

async function clearUploadHistory() {
  if (!uploadHistory.length) {
    return;
  }

  const shouldClear = await openConfirmDialog({
    title: "Clear local upload history?",
    message:
      "This only removes browser-side preview history from this device. Stored receipts in AWS stay unchanged.",
    confirmLabel: "Clear local history",
  });
  if (!shouldClear) {
    return;
  }

  uploadHistory = [];
  persistUploadHistory();
  renderUploadHistory();
}

async function clearStoredReceiptData() {
  if (!apiBase || !isSignedIn()) {
    return;
  }

  const fromDate = elements.historyRangeStart?.value || "";
  const toDate = elements.historyRangeEnd?.value || "";

  if (fromDate && toDate && fromDate > toDate) {
    window.alert("Choose a valid date range. The start date must be before the end date.");
    return;
  }

  const rangeLabel = buildRangeLabel(fromDate, toDate);
  const shouldDelete = await openConfirmDialog({
    title: `Delete stored receipts for ${rangeLabel}?`,
    message:
      "This will remove matching receipts from the archive, charts, totals, and review queue.",
    confirmLabel: "Delete stored receipts",
  });
  if (!shouldDelete) {
    return;
  }

  try {
    toggleStoredDeleteBusy(true);
    const response = await apiFetch("/receipts/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate, toDate }),
    });

    if (!response.ok) {
      throw new Error(`Unable to delete stored receipts (${response.status}).`);
    }

    const payload = await response.json();
    pruneLocalHistoryByRange(fromDate, toDate);
    if (uploadState.receipt && matchesDateRange(uploadState.receipt.processedAt, fromDate, toDate)) {
      uploadState.receipt = null;
      uploadState.durationMs = null;
      setUploadState("idle", "slot", "Stored receipts were deleted for the selected period.");
    }
    await refreshLiveSnapshot();
    renderUploadHistory();
    elements.statusNote.textContent = payload.message || "Stored receipts deleted.";
    closeHistoryDrawer();
  } catch (error) {
    console.error("Stored receipt deletion failed.", error);
    window.alert(error.message || "Stored receipt deletion failed.");
  } finally {
    toggleStoredDeleteBusy(false);
  }
}

function pruneLocalHistoryByRange(fromDate, toDate) {
  uploadHistory = uploadHistory.filter(
    (entry) => !matchesDateRange(entry.processedAt, fromDate, toDate)
  );
  persistUploadHistory();
}

function matchesDateRange(isoString, fromDate, toDate) {
  if (!isoString) {
    return !fromDate && !toDate;
  }

  const stamp = new Date(isoString);
  if (Number.isNaN(stamp.getTime())) {
    return false;
  }

  if (fromDate) {
    const start = new Date(`${fromDate}T00:00:00`);
    if (stamp < start) {
      return false;
    }
  }

  if (toDate) {
    const end = new Date(`${toDate}T23:59:59.999`);
    if (stamp > end) {
      return false;
    }
  }

  return true;
}

function buildRangeLabel(fromDate, toDate) {
  if (fromDate && toDate) {
    return `${fromDate} to ${toDate}`;
  }
  if (fromDate) {
    return `${fromDate} onward`;
  }
  if (toDate) {
    return `everything up to ${toDate}`;
  }
  return "all time";
}

function toggleStoredDeleteBusy(isBusy) {
  if (elements.historyDeleteAction) {
    elements.historyDeleteAction.disabled = isBusy;
    elements.historyDeleteAction.textContent = isBusy
      ? "Deleting Stored Receipts..."
      : "Delete Stored Receipts";
  }
  if (elements.historyDelete) {
    elements.historyDelete.disabled = isBusy || !isSignedIn() || !dashboardData?.receipts?.length;
  }
}

function bindArchiveControls() {
  if (elements.dashboardPeriodSelect && elements.dashboardPeriodSelect.dataset.bound !== "true") {
    elements.dashboardPeriodSelect.dataset.bound = "true";
    elements.dashboardPeriodSelect.addEventListener("change", (event) => {
      selectedDashboardPeriod = event.target.value;
      renderDashboard();
    });
  }

  if (elements.archiveToggle && elements.archiveToggle.dataset.bound !== "true") {
    elements.archiveToggle.dataset.bound = "true";
    elements.archiveToggle.addEventListener("click", () => {
      setArchiveVisibility(!archiveOpen, true);
    });
  }

  if (elements.archiveClose && elements.archiveClose.dataset.bound !== "true") {
    elements.archiveClose.dataset.bound = "true";
    elements.archiveClose.addEventListener("click", () => {
      setArchiveVisibility(false);
    });
  }

  if (elements.expenseMonthSelect && elements.expenseMonthSelect.dataset.bound !== "true") {
    elements.expenseMonthSelect.dataset.bound = "true";
    elements.expenseMonthSelect.addEventListener("change", (event) => {
      selectedExpenseMonth = event.target.value;
      renderTrend();
    });
  }
}

function setArchiveVisibility(isOpen, scrollIntoView = false) {
  archiveOpen = Boolean(isOpen);
  if (!elements.archivePanel) {
    return;
  }

  elements.archivePanel.classList.toggle("archive-collapsed", !archiveOpen);
  elements.archivePanel.setAttribute("aria-expanded", archiveOpen ? "true" : "false");

  if (elements.archiveToggle) {
    elements.archiveToggle.textContent = archiveOpen ? "Hide Receipts" : "All Receipts";
    elements.archiveToggle.setAttribute("aria-expanded", archiveOpen ? "true" : "false");
  }

  if (archiveOpen && scrollIntoView) {
    elements.archivePanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderExpenseDonut() {
  const visibleReceipts = (activeDashboardView?.receipts || []).filter((receipt) => {
    if (selectedExpenseMonth === "__all") {
      return true;
    }
    return receipt.expenseMonth === selectedExpenseMonth;
  });

  if (!visibleReceipts.length) {
    elements.expenseDonut.classList.add("expense-donut-empty");
    elements.expenseDonut.style.background = "";
    elements.expenseDonut.innerHTML = `
      <div class="expense-donut-center">
        <span>Month view</span>
        <strong>No spend</strong>
      </div>
    `;
    elements.expenseLegend.innerHTML =
      '<p class="muted expense-empty-note">No receipts were processed in this month yet.</p>';
    return;
  }

  const slices = groupReceiptsByVisualLabel(visibleReceipts);
  const totalAmount = slices.reduce((sum, item) => sum + item.amount, 0) || 1;

  let currentStop = 0;
  const gradientStops = slices
    .map((slice) => {
      const ratio = (slice.amount / totalAmount) * 100;
      const start = currentStop;
      currentStop += ratio;
      slice.share = ratio;
      return `${slice.theme.color} ${start.toFixed(2)}% ${currentStop.toFixed(2)}%`;
    })
    .join(", ");

  elements.expenseDonut.classList.remove("expense-donut-empty");
  elements.expenseDonut.style.background = `conic-gradient(${gradientStops})`;
  elements.expenseDonut.innerHTML = `
    <div class="expense-donut-center">
      <span>${selectedExpenseMonth === "__all" ? "All months" : formatMonthLabel(selectedExpenseMonth)}</span>
      <strong>$${totalAmount.toFixed(2)}</strong>
      <small>${visibleReceipts.length} receipt${visibleReceipts.length === 1 ? "" : "s"}</small>
    </div>
  `;
  elements.expenseDonut.dataset.total = totalAmount.toFixed(2);

  elements.expenseLegend.innerHTML = slices
    .map(
      (slice) => `
        <article class="legend-row" data-label="${escapeHtml(slice.label)}" style="${getRowThemeVars(slice.theme)}">
          <div class="legend-copy">
            <span class="legend-swatch" style="background:${slice.theme.color}"></span>
            <strong>${slice.theme.icon} ${escapeHtml(slice.label)}</strong>
          </div>
          <div class="legend-values">
            <span>$${slice.amount.toFixed(2)}</span>
            <span class="muted">${slice.share.toFixed(1)}%</span>
          </div>
        </article>
      `
    )
    .join("");
}

function playDashboardArrivalEffects(receipt, visualRefresh) {
  const resolvedReceipt = receipt || uploadState.receipt;
  if (!resolvedReceipt) {
    return;
  }

  const theme = visualRefresh?.theme || getReceiptTheme(resolvedReceipt);
  const label = visualRefresh?.label || getReceiptDisplayLabel(resolvedReceipt);

  triggerExpenseDonutRefresh(theme);
  triggerReceiptHighlight(label);
}

function triggerExpenseDonutRefresh(theme) {
  if (!elements.expenseDonut || !theme) {
    return;
  }

  window.clearTimeout(donutRefreshTimer);
  elements.expenseDonut.style.setProperty("--refresh-color", theme.color);
  elements.expenseDonut.style.setProperty("--refresh-soft", theme.soft);
  elements.expenseDonut.classList.remove("is-refreshing");
  void elements.expenseDonut.offsetWidth;
  elements.expenseDonut.classList.add("is-refreshing");

  donutRefreshTimer = window.setTimeout(() => {
    elements.expenseDonut?.classList.remove("is-refreshing");
  }, 1250);
}

function triggerReceiptHighlight(label) {
  const targets = [
    ...Array.from(elements.categoryChart?.querySelectorAll("[data-label]") || []),
    ...Array.from(elements.expenseLegend?.querySelectorAll("[data-label]") || []),
  ];

  if (!targets.length) {
    return;
  }

  targets.forEach((target) => {
    const matches = target.dataset.label === label;
    target.classList.remove("is-fresh");
    if (matches) {
      void target.offsetWidth;
      target.classList.add("is-fresh");
    }
  });

  elements.spotlightPanel?.classList.remove("spotlight-panel-fresh");
  void elements.spotlightPanel?.offsetWidth;
  elements.spotlightPanel?.classList.add("spotlight-panel-fresh");

  window.clearTimeout(panelRefreshTimer);
  panelRefreshTimer = window.setTimeout(() => {
    targets.forEach((target) => target.classList.remove("is-fresh"));
    elements.spotlightPanel?.classList.remove("spotlight-panel-fresh");
  }, 1500);
}

function scrollToProcessedResult() {
  window.requestAnimationFrame(() => {
    elements.spotlightPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function triggerSuccessBurst(sourceElement) {
  void sourceElement;
}

function initCursorFX() {
  return;
}

function initTopbarScrollFX() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) {
    return;
  }

  const syncTopbar = () => {
    document.body.classList.toggle("topbar-condensed", window.scrollY > 28);
  };

  syncTopbar();
  window.addEventListener("scroll", syncTopbar, { passive: true });
}

function formatMonthLabel(value) {
  if (!value || value === "__all") {
    return "All Months";
  }

  const [year, month] = String(value).split("-");
  const monthIndex = Number(month) - 1;
  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return value;
  }

  return new Date(Date.UTC(Number(year), monthIndex, 1)).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function initializeApp() {
  await initializeAuth();
  await loadDashboard();
}

bindAuthControls();
bindUploadControls();
bindHistoryControls();
bindArchiveControls();
setArchiveVisibility(false);
initTopbarScrollFX();
initCursorFX();
window.addEventListener("beforeunload", clearPreviewObjectUrl);
initializeApp().catch((error) => {
  console.error("Unable to load dashboard.", error);
});
