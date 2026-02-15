"""
Example Python Application
This is a template - replace with your actual application code
"""

import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

PORT = 8001

class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                'status': 'healthy',
                'service': 'python-app',
                'environment': os.getenv('ENV', 'development')
            }
            self.wfile.write(json.dumps(response).encode())
        elif self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                'message': 'Doc Intelligence Python App',
                'version': '1.0.0',
                'environment': os.getenv('ENV', 'development')
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')
    
    def log_message(self, format, *args):
        # Custom logging
        print(f"[{self.address_string()}] {format % args}")

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), RequestHandler)
    print(f'Python app listening on http://localhost:{PORT}')
    server.serve_forever()
