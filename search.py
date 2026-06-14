import json

log_file = r'C:\Users\YUSUF\.gemini\antigravity\brain\ab06483c-a29c-491c-baf8-b6565a0bf966\.system_generated\logs\transcript.jsonl'
with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if data.get('type') == 'USER_INPUT':
            content = data.get('content', '').lower()
            if 'mutfak' in content or 'depo' in content:
                print("USER INPUT:", content)
