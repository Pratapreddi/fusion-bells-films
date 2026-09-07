import urllib.request
import urllib.parse
import json
import os
import sys

project_id = 'b1ttdr7e'
dataset = 'production'
token = 'skCv0fuL9SK2hfrSPnFk2pvrtRn4HCBnU5ZPbbA82VkcDCsIsRtx5v3ImcWnWTVb5T6hW2Dj2t5rF586yTrqV22fkwHJj1ZheuOBJcDKaPcgKJarUQnkkONEUh4Vk1iZQRR5VfDSLmWv6jpxsrh4Cg7Fy4RoArciJ7oPunWCCyIu3yBJnYZV'

if len(sys.argv) > 1:
    file_path = sys.argv[1]
else:
    file_path = r'c:\Users\ANANTU\Downloads\FBF\fusion-bells-films\fusion-bells-films\video\Sudha & Chethan.mp4'

filename = os.path.basename(file_path)
encoded_filename = urllib.parse.quote(filename)
url = f'https://{project_id}.api.sanity.io/v2021-06-07/assets/files/{dataset}?filename={encoded_filename}'

file_size = os.path.getsize(file_path)
print(f'Starting upload: {filename} ({file_size} bytes / {file_size / (1024*1024):.2f} MB)...', flush=True)

with open(file_path, 'rb') as f:
    data = f.read()

req = urllib.request.Request(url, data=data, method='POST')
req.add_header('Authorization', f'Bearer {token}')
req.add_header('Content-Type', 'video/mp4')

try:
    with urllib.request.urlopen(req) as response:
        resp_text = response.read().decode('utf-8')
        result = json.loads(resp_text)
        print('Upload successful!', flush=True)
        print(json.dumps(result, indent=2), flush=True)
        if 'document' in result and 'url' in result['document']:
            print(f"\nCDN_URL: {result['document']['url']}", flush=True)
except urllib.error.HTTPError as e:
    err_body = e.read().decode('utf-8')
    print(f'HTTP Error {e.code}: {err_body}', flush=True)
except Exception as e:
    print(f'Error: {e}', flush=True)
