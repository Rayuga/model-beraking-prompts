"""Verifier-owned localhost restart controller emitted inline by test.sh."""
import http.server
import json
import os
import signal
import subprocess
import time

LOG_DIR = os.environ.get("VERIFIER_LOG_DIR", "/logs/verifier")
PORT = 3199


def health_ok():
    try:
        import urllib.request
        urllib.request.urlopen("http://127.0.0.1:3000/", timeout=2).read()
        return True
    except Exception:
        return False


def restart():
    entry = os.environ["DOCKETLIGHT_APP_ENTRY"]
    copy = os.environ["DOCKETLIGHT_APP_COPY"]
    db = os.environ["DOCKETLIGHT_APP_DB"]
    seed = os.environ["DOCKETLIGHT_APP_SEED"]
    pid_path = os.path.join(LOG_DIR, "app.pid")
    old_pid = None
    if os.path.exists(pid_path):
        try:
            old_pid = int(open(pid_path, encoding="utf-8").read().strip() or 0)
        except (OSError, ValueError):
            old_pid = None
    if old_pid:
        try:
            os.killpg(old_pid, signal.SIGTERM)
        except OSError:
            pass
        for _ in range(60):
            try:
                os.kill(old_pid, 0)
            except OSError:
                old_pid = None
                break
            time.sleep(0.1)
        if old_pid:
            try:
                os.killpg(old_pid, signal.SIGKILL)
            except OSError:
                pass
    log = open(os.path.join(LOG_DIR, "app-restart.log"), "ab")
    child_env = {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "NODE_PATH": "/usr/local/lib/node_modules",
        "HOME": copy,
        "PORT": "3000",
        "DB_PATH": db,
        "SEED_PATH": seed,
    }
    argv = ["setsid", "env", "-i"]
    for key, value in child_env.items():
        argv.append(f"{key}={value}")
    argv += ["setpriv", "--reuid=65534", "--regid=65534", "--clear-groups",
             "node", entry]
    proc = subprocess.Popen(argv, stdin=subprocess.DEVNULL,
                            stdout=log, stderr=log)
    with open(pid_path, "w", encoding="utf-8") as handle:
        handle.write(str(proc.pid))
    ready = False
    for _ in range(240):
        if health_ok():
            ready = True
            break
        time.sleep(0.25)
    if not ready:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except OSError:
            pass
        raise RuntimeError("restarted application did not become ready")
    return {"ok": True, "restarted": True, "pid": proc.pid, "ready": True}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.rstrip("/") == "/restart":
            try:
                body = json.dumps(restart()).encode("utf-8")
                self.send_response(200)
            except Exception as exc:
                body = json.dumps(
                    {"ok": False, "restarted": False,
                     "error": f"{type(exc).__name__}: {exc}"}
                ).encode("utf-8")
                self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        body = json.dumps({"ok": True,
                           "service": "verifier-restart-controller"}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        with open(os.path.join(LOG_DIR, "restart-controller.log"), "a",
                  encoding="utf-8") as log:
            log.write("[%s] %s\n"
                      % (time.strftime("%FT%TZ", time.gmtime()), fmt % args))


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT),
                                    Handler).serve_forever()
