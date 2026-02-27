module.exports = {
  apps: [
    {
      name: "epa-api",
      cwd: "apps/api",
      script: "src/main.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      watch: false,
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: "8080",
      },
    },
  ],
};
