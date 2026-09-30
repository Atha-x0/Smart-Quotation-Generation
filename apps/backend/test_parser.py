import requests

files = {'files': open('test.pdf', 'rb')}
response = requests.post('http://127.0.0.1:8000/api/extract-multiple', files=files)
with open('output.json', 'w') as f:
    f.write(response.text)
