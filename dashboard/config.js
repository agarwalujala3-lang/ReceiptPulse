window.RECEIPTPULSE_CONFIG = {
  apiBaseUrl: "",
  demo: {
    enabled: true,
    autoFallback: true,
    sampleDataPath: "./data/demo-dashboard.json",
    user: {
      id: "demo-cloud-operator",
      name: "Cloud Demo Operator",
      email: "demo@receiptpulse.dev",
    },
  },
  auth: {
    hostedUiDomain: "",
    clientId: "",
    region: "ap-south-1",
    appPath: "./app.html",
    redirectSignIn: "https://agarwalujala3-lang.github.io/ReceiptPulse/",
    redirectSignOut: "https://agarwalujala3-lang.github.io/ReceiptPulse/",
    scopes: ["openid", "profile"],
  },
};
