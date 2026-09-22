import re

css_path = 'src/app/globals.css'

with open(css_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the QR section boundaries
lines = content.split('\n')

# Find start: line with 'QR CODE EVALUATION PAGE'
start_idx = None
for i, line in enumerate(lines):
    if 'QR CODE EVALUATION PAGE' in line:
        # Go back to find the comment start (/* ════)
        j = i - 1
        while j > 0 and not lines[j].strip().startswith('/*'):
            j -= 1
        start_idx = j if j >= 0 else i - 1
        break

# Find end: the second occurrence of '.qr-header {' after start_idx
header_count = 0
end_idx = None
for i in range(start_idx if start_idx else 0, len(lines)):
    if lines[i].strip().startswith('.qr-header {'):
        header_count += 1
        if header_count == 2:
            end_idx = i
            break

print(f'Start: {start_idx}, End: {end_idx}')

if start_idx is not None and end_idx is not None:
    # Keep everything before start_idx and from end_idx onwards
    new_content = '\n'.join(lines[:start_idx] + lines[end_idx:])
    
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f'Removed lines {start_idx+1} to {end_idx}')
else:
    print('Could not find section boundaries')
