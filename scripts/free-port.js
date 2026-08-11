// Runs automatically before `npm run dev` (see package.json "predev").
//
// Root cause of a recurring bug in this project: running two `next dev`
// processes at once against the same directory corrupts the shared `.next`
// build cache (they race to write the same route manifest), which then
// shows up as random 404/500s on page chunks that have nothing to do with
// whatever was last edited. This script kills anything already bound to
// PORT before Next starts, so a second `npm run dev` can never silently
// spin up alongside a still-running one on a different port.
const { execSync } = require("child_process");

const PORT = process.env.PORT || 3000;

function killWindows(port) {
  let out;
  try {
    out = execSync(`netstat -ano -p tcp`, { encoding: "utf8" });
  } catch {
    return;
  }
  const pids = new Set();
  for (const line of out.split("\n")) {
    if (line.includes(`:${port} `) && line.toUpperCase().includes("LISTENING")) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== "0") pids.add(pid);
    }
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`[free-port] Freed port ${port} (killed stale process ${pid}).`);
    } catch {
      // already gone
    }
  }
}

function killUnix(port) {
  let pids;
  try {
    pids = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" }).trim();
  } catch {
    return;
  }
  if (!pids) return;
  for (const pid of pids.split("\n").filter(Boolean)) {
    try {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
      console.log(`[free-port] Freed port ${port} (killed stale process ${pid}).`);
    } catch {
      // already gone
    }
  }
}

if (process.platform === "win32") {
  killWindows(PORT);
} else {
  killUnix(PORT);
}
