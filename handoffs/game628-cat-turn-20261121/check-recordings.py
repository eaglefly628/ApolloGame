"""Audit standard Chromium WebM capture packets and exact station/camera metadata."""
from collections import Counter
from pathlib import Path
import json

EVIDENCE = Path(__file__).resolve().parent / 'evidence'

def vint(data, start, strip):
    size = next(k for k in range(1,9) if data[start] & (0x100 >> k))
    value = int.from_bytes(data[start:start+size], 'big')
    if strip:
        value ^= 1 << (7*size)
    return value, start+size, size

def scan(data, lo, hi, found):
    while lo < hi:
        tag, index, _ = vint(data, lo, False)
        size, next_index, width = vint(data, index, True)
        stop = hi if size == 2**(width*7)-1 else min(next_index+size, hi)
        found[tag] += 1
        if tag in {0x18538067, 0x1f43b675, 0x1654ae6b, 0xae, 0xe0, 0xa0}:
            scan(data, next_index, stop, found)
        lo = stop

capture = {}
for when in ('day','night'):
    stem = EVIDENCE / f'cat-{when}'
    video = stem.with_suffix('.webm').read_bytes()
    meta = json.loads(stem.with_suffix('.json').read_text())
    counts = Counter()
    scan(video, 0, len(video), counts)
    packets = counts[0xa1]+counts[0xa3]
    assert packets >= 65 and meta['bytes'] == len(video), (when,packets)
    assert not meta['cameraOverride'] and not meta['canvasCrop']
    assert meta['begin']['camera'] == meta['end']['camera']
    assert meta['begin']['player'] == meta['end']['player']
    capture[when] = {'packets':packets, **meta}
assert capture['day']['begin']['camera'] == capture['night']['begin']['camera']
assert capture['day']['begin']['player'] == capture['night']['begin']['player']
assert capture['day']['begin']['sun'] > capture['night']['begin']['sun']
(EVIDENCE/'recordings-audit.json').write_text(json.dumps(capture,ensure_ascii=False,indent=2)+'\n')
for when, meta in capture.items():
    print(when, meta['packets'], f"{meta['seconds']:.2f} seconds", meta['begin']['canvas'])
