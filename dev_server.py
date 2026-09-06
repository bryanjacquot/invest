#!/usr/bin/env python3
"""
Simple Single Page Application (SPA) development server for InvestTracker.
Serves static assets from frontend/src/ and routes all non-file URL paths to index.html.
"""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 3010
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend', 'src')


class SPARequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def translate_path(self, path):
        clean_path = path.split('?')[0].split('#')[0].lstrip('/')
        if clean_path:
            local_path = os.path.join(DIRECTORY, clean_path)
            if not os.path.exists(local_path) or os.path.isdir(local_path):
                return os.path.join(DIRECTORY, 'index.html')
        return super().translate_path(path)

    def end_headers(self):
        # Disable aggressive caching in local dev mode
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


def run():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, SPARequestHandler)
    print(f"🚀 InvestTracker Frontend SPA Server listening on http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping frontend server...")
        httpd.server_close()


if __name__ == '__main__':
    run()
