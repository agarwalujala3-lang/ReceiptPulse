(function () {
  const AUTH_STORAGE_KEY = "receiptpulse-auth-session";
  const DEFAULT_APP_PATH = "./app.html";
  const SIGNED_OUT_FLAG = "signed_out";
  const DEMO_TOKEN_PREFIX = "demo-receiptpulse";
  const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function getSessionStore() {
    return window.sessionStorage;
  }

  function clearLegacyPersistentTokens() {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.warn("Unable to clear legacy persistent auth session.", error);
    }
  }

  function normalizeConfig(raw, options = {}) {
    const fallbackUrl = String(options.fallbackUrl || `${window.location.origin}${window.location.pathname}`).trim();
    const hostedUiDomain = String(raw?.hostedUiDomain || "").trim().replace(/\/$/, "");
    const regionFromDomain = hostedUiDomain.match(/\.auth\.([a-z0-9-]+)\.amazoncognito\.com$/i)?.[1] || "";

    return {
      hostedUiDomain,
      clientId: String(raw?.clientId || "").trim(),
      region: String(raw?.region || regionFromDomain).trim(),
      redirectSignIn: String(raw?.redirectSignIn || fallbackUrl).trim(),
      redirectSignOut: String(raw?.redirectSignOut || fallbackUrl).trim(),
      appPath: String(raw?.appPath || DEFAULT_APP_PATH).trim() || DEFAULT_APP_PATH,
    };
  }

  function isConfigured(config) {
    return Boolean(config?.clientId && config?.region);
  }

  function loadStoredTokens() {
    clearLegacyPersistentTokens();

    try {
      const raw = getSessionStore().getItem(AUTH_STORAGE_KEY);
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

  function persistTokens(tokens) {
    clearLegacyPersistentTokens();

    try {
      getSessionStore().setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
    } catch (error) {
      console.warn("Unable to persist auth session.", error);
    }
  }

  function clearTokens() {
    try {
      getSessionStore().removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.warn("Unable to clear auth session.", error);
    }

    clearLegacyPersistentTokens();
  }

  function getDemoConfig() {
    const demo = window.RECEIPTPULSE_CONFIG?.demo || {};
    const user = demo.user || {};
    return {
      enabled: demo.enabled !== false,
      appPath: String(window.RECEIPTPULSE_CONFIG?.auth?.appPath || DEFAULT_APP_PATH).trim() || DEFAULT_APP_PATH,
      user: {
        id: String(user.id || "demo-cloud-operator"),
        name: String(user.name || "Cloud Demo Operator"),
        email: String(user.email || "demo@receiptpulse.dev"),
      },
    };
  }

  function isDemoEnabled() {
    return getDemoConfig().enabled;
  }

  function normalizeEmail(value) {
    const email = String(value || "").trim().toLowerCase();
    return EMAIL_PATTERN.test(email) ? email : "";
  }

  function createDemoTokens(userOverride = {}) {
    const demo = getDemoConfig();
    const username = String(userOverride.username || "").trim();
    const name = String(userOverride.name || username || demo.user.name).trim();
    const email = normalizeEmail(userOverride.email) || (username.includes("@") ? username : demo.user.email);

    return {
      demo: true,
      accessToken: `${DEMO_TOKEN_PREFIX}-access-${Date.now()}`,
      idToken: `${DEMO_TOKEN_PREFIX}-id-${Date.now()}`,
      refreshToken: "",
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      user: {
        ...demo.user,
        id: username || demo.user.id,
        name,
        email,
      },
    };
  }

  function isDemoSession(tokens) {
    return Boolean(tokens?.demo && String(tokens?.accessToken || "").startsWith(DEMO_TOKEN_PREFIX));
  }

  function waitFor(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function isTransientNetworkError(error) {
    const message = String(error?.message || "").toLowerCase();
    return (
      error instanceof TypeError
      || message.includes("failed to fetch")
      || message.includes("networkerror")
      || message.includes("load failed")
      || message.includes("network request failed")
    );
  }

  function decodeJwtPayload(token) {
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
    if (isDemoSession(tokens)) {
      return {
        id: tokens.user?.id || "demo-cloud-operator",
        email: tokens.user?.email || "demo@receiptpulse.dev",
        name: tokens.user?.name || "Cloud Demo Operator",
        demo: true,
      };
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

  function isTokenExpired(tokens, bufferMs = 60000) {
    const expiresAt = Number(tokens?.expiresAt || 0);
    if (!expiresAt) {
      return true;
    }

    return Date.now() + bufferMs >= expiresAt;
  }

  async function cognitoRequest(config, target, payload) {
    if (!isConfigured(config)) {
      throw new Error("Cognito configuration is missing the client id or region.");
    }

    const url = `https://cognito-idp.${config.region}.amazonaws.com/`;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          return response.json();
        }

        let errorPayload = {};
        try {
          errorPayload = await response.json();
        } catch (error) {
          console.warn("Unable to parse Cognito error payload.", error);
        }

        const error = new Error(errorPayload.message || `Authentication request failed (${response.status}).`);
        error.code = String(errorPayload.__type || errorPayload.code || "").split("#").pop() || "";
        throw error;
      } catch (error) {
        if (isTransientNetworkError(error) && attempt < maxAttempts) {
          await waitFor(350 * attempt);
          continue;
        }
        throw error;
      }
    }

    throw new Error("Authentication request did not complete.");
  }

  function buildTokenSet(result, previousTokens = null) {
    return {
      accessToken: result?.AccessToken || previousTokens?.accessToken || "",
      idToken: result?.IdToken || previousTokens?.idToken || "",
      refreshToken: result?.RefreshToken || previousTokens?.refreshToken || "",
      expiresAt: Date.now() + Number(result?.ExpiresIn || 3600) * 1000,
    };
  }

  async function signIn(config, credentials) {
    const payload = await cognitoRequest(config, "InitiateAuth", {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: config.clientId,
      AuthParameters: {
        USERNAME: credentials.username,
        PASSWORD: credentials.password,
      },
    });
    return buildTokenSet(payload.AuthenticationResult);
  }

  async function signUp(config, payload) {
    const userAttributes = [];

    if (payload.email) {
      userAttributes.push({
        Name: "email",
        Value: payload.email,
      });
    }

    if (payload.name) {
      userAttributes.push({
        Name: "name",
        Value: payload.name,
      });
    }

    return cognitoRequest(config, "SignUp", {
      ClientId: config.clientId,
      Username: payload.username,
      Password: payload.password,
      UserAttributes: userAttributes,
    });
  }

  async function requestPasswordReset(config, username) {
    return cognitoRequest(config, "ForgotPassword", {
      ClientId: config.clientId,
      Username: username,
    });
  }

  async function confirmPasswordReset(config, payload) {
    return cognitoRequest(config, "ConfirmForgotPassword", {
      ClientId: config.clientId,
      Username: payload.username,
      ConfirmationCode: payload.code,
      Password: payload.password,
    });
  }

  async function refreshSession(config, refreshToken, previousTokens = null) {
    if (!refreshToken) {
      throw new Error("No refresh token is available for this session.");
    }

    const payload = await cognitoRequest(config, "InitiateAuth", {
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: config.clientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });
    return buildTokenSet(payload.AuthenticationResult, previousTokens || { refreshToken });
  }

  async function globalSignOut(config, accessToken) {
    if (!accessToken) {
      return;
    }
    if (String(accessToken).startsWith(DEMO_TOKEN_PREFIX)) {
      return;
    }

    try {
      await cognitoRequest(config, "GlobalSignOut", {
        AccessToken: accessToken,
      });
    } catch (error) {
      const code = String(error?.code || "").trim();
      if (code && code !== "NotAuthorizedException") {
        throw error;
      }
    }
  }

  function redirectToApp(config) {
    const target = new URL(config?.appPath || DEFAULT_APP_PATH, window.location.href);
    window.location.replace(target.toString());
  }

  function startDemoSession(userOverride = {}) {
    const tokens = createDemoTokens(userOverride);
    persistTokens(tokens);
    redirectToApp(getDemoConfig());
  }

  function isUsernameReadyForPassword(username) {
    const value = String(username || "").trim();
    return Boolean(value) && !/\s/.test(value);
  }

  function setupUsernameGatedPassword(fields) {
    const username = fields.username;
    const password = fields.password;
    if (!username || !password || password.dataset.authGatedPassword !== "true") {
      return () => {};
    }

    const realName = password.dataset.authRealName || "password";
    const realAutocomplete = password.dataset.authRealAutocomplete || "current-password";
    const passwordHint = document.querySelector("#authPasswordHint");
    let usernameWasEntered = false;

    const lockPassword = () => {
      password.value = "";
      password.disabled = true;
      password.type = "text";
      password.name = "password_locked";
      password.autocomplete = "off";
      password.placeholder = "Enter username first";
      password.dataset.passwordGateState = "locked";
      password.setAttribute("aria-disabled", "true");
      if (passwordHint) {
        passwordHint.textContent = "Enter a valid username first to unlock password suggestions.";
        passwordHint.dataset.state = "idle";
      }
    };

    const unlockPassword = () => {
      password.disabled = false;
      password.type = "password";
      password.name = realName;
      password.autocomplete = realAutocomplete;
      password.placeholder = "Enter your password";
      password.dataset.passwordGateState = "unlocked";
      password.removeAttribute("aria-disabled");
      if (passwordHint) {
        passwordHint.textContent = "Password unlocked. Use saved password or type it here.";
        passwordHint.dataset.state = "success";
      }
    };

    const syncPasswordGate = () => {
      if (usernameWasEntered && isUsernameReadyForPassword(username.value)) {
        unlockPassword();
        return;
      }

      lockPassword();
    };

    const markUsernameEntered = () => {
      usernameWasEntered = true;
      syncPasswordGate();
    };

    lockPassword();
    username.addEventListener("input", markUsernameEntered);
    username.addEventListener("change", markUsernameEntered);
    username.addEventListener("paste", () => {
      window.setTimeout(markUsernameEntered, 0);
    });

    window.setTimeout(syncPasswordGate, 120);
    return syncPasswordGate;
  }

  function assessPasswordStrength(password) {
    const value = String(password || "");
    if (!value) {
      return {
        state: "empty",
        width: "0%",
        message: "Use 8+ characters with letters, numbers, and symbols.",
      };
    }

    let score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;

    if (score <= 2) {
      return {
        state: "weak",
        width: "34%",
        message: "Weak: add length, mixed case, numbers, and symbols.",
      };
    }

    if (score <= 4) {
      return {
        state: "fair",
        width: "68%",
        message: "Fair: stronger with 12+ characters and a symbol.",
      };
    }

    return {
      state: "strong",
      width: "100%",
      message: "Strong password pattern for this project.",
    };
  }

  function setupPasswordFeedback(options = {}) {
    const password = options.password;
    const confirmPassword = options.confirmPassword;
    const strengthHint = options.strengthHint;
    const strengthBar = options.strengthBar;
    const strengthTrack = strengthBar?.closest?.(".auth-password-strength") || null;
    const matchHint = options.matchHint;

    if (!password) {
      return;
    }

    const refreshStrength = () => {
      const result = assessPasswordStrength(password.value);
      if (strengthHint) {
        strengthHint.textContent = result.message;
        strengthHint.dataset.state = result.state === "strong" ? "success" : result.state === "empty" ? "idle" : "warning";
      }
      if (strengthTrack) {
        strengthTrack.dataset.strength = result.state;
      }
      if (strengthBar) {
        strengthBar.style.width = result.width;
      }
    };

    const refreshMatch = () => {
      if (!matchHint || !confirmPassword) {
        return;
      }

      const passwordValue = String(password.value || "");
      const confirmValue = String(confirmPassword.value || "");
      if (!confirmValue) {
        matchHint.textContent = "Re-enter the password to confirm.";
        matchHint.dataset.state = "idle";
        return;
      }
      if (passwordValue && passwordValue === confirmValue) {
        matchHint.textContent = "Passwords match.";
        matchHint.dataset.state = "success";
        return;
      }

      matchHint.textContent = "Passwords do not match yet.";
      matchHint.dataset.state = "warning";
    };

    const refresh = () => {
      refreshStrength();
      refreshMatch();
    };

    password.addEventListener("input", refresh);
    confirmPassword?.addEventListener("input", refreshMatch);
    refresh();
  }

  function setupCapsLockHint(password, hint) {
    if (!password || !hint) {
      return;
    }

    let previousMessage = "";
    let previousState = "";
    const syncCapsLock = (event) => {
      if (password.disabled || typeof event.getModifierState !== "function") {
        return;
      }
      if (event.getModifierState("CapsLock")) {
        if (!previousMessage) {
          previousMessage = hint.textContent.trim();
          previousState = hint.dataset.state || "idle";
        }
        hint.textContent = "Caps Lock is on.";
        hint.dataset.state = "warning";
        return;
      }

      if (previousMessage) {
        hint.textContent = previousMessage;
        hint.dataset.state = previousState || "idle";
        previousMessage = "";
        previousState = "";
      }
    };

    password.addEventListener("keydown", syncCapsLock);
    password.addEventListener("keyup", syncCapsLock);
    password.addEventListener("blur", () => {
      if (previousMessage) {
        hint.textContent = previousMessage;
        hint.dataset.state = previousState || "idle";
        previousMessage = "";
        previousState = "";
      }
    });
  }

  function getAuthFields() {
    return {
      name: document.querySelector("#authName"),
      email: document.querySelector("#authEmail"),
      username: document.querySelector("#authUsername"),
      password: document.querySelector("#authPassword"),
      confirmPassword: document.querySelector("#authConfirmPassword"),
    };
  }

  function getSignInFormMarkup() {
    return `
      <form class="auth-form" id="authForm" novalidate autocomplete="on">
        <label class="field">
          <span>Username</span>
          <input
            class="text-input"
            id="authUsername"
            name="username"
            type="text"
            autocomplete="username"
            autocapitalize="off"
            spellcheck="false"
            maxlength="64"
            placeholder="your-username"
            required
          />
        </label>

        <label class="field">
          <span>Password</span>
          <input
            class="text-input"
            id="authPassword"
            name="password_locked"
            type="text"
            autocomplete="off"
            minlength="8"
            placeholder="Enter username first"
            aria-describedby="authPasswordHint"
            disabled
            data-auth-gated-password="true"
            data-auth-real-name="password"
            data-auth-real-autocomplete="current-password"
            required
          />
          <small class="auth-field-hint" id="authPasswordHint" data-state="idle">
            Enter a valid username first to unlock password suggestions.
          </small>
        </label>

        <button class="primary-button auth-submit" id="authSubmit" type="submit">Open Workspace</button>
      </form>

      <button class="auth-link-button" id="forgotPasswordToggle" type="button">
        Forgot password?
      </button>

      <section class="auth-recovery-card" id="passwordRecoveryPanel" hidden>
        <div class="auth-recovery-head">
          <span class="mini-label">Secure recovery</span>
          <strong>Reset with Cognito email verification</strong>
          <p>Enter your username. If AWS Live auth is configured, Cognito sends a reset code to the verified recovery email on that account.</p>
        </div>

        <form class="auth-recovery-form" id="passwordRecoveryForm" novalidate autocomplete="on">
          <label class="field">
            <span>Username</span>
            <input
              class="text-input"
              id="recoveryUsername"
              name="username"
              type="text"
              autocomplete="username"
              autocapitalize="off"
              spellcheck="false"
              maxlength="64"
              placeholder="your-username"
              required
            />
          </label>

          <div class="auth-recovery-confirm" id="passwordRecoveryConfirm" hidden>
            <label class="field">
              <span>Reset code</span>
              <input
                class="text-input"
                id="recoveryCode"
                name="one-time-code"
                type="text"
                autocomplete="one-time-code"
                inputmode="numeric"
                maxlength="12"
                placeholder="Code from email"
              />
            </label>

            <label class="field">
              <span>New password</span>
              <input
                class="text-input"
                id="recoveryPassword"
                name="new-password"
                type="password"
                autocomplete="new-password"
                minlength="8"
                placeholder="New password"
                aria-describedby="recoveryPasswordStrength"
              />
              <span class="auth-password-strength" data-strength="empty" aria-hidden="true">
                <i id="recoveryPasswordStrengthBar"></i>
              </span>
              <small class="auth-field-hint" id="recoveryPasswordStrength" data-password-strength data-state="idle">
                Use 8+ characters with letters, numbers, and symbols.
              </small>
            </label>

            <label class="field">
              <span>Confirm new password</span>
              <input
                class="text-input"
                id="recoveryConfirmPassword"
                name="confirm-new-password"
                type="password"
                autocomplete="new-password"
                minlength="8"
                placeholder="Re-enter new password"
                aria-describedby="recoveryConfirmHint"
              />
              <small class="auth-field-hint" id="recoveryConfirmHint" data-password-match data-state="idle">
                Re-enter the new password to confirm.
              </small>
            </label>
          </div>

          <div class="auth-recovery-actions">
            <button class="primary-button auth-submit" id="passwordRecoverySubmit" type="submit">
              Send Reset Code
            </button>
            <button class="secondary-button" id="passwordRecoveryCancel" type="button">
              Cancel
            </button>
          </div>
        </form>

        <p class="auth-status auth-recovery-status" id="passwordRecoveryStatus" data-state="idle">
          Password recovery uses Cognito and never reveals your existing password.
        </p>
      </section>
    `;
  }

  function getSignUpFormMarkup() {
    return `
      <form class="auth-form" id="authForm" novalidate autocomplete="on">
        <label class="field">
          <span>Display name</span>
          <input
            class="text-input"
            id="authName"
            name="name"
            type="text"
            autocomplete="name"
            maxlength="64"
            placeholder="Optional name for the dashboard"
          />
        </label>

        <label class="field">
          <span>Username</span>
          <input
            class="text-input"
            id="authUsername"
            name="username"
            type="text"
            autocomplete="username"
            autocapitalize="off"
            spellcheck="false"
            maxlength="64"
            placeholder="choose-a-username"
            required
          />
        </label>

        <label class="field">
          <span>Recovery email</span>
          <input
            class="text-input"
            id="authEmail"
            name="email"
            type="email"
            autocomplete="email"
            autocapitalize="off"
            spellcheck="false"
            maxlength="120"
            placeholder="you@example.com"
            required
          />
        </label>

        <label class="field">
          <span>Password</span>
          <input
            class="text-input"
            id="authPassword"
            name="new-password"
            type="password"
            autocomplete="new-password"
            minlength="8"
            placeholder="At least 8 characters"
            aria-describedby="authPasswordStrength"
            required
          />
          <span class="auth-password-strength" data-strength="empty" aria-hidden="true">
            <i id="authPasswordStrengthBar"></i>
          </span>
          <small class="auth-field-hint" id="authPasswordStrength" data-password-strength data-state="idle">
            Use 8+ characters with letters, numbers, and symbols.
          </small>
        </label>

        <label class="field">
          <span>Confirm password</span>
          <input
            class="text-input"
            id="authConfirmPassword"
            name="confirm-new-password"
            type="password"
            autocomplete="new-password"
            minlength="8"
            placeholder="Re-enter the same password"
            aria-describedby="authConfirmHint"
            required
          />
          <small class="auth-field-hint" id="authConfirmHint" data-password-match data-state="idle">
            Re-enter the password to confirm.
          </small>
        </label>

        <button class="primary-button auth-submit" id="authSubmit" type="submit">Create Account</button>
      </form>
    `;
  }

  function renderLiveAuthForm(pageType) {
    const existingForm = document.querySelector("#authForm");
    if (existingForm) {
      return existingForm;
    }

    const slot = document.querySelector("#authLiveFormSlot");
    if (!slot) {
      return null;
    }

    slot.innerHTML = pageType === "signup" ? getSignUpFormMarkup() : getSignInFormMarkup();
    return slot.querySelector("#authForm");
  }

  function setDemoFirstAuthPage(pageType, form) {
    document.body.classList.add("auth-public-demo");
    document.body.dataset.authMode = "cloud-demo";

    const panelHead = document.querySelector(".auth-panel-head");
    const title = panelHead?.querySelector("h2");
    const copy = panelHead?.querySelector("p:last-child");
    const securityNote = document.querySelector(".auth-security-note");
    const forgotPassword = document.querySelector("#forgotPasswordToggle");
    const recoveryPanel = document.querySelector("#passwordRecoveryPanel");
    const demoButton = document.querySelector("#demoAccessButton");
    const authSwitch = document.querySelector(".auth-switch");

    if (title) {
      title.textContent = pageType === "signup" ? "Open Cloud Demo first" : "Open the portfolio Cloud Demo";
    }
    if (copy) {
      copy.textContent =
        "This public page is a safe AWS portfolio demo. Real sign-in and account creation appear only when a Cognito backend is configured.";
    }
    if (securityNote) {
      securityNote.textContent =
        "Portfolio demo only. Do not enter real passwords on the public GitHub Pages link. AWS Live credential forms are enabled only after Cognito is configured.";
    }
    if (forgotPassword) {
      forgotPassword.remove();
    }
    if (recoveryPanel) {
      recoveryPanel.remove();
    }
    if (demoButton) {
      demoButton.textContent = "Open Cloud Demo";
      demoButton.classList.add("demo-access-button-primary");
    }
    if (authSwitch) {
      authSwitch.innerHTML =
        '<span>AWS Live ready?</span><a href="./app.html?demo=1&sample=1">Preview dashboard sample</a>';
    }

    if (form) {
      form.querySelectorAll("input, button, select, textarea").forEach((control) => {
        control.disabled = true;
        control.setAttribute("tabindex", "-1");
      });
      form.remove();
    }
  }

  function setLiveAuthPage(pageType) {
    const panelHead = document.querySelector(".auth-panel-head");
    const title = panelHead?.querySelector("h2");
    const copy = panelHead?.querySelector("p:last-child");
    const securityNote = document.querySelector(".auth-security-note");

    if (title) {
      title.textContent = pageType === "signup" ? "Create an AWS Live workspace" : "Open your AWS Live workspace";
    }
    if (copy) {
      copy.textContent =
        pageType === "signup"
          ? "Cognito is configured. Pick a username, recovery email, and password for this deployed workspace."
          : "Cognito is configured. Use your project username and password to open the deployed workspace.";
    }
    if (securityNote) {
      securityNote.textContent =
        "AWS Live mode sends credentials only to Amazon Cognito for this configured deployment. ReceiptPulse never stores or reveals your password.";
    }
    setPageStatus(
      pageType === "signup"
        ? "Create an AWS Live account with a recovery email."
        : "Sign in with the AWS Live account created for this deployment.",
      "idle",
    );
  }

  function guardAuthFields(fields, includeName = false) {
    const targets = includeName
      ? [fields.name, fields.email, fields.username, fields.password, fields.confirmPassword]
      : [fields.username, fields.password, fields.confirmPassword];

    targets
      .filter(Boolean)
      .forEach((field) => {
        field.removeAttribute("readonly");
        field.dataset.authInputReady = "true";
      });
  }

  function consumeSignedOutFlag() {
    const url = new URL(window.location.href);
    const hasFlag = url.searchParams.get(SIGNED_OUT_FLAG) === "1";
    if (!hasFlag) {
      return false;
    }

    url.searchParams.delete(SIGNED_OUT_FLAG);
    window.history.replaceState({}, document.title, url.toString());
    return true;
  }

  function toFriendlyErrorMessage(error) {
    const code = String(error?.code || "").trim();
    const message = String(error?.message || "").trim();

    if (code === "NotAuthorizedException") {
      return "Username or password is incorrect.";
    }
    if (code === "UsernameExistsException") {
      return "That username is already being used. Pick a different one.";
    }
    if (code === "InvalidPasswordException") {
      return message || "Password does not match the project password rules.";
    }
    if (code === "CodeMismatchException") {
      return "The reset code is not correct. Check the email code and try again.";
    }
    if (code === "ExpiredCodeException") {
      return "The reset code has expired. Request a new password reset code.";
    }
    if (code === "LimitExceededException") {
      return "Too many password attempts. Wait a few minutes and try again.";
    }
    if (code === "UserNotFoundException") {
      return "If that account exists, Cognito will send a reset code to its recovery email.";
    }
    if (code === "InvalidParameterException") {
      return message || "Please check the values you entered and try again.";
    }
    if (code === "TooManyRequestsException") {
      return "Too many attempts just now. Wait a few seconds and try again.";
    }
    if (code === "UserNotConfirmedException") {
      return "This account is not confirmed yet. Please try signing in again in a moment.";
    }
    if (isTransientNetworkError(error)) {
      return "Network issue while contacting sign-in service. Please try once more.";
    }

    return message || "Authentication could not be completed.";
  }

  function setPageStatus(message, state = "idle") {
    setStatus(document.querySelector("#authStatus"), message, state);
  }

  function setStatus(status, message, state = "idle") {
    if (!status) {
      return;
    }

    status.textContent = message;
    status.dataset.state = state;
  }

  function setFormBusy(isBusy) {
    const submit = document.querySelector("#authSubmit");
    if (submit) {
      submit.disabled = isBusy;
    }

    document.querySelectorAll("#authForm input").forEach((input) => {
      input.disabled = isBusy || input.dataset.passwordGateState === "locked";
    });
  }

  function validateAuthForm(pageType, fields) {
    const username = String(fields.username?.value || "").trim();
    const password = String(fields.password?.value || "");
    const name = String(fields.name?.value || "").trim();
    const email = normalizeEmail(fields.email?.value);
    const confirmPassword = String(fields.confirmPassword?.value || "");

    if (!username) {
      throw new Error("Enter a username first.");
    }
    if (!password) {
      throw new Error("Enter a password first.");
    }
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }
    if (/\s/.test(username)) {
      throw new Error("Username should not contain spaces.");
    }
    if (pageType === "signup" && password !== confirmPassword) {
      throw new Error("Password and confirm password must match.");
    }
    if (pageType === "signup" && !email) {
      throw new Error("Enter a valid recovery email.");
    }

    return {
      username,
      password,
      name,
      email,
    };
  }

  function setupPasswordRecovery(config, options = {}) {
    const toggle = document.querySelector("#forgotPasswordToggle");
    const panel = document.querySelector("#passwordRecoveryPanel");
    const form = document.querySelector("#passwordRecoveryForm");
    const cancel = document.querySelector("#passwordRecoveryCancel");
    const confirmPanel = document.querySelector("#passwordRecoveryConfirm");
    const submit = document.querySelector("#passwordRecoverySubmit");
    const status = document.querySelector("#passwordRecoveryStatus");
    const usernameField = document.querySelector("#recoveryUsername");
    const codeField = document.querySelector("#recoveryCode");
    const passwordField = document.querySelector("#recoveryPassword");
    const confirmPasswordField = document.querySelector("#recoveryConfirmPassword");
    const signInUsername = document.querySelector("#authUsername");

    if (!toggle || !panel || !form || !submit || !usernameField) {
      return;
    }

    setupPasswordFeedback({
      password: passwordField,
      confirmPassword: confirmPasswordField,
      strengthHint: document.querySelector("#recoveryPasswordStrength"),
      strengthBar: document.querySelector("#recoveryPasswordStrengthBar"),
      matchHint: document.querySelector("#recoveryConfirmHint"),
    });

    let step = "request";
    let recoveryUsername = "";

    const setRecoveryBusy = (isBusy) => {
      submit.disabled = isBusy;
      [usernameField, codeField, passwordField, confirmPasswordField, cancel].filter(Boolean).forEach((control) => {
        control.disabled = isBusy;
      });
    };

    const setStep = (nextStep) => {
      step = nextStep;
      confirmPanel.hidden = step !== "confirm";
      submit.textContent = step === "confirm" ? "Update Password" : "Send Reset Code";
      usernameField.readOnly = step === "confirm";
    };

    const resetRecoveryForm = () => {
      setStep("request");
      form.reset();
      recoveryUsername = "";
      setStatus(status, "Password recovery uses Cognito and never reveals your existing password.", "idle");
    };

    toggle.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        usernameField.value = signInUsername?.value || "";
        usernameField.focus();
      }
    });

    cancel?.addEventListener("click", () => {
      panel.hidden = true;
      resetRecoveryForm();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!options.cognitoConfigured) {
        setStatus(
          status,
          "Password recovery needs AWS Live Cognito. On this public Cloud Demo, use the Cloud Demo button instead of entering credentials.",
          "error",
        );
        return;
      }

      try {
        setRecoveryBusy(true);

        if (step === "request") {
          recoveryUsername = String(usernameField.value || "").trim();
          if (!recoveryUsername) {
            throw new Error("Enter your username first.");
          }

          await requestPasswordReset(config, recoveryUsername);
          setStep("confirm");
          setStatus(status, "If that account exists, Cognito sent a reset code to its verified recovery email.", "success");
          codeField?.focus();
          return;
        }

        const code = String(codeField?.value || "").trim();
        const password = String(passwordField?.value || "");
        const confirmPassword = String(confirmPasswordField?.value || "");

        if (!code) {
          throw new Error("Enter the reset code from your email.");
        }
        if (password.length < 8) {
          throw new Error("New password must be at least 8 characters long.");
        }
        if (password !== confirmPassword) {
          throw new Error("New password and confirmation must match.");
        }

        await confirmPasswordReset(config, {
          username: recoveryUsername,
          code,
          password,
        });

        setStatus(status, "Password updated. Sign in with your new password.", "success");
        setStep("request");
        passwordField.value = "";
        confirmPasswordField.value = "";
        codeField.value = "";
        usernameField.readOnly = false;
        usernameField.value = recoveryUsername;
        signInUsername?.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector("#authPassword")?.focus();
      } catch (error) {
        setStatus(status, toFriendlyErrorMessage(error), "error");
      } finally {
        setRecoveryBusy(false);
      }
    });
  }

  async function signInAfterSignup(config, credentials) {
    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await signIn(config, credentials);
      } catch (error) {
        lastError = error;
        if (String(error?.code || "") !== "UserNotConfirmedException") {
          throw error;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
    }

    throw lastError || new Error("Account was created but sign in did not complete.");
  }

  async function restoreExistingSession(config) {
    const stored = loadStoredTokens();
    if (!stored) {
      return null;
    }

    if (!isTokenExpired(stored)) {
      return stored;
    }

    if (!stored.refreshToken) {
      clearTokens();
      return null;
    }

    const refreshed = await refreshSession(config, stored.refreshToken, stored);
    persistTokens(refreshed);
    return refreshed;
  }

  async function initAuthPage() {
    const pageType = document.body?.dataset?.authPage || "";
    if (!pageType) {
      return;
    }

    const config = normalizeConfig(window.RECEIPTPULSE_CONFIG?.auth || {}, {
      fallbackUrl: `${window.location.origin}${window.location.pathname}`,
    });
    const demoEnabled = isDemoEnabled();
    const cognitoConfigured = isConfigured(config);
    const useLocalDemoAuth = !cognitoConfigured && demoEnabled;
    let form = document.querySelector("#authForm");
    if (!useLocalDemoAuth) {
      form = renderLiveAuthForm(pageType);
    }
    const fields = getAuthFields();
    let syncPasswordGate = () => {};

    if (!cognitoConfigured && !demoEnabled) {
      setPageStatus("Cognito configuration is missing in dashboard/config.js.", "error");
      setFormBusy(true);
      return;
    }

    if (useLocalDemoAuth) {
      setDemoFirstAuthPage(pageType, form);
    } else {
      if (!form) {
        setPageStatus("Live auth form could not be created. Check the dashboard markup.", "error");
        return;
      }
      document.body.classList.add("auth-live-mode");
      document.body.dataset.authMode = "aws-live";
      setLiveAuthPage(pageType);
    }

    const demoButton = document.querySelector("#demoAccessButton");
    if (demoButton) {
      demoButton.hidden = !demoEnabled;
      demoButton.addEventListener("click", () => {
        setPageStatus("Opening browser-only cloud demo workspace...", "working");
        startDemoSession();
      });
    }

    if (useLocalDemoAuth) {
      setPageStatus("Safe public mode: open the Cloud Demo without entering real credentials.", "idle");
    }

    if (pageType === "signup" && !useLocalDemoAuth) {
      guardAuthFields(fields, true);
      setupPasswordFeedback({
        password: fields.password,
        confirmPassword: fields.confirmPassword,
        strengthHint: document.querySelector("#authPasswordStrength"),
        strengthBar: document.querySelector("#authPasswordStrengthBar"),
        matchHint: document.querySelector("#authConfirmHint"),
      });
    } else if (pageType !== "signup" && !useLocalDemoAuth) {
      guardAuthFields(fields, false);
      syncPasswordGate = setupUsernameGatedPassword(fields);
      setupCapsLockHint(fields.password, document.querySelector("#authPasswordHint"));
      setupPasswordRecovery(config, { cognitoConfigured, useLocalDemoAuth });
    }

    const cameFromSignOut = consumeSignedOutFlag();

    try {
      const existingSession = await restoreExistingSession(config);
      if (existingSession && buildUserFromTokens(existingSession).id) {
        setPageStatus("Existing session found. Opening the app page...", "success");
        redirectToApp(useLocalDemoAuth ? getDemoConfig() : config);
        return;
      }
    } catch (error) {
      clearTokens();
      setPageStatus("Previous session expired. Sign in again to continue.", "idle");
    }

    if (pageType !== "signup") {
      if (cameFromSignOut) {
        setPageStatus("Signed out. Sign in with this account or another one.", "idle");
      }
    }

    if (!form) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setFormBusy(true);

      try {
        if (useLocalDemoAuth) {
          setPageStatus("Opening your browser-local Cloud Demo workspace without credentials...", "working");
          startDemoSession();
          return;
        }

        const credentials = validateAuthForm(pageType, fields);

        if (pageType === "signup") {
          setPageStatus("Creating your account...", "working");
          await signUp(config, credentials);
          setPageStatus("Account created. Signing you in now...", "working");
          const tokens = await signInAfterSignup(config, credentials);
          persistTokens(tokens);
          setPageStatus("Account ready. Opening the app page...", "success");
          redirectToApp(config);
          return;
        }

        setPageStatus("Signing in...", "working");
        const tokens = await signIn(config, credentials);
        persistTokens(tokens);
        setPageStatus("Signed in. Opening the app page...", "success");
        redirectToApp(config);
      } catch (error) {
        setPageStatus(toFriendlyErrorMessage(error), "error");
      } finally {
        setFormBusy(false);
        syncPasswordGate();
      }
    });
  }

  window.ReceiptPulseAuth = {
    normalizeConfig,
    isConfigured,
    loadStoredTokens,
    persistTokens,
    clearTokens,
    decodeJwtPayload,
    buildUserFromTokens,
    isTokenExpired,
    signIn,
    signUp,
    requestPasswordReset,
    confirmPasswordReset,
    refreshSession,
    globalSignOut,
    redirectToApp,
    isDemoEnabled,
    isDemoSession,
    startDemoSession,
    toFriendlyErrorMessage,
  };

  if (document.body?.dataset?.authPage) {
    void initAuthPage();
  }
})();
