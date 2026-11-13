"""Media integrity checks. Requires FFmpeg/FFprobe, not a browser or network."""
from pathlib import Path
import hashlib
import json
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / 'assets' / 'media'
ORIGINALS = {
    'source-fn.mp4': '6f3923f0ac54fbc030d6e6d4733f405abecb48561d909f16da2db4d9788f6b53',
    'source-terminal.mp4': '674eff29f2e6623d2b88bda24215fe53e40f3ccd5b378b14c0a9f9debc27cc0d',
}

def check(condition, message):
    if not condition:
        raise AssertionError(message)
    print('PASS:', message)

for name, expected in ORIGINALS.items():
    check(hashlib.sha256((MEDIA / name).read_bytes()).hexdigest() == expected,
          f'{name}: original upload unchanged')

for name, dimensions in [('hero-loop.mp4', (1280, 720)), ('hero-mobile.mp4', (854, 480))]:
    file = MEDIA / name
    info = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(file)
    ]))
    streams = info['streams']
    check(len(streams) == 1 and streams[0]['codec_type'] == 'video', f'{name}: no audio track')
    check(streams[0]['codec_name'] == 'h264' and streams[0]['pix_fmt'] == 'yuv420p', f'{name}: H.264 / yuv420p')
    check((streams[0]['width'], streams[0]['height']) == dimensions, f'{name}: dimensions {dimensions}')
    check(abs(float(info['format']['duration']) - 14.166667) < .05, f'{name}: terminal-only hero sequence')
    # Read MP4 atom boundaries, not arbitrary occurrences in compressed data.
    atoms = []
    with file.open('rb') as f:
        while True:
            header = f.read(8)
            if len(header) < 8:
                break
            size, atom = struct.unpack('>I4s', header)
            if size == 1:
                size = struct.unpack('>Q', f.read(8))[0]
                header_size = 16
            else:
                header_size = 8
            atoms.append(atom)
            if size == 0:
                break
            f.seek(size - header_size, 1)
    check(atoms.index(b'moov') < atoms.index(b'mdat'), f'{name}: faststart enabled')
    subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(file), '-f', 'null', '-'], check=True)
    check(True, f'{name}: every frame decodes without errors')
    frames = subprocess.check_output([
        'ffmpeg', '-v', 'error', '-i', str(file), '-vf', 'scale=32:18',
        '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'
    ])
    frame_size = 32 * 18 * 3
    first, last = frames[:frame_size], frames[-frame_size:]
    difference = sum(abs(a-b) for a, b in zip(first, last)) / frame_size
    check(difference < 8, f'{name}: loop boundary mean RGB difference {difference:.2f}/255 (<8)')

check((MEDIA / 'hero-poster.webp').stat().st_size < 60000, 'poster smaller than 60 KB')
print('All media checks passed. These checks do not replace visual browser/device QA.')
