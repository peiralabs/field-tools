"""Static server with permissive CORS so a claude.ai page can fetch the
artifact HTML files during browser-driven publishing. Dev helper only."""
import http.server
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))


class CORSHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


http.server.ThreadingHTTPServer(('127.0.0.1', 8643), CORSHandler).serve_forever()
