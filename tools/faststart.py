"""Move an MP4's `moov` index in front of `mdat` so playback can begin before
the file has finished downloading (what `ffmpeg -movflags +faststart` does).

Chunk offsets inside moov are absolute file positions, so every stco/co64
entry must be shifted by however far moov moved.
"""
import struct, sys, shutil

def top_boxes(buf):
    i, out = 0, []
    n = len(buf)
    while i + 8 <= n:
        size = struct.unpack('>I', buf[i:i+4])[0]
        typ = buf[i+4:i+8]
        hdr = 8
        if size == 1:                      # 64-bit extended size
            size = struct.unpack('>Q', buf[i+8:i+16])[0]
            hdr = 16
        elif size == 0:
            size = n - i
        if size < hdr:
            raise ValueError('bad box size at %d' % i)
        out.append((typ, i, size, hdr))
        i += size
    return out

def patch_offsets(moov, shift):
    """Add `shift` to every chunk offset in every stco/co64 inside moov."""
    buf = bytearray(moov)
    for tag, entry_size, unpack, pack in (
            (b'stco', 4, '>I', '>I'),
            (b'co64', 8, '>Q', '>Q')):
        pos = 0
        while True:
            pos = buf.find(tag, pos)
            if pos == -1:
                break
            # the atom's size field sits 4 bytes before its type
            body = pos + 4 + 4            # skip type + version/flags
            count = struct.unpack('>I', buf[body:body+4])[0]
            table = body + 4
            if table + count * entry_size > len(buf):
                pos += 4
                continue
            for k in range(count):
                off = table + k * entry_size
                val = struct.unpack(unpack, buf[off:off+entry_size])[0]
                struct.pack_into(pack, buf, off, val + shift)
            pos = table + count * entry_size
    return bytes(buf)

def faststart(path):
    data = open(path, 'rb').read()
    boxes = top_boxes(data)
    kinds = [b[0] for b in boxes]
    if b'moov' not in kinds or b'mdat' not in kinds:
        return 'skipped (no moov/mdat)'
    if kinds.index(b'moov') < kinds.index(b'mdat'):
        return 'already faststart'

    moov = next(b for b in boxes if b[0] == b'moov')
    mdat = next(b for b in boxes if b[0] == b'mdat')
    moov_bytes = data[moov[1]:moov[1] + moov[2]]
    patched = patch_offsets(moov_bytes, len(moov_bytes))

    out = bytearray()
    for typ, start, size, _hdr in boxes:          # everything before mdat
        if typ == b'moov':
            continue
        if start < mdat[1]:
            out += data[start:start + size]
    out += patched                                 # index goes here
    for typ, start, size, _hdr in boxes:          # mdat and anything after
        if typ == b'moov' or start < mdat[1]:
            continue
        out += data[start:start + size]

    shutil.copyfile(path, path + '.bak')
    open(path, 'wb').write(bytes(out))
    return 'moved moov to front (+%d bytes shift)' % len(moov_bytes)

for p in sys.argv[1:]:
    print(p, '->', faststart(p))
