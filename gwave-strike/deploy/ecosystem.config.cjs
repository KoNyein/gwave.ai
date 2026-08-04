// PM2 (blueprint §5.5)
module.exports = {
  apps: [
    {
      name: "gwave-strike",
      script: "server/dist/index.js",
      instances: 1,
      max_memory_restart: "400M",
      env: { NODE_ENV: "production", PORT: 2567 },
    },
  ],
};
