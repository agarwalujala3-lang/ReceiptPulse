(function () {
  const AUTH_STORAGE_KEY = "receiptpulse-auth-session";
  const DEFAULT_APP_PATH = "./app.html";

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

  function persistTokens(tokens) {
    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
    } catch (error) {
      console.warn("Unable to persist auth session.", error);
    }
  }

  function clearTokens() {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.warn("Unable to clear auth session.", error);
    }
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

    const response = await fetch(`https://cognito-idp.${config.region}.amazonaws.com/`, {
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
    return cognitoRequest(config, "SignUp", {
      ClientId: config.clientId,
      Username: payload.username,
      Password: payload.password,
      UserAttributes: payload.name
        ? [
            {
              Name: "name",
              Value: payload.name,
            },
          ]
        : [],
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

  function redirectToApp(config) {
    const target = new URL(config?.appPath || DEFAULT_APP_PATH, window.location.href);
    window.location.replace(target.toString());
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
    if (code === "InvalidParameterException") {
      return message || "Please check the values you entered and try again.";
    }
    if (code === "TooManyRequestsException") {
      return "Too many attempts just now. Wait a few seconds and try again.";
    }
    if (code === "UserNotConfirmedException") {
      return "This account is not confirmed yet. Please try signing in again in a moment.";
    }

    return message || "Authentication could not be completed.";
  }

  function setPageStatus(message, state = "idle") {
    const status = document.querySelector("#authStatus");
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
      input.disabled = isBusy;
    });
  }

  function validateAuthForm(pageType, fields) {
    const username = String(fields.username?.value || "").trim();
    const password = String(fields.password?.value || "");
    const name = String(fields.name?.value || "").trim();
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

    return {
      username,
      password,
      name,
    };
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
    const form = document.querySelector("#authForm");
    const fields = {
      name: document.querySelector("#authName"),
      username: document.querySelector("#authUsername"),
      password: document.querySelector("#authPassword"),
      confirmPassword: document.querySelector("#authConfirmPassword"),
    };

    if (!form) {
      return;
    }

    if (!isConfigured(config)) {
      setPageStatus("Cognito configuration is missing in dashboard/config.js.", "error");
      setFormBusy(true);
      return;
    }

    try {
      const existingSession = await restoreExistingSession(config);
      if (existingSession && buildUserFromTokens(existingSession).id) {
        setPageStatus("Existing session found. Opening the app page...", "success");
        redirectToApp(config);
        return;
      }
    } catch (error) {
      clearTokens();
      setPageStatus("Previous session expired. Sign in again to continue.", "idle");
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setFormBusy(true);

      try {
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
    refreshSession,
    redirectToApp,
    toFriendlyErrorMessage,
  };

  if (document.body?.dataset?.authPage) {
    void initAuthPage();
  }
})();
