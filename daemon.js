const { spawn } = require('child_process');
const fs = require('fs');

const logFd = fs.openSync('/home/z/my-project/dev.log', 'w');

const env = {
  ...process.env,
  DATABASE_URL: 'postgresql://postgres.ldvbfsnqgulynwxqwzau:3sHLmkVWQsvbJPTY@aws-0-eu-west-3.pooler.supabase.com:5432/postgres',
  DIRECT_URL: 'postgresql://postgres.ldvbfsnqgulynwxqwzau:3sHLmkVWQsvbJPTY@aws-0-eu-west-3.pooler.supabase.com:5432/postgres',
};

const child = spawn('bun', ['run', 'dev'], {
  cwd: '/home/z/my-project',
  detached: true,
  stdio: ['ignore', logFd, logFd],
  env: env
});

child.unref();

console.log('Daemon started with PID:', child.pid);
