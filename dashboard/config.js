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
    redirectSignIn: "https://sunny-cupcake-ee2461.netlify.app/",
    redirectSignOut: "https://sunny-cupcake-ee2461.netlify.app/",
    scopes: ["openid", "profile"],
  },
};
