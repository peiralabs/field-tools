"""Static file server with permissive CORS — DEVELOPMENT HELPER ONLY.

Serves this directory so a browser page on another origin can fetch the tool
HTML during artifact publishing, and so the screenshot script has something to
point at.

⚠️  Two deliberate properties, and why they are safe *only* as configured:

    1. It binds to 127.0.0.1, so nothing outside this machine can reach it.
    2. It sends `Access-Control-Allow-Origin: *`, which lets ANY origin you have
       open in your browser read every file this serves.

    (2) is only acceptable because of (1). If you change the host to 0.0.0.0 or
    put this behind a tunnel, you are handing every page on your network — and
    every site open in your browser — read access to this directory. Don't.

You do not need this to use the tools. Every tool is a single self-contained
file: open the .html directly and it works.

    python3 cors-server.py     # http://127.0.0.1:8643
"""
import http.server
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

HOST = '127.0.0.1'  # loopback only — see the warning above before changing this
PORT = 8643


class CORSHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


if __name__ == '__main__':
    print(f'Serving {os.getcwd()} on http://{HOST}:{PORT} (loopback only, Ctrl+C to stop)')
    http.server.ThreadingHTTPServer((HOST, PORT), CORSHandler).serve_forever()
