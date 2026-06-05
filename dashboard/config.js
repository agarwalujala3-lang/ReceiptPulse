window.RECEIPTPULSE_CONFIG = {
  apiBaseUrl: "https://xooa7yv1tf.execute-api.ap-south-1.amazonaws.com",
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
    hostedUiDomain: "https://receiptpulse-119944160349-20260326.auth.ap-south-1.amazoncognito.com",
    clientId: "61nlmqvbrs46bc9i4mvsljgf4c",
    region: "ap-south-1",
    appPath: "./app.html",
    redirectSignIn: "https://d2ijsg7huf2h2p.cloudfront.net",
    redirectSignOut: "https://d2ijsg7huf2h2p.cloudfront.net",
    scopes: ["openid", "profile"],
  },
};
