module.exports = {
  apps: [
    {
      name: "tender-cron",
      script: "src/cron.js",
      cwd: "/home/burger/random/esummit/eprocure-scraper",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "logs/cron-error.log",
      out_file: "logs/cron-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      time: true,
    },
  ],
};
