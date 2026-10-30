#!/usr/bin/env python3
"""
WealthNest Icon Generator
Generates all desktop (Windows, macOS, Linux), Android mobile, and web icons
from the master 1024x1024 source image without requiring external image packages.
"""

import os
import sys
import math
import struct
import zlib
import ctypes
from collections import deque

def decode_jpeg(file_path):
    """Decodes a JPEG file into raw RGB bytearray using system libjpeg."""
    lib = ctypes.CDLL('libjpeg.so.8')

    class JpegErrorMgr(ctypes.Structure):
        _fields_ = [
            ('error_exit', ctypes.c_void_p),
            ('emit_message', ctypes.c_void_p),
            ('output_message', ctypes.c_void_p),
            ('format_message', ctypes.c_void_p),
            ('reset_error_mgr', ctypes.c_void_p),
            ('msg_code', ctypes.c_int),
            ('msg_parm', ctypes.c_byte * 80),
            ('trace_level', ctypes.c_int),
            ('num_warnings', ctypes.c_long),
            ('jpeg_message_table', ctypes.c_void_p),
            ('last_jpeg_message', ctypes.c_int),
            ('addon_message_table', ctypes.c_void_p),
            ('first_addon_message', ctypes.c_int),
            ('last_addon_message', ctypes.c_int),
        ]

    jerr = JpegErrorMgr()
    lib.jpeg_std_error(ctypes.byref(jerr))

    cinfo = (ctypes.c_byte * 656)()
    ctypes.cast(cinfo, ctypes.POINTER(ctypes.c_void_p))[0] = ctypes.cast(ctypes.byref(jerr), ctypes.c_void_p).value

    lib.jpeg_CreateDecompress(cinfo, 80, 656)

    with open(file_path, 'rb') as f:
        jpeg_data = f.read()

    lib.jpeg_mem_src.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_ulong]
    lib.jpeg_mem_src(cinfo, jpeg_data, len(jpeg_data))

    lib.jpeg_read_header.argtypes = [ctypes.c_void_p, ctypes.c_int]
    lib.jpeg_read_header(cinfo, 1)

    lib.jpeg_start_decompress.argtypes = [ctypes.c_void_p]
    lib.jpeg_start_decompress(cinfo)

    w = 1024
    h = 1024
    row_stride = w * 3
    row_buf = (ctypes.c_byte * row_stride)()
    row_ptr = (ctypes.c_void_p * 1)(ctypes.cast(row_buf, ctypes.c_void_p))

    lib.jpeg_read_scanlines.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint]
    rows = []
    for _ in range(h):
        lib.jpeg_read_scanlines(cinfo, row_ptr, 1)
        rows.append(bytes(row_buf))

    lib.jpeg_finish_decompress(cinfo)
    lib.jpeg_destroy_decompress(cinfo)

    return w, h, bytearray(b''.join(rows))


def create_rgba_with_feathered_corners(w, h, rgb_data):
    """
    Flood fills outer white corners from (0,0), (w-1,0), (0,h-1), (w-1,h-1)
    and produces a crisp anti-aliased RGBA bytearray.
    """
    # 1. Flood fill white corners
    visited = bytearray(w * h)
    queue = deque([(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)])
    for x, y in queue:
        visited[y * w + x] = 1

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                idx = ny * w + nx
                if not visited[idx]:
                    p_off = idx * 3
                    r, g, b = rgb_data[p_off], rgb_data[p_off + 1], rgb_data[p_off + 2]
                    # Any near-white pixel in outer corner region
                    if r > 240 and g > 240 and b > 240:
                        visited[idx] = 1
                        queue.append((nx, ny))

    # 2. Compute distance-based smooth alpha for border pixels
    raw_alpha = bytearray(w * h)
    for i in range(w * h):
        raw_alpha[i] = 0 if visited[i] else 255

    # 2-pass 3x3 anti-aliasing blur on alpha near boundary
    smoothed_alpha = bytearray(raw_alpha)
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            idx = y * w + x
            # Only smooth border pixels
            if visited[idx] == 0:
                # Check neighbors
                has_visited_neighbor = (
                    visited[idx - 1] or visited[idx + 1] or
                    visited[idx - w] or visited[idx + w]
                )
                if has_visited_neighbor:
                    # Average 3x3
                    tot = sum(
                        raw_alpha[(y + dy) * w + (x + dx)]
                        for dy in (-1, 0, 1)
                        for dx in (-1, 0, 1)
                    )
                    smoothed_alpha[idx] = int(tot / 9)

    rgba = bytearray(w * h * 4)
    for y in range(h):
        for x in range(w):
            s_idx = (y * w + x) * 3
            d_idx = (y * w + x) * 4
            a = smoothed_alpha[y * w + x]
            rgba[d_idx] = rgb_data[s_idx]
            rgba[d_idx + 1] = rgb_data[s_idx + 1]
            rgba[d_idx + 2] = rgb_data[s_idx + 2]
            rgba[d_idx + 3] = a

    return rgba


def downsample_rgba(src, src_w, src_h, dst_w, dst_h):
    """High quality area-box downsampling for RGBA image."""
    dst = bytearray(dst_w * dst_h * 4)
    x_scale = src_w / dst_w
    y_scale = src_h / dst_h

    for dy in range(dst_h):
        sy0 = int(dy * y_scale)
        sy1 = int((dy + 1) * y_scale)
        if sy1 <= sy0:
            sy1 = sy0 + 1
        if sy1 > src_h:
            sy1 = src_h

        for dx in range(dst_w):
            sx0 = int(dx * x_scale)
            sx1 = int((dx + 1) * x_scale)
            if sx1 <= sx0:
                sx1 = sx0 + 1
            if sx1 > src_w:
                sx1 = src_w

            r_sum = g_sum = b_sum = a_sum = count = 0
            for sy in range(sy0, sy1):
                row_off = sy * src_w * 4
                for sx in range(sx0, sx1):
                    p_off = row_off + sx * 4
                    r_sum += src[p_off]
                    g_sum += src[p_off + 1]
                    b_sum += src[p_off + 2]
                    a_sum += src[p_off + 3]
                    count += 1

            d_off = (dy * dst_w + dx) * 4
            dst[d_off] = r_sum // count
            dst[d_off + 1] = g_sum // count
            dst[d_off + 2] = b_sum // count
            dst[d_off + 3] = a_sum // count

    return dst


def make_round_icon(rgba, size):
    """Applies a circular mask with anti-aliased edge to produce Android round icons."""
    out = bytearray(rgba)
    cx = size / 2.0
    cy = size / 2.0
    radius = (size / 2.0) - 0.5

    for y in range(size):
        for x in range(size):
            dist = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            idx = (y * size + x) * 4
            if dist > radius + 0.5:
                out[idx + 3] = 0
            elif dist > radius - 0.5:
                # Anti-alias boundary
                factor = (radius + 0.5 - dist)
                orig_a = out[idx + 3]
                out[idx + 3] = int(orig_a * factor)
    return out


def make_adaptive_foreground(src_rgba, src_size, target_size):
    """
    Generates Android adaptive icon foreground (108dp canvas).
    The icon is placed inside the 72dp safe zone (~66.6% scale) on a transparent canvas.
    """
    canvas = bytearray(target_size * target_size * 4)  # All zeros = transparent
    badge_size = int(target_size * 0.72)
    resized_badge = downsample_rgba(src_rgba, src_size, src_size, badge_size, badge_size)

    offset_x = (target_size - badge_size) // 2
    offset_y = (target_size - badge_size) // 2

    for by in range(badge_size):
        cy = offset_y + by
        for bx in range(badge_size):
            cx = offset_x + bx
            s_idx = (by * badge_size + bx) * 4
            d_idx = (cy * target_size + cx) * 4
            canvas[d_idx] = resized_badge[s_idx]
            canvas[d_idx + 1] = resized_badge[s_idx + 1]
            canvas[d_idx + 2] = resized_badge[s_idx + 2]
            canvas[d_idx + 3] = resized_badge[s_idx + 3]

    return canvas


def write_png_bytes(width, height, rgba_data):
    """Encodes raw RGBA bytes into standard PNG file bytes."""
    stride = width * 4
    raw_rows = []
    for y in range(height):
        raw_rows.append(b'\x00' + rgba_data[y * stride : (y + 1) * stride])
    raw_data = b''.join(raw_rows)
    compressed = zlib.compress(raw_data, level=9)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')


def save_png(path, width, height, rgba_data):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    png_bytes = write_png_bytes(width, height, rgba_data)
    with open(path, 'wb') as f:
        f.write(png_bytes)
    return png_bytes


def build_ico(images_png_list):
    """
    Creates a multi-resolution Windows .ico file containing PNG images.
    images_png_list: list of (width, height, png_bytes)
    """
    num_images = len(images_png_list)
    header = struct.pack('<HHH', 0, 1, num_images)
    entries = []
    offset = 6 + 16 * num_images
    data_blobs = []

    for w, h, png_bytes in images_png_list:
        bw = 0 if w >= 256 else w
        bh = 0 if h >= 256 else h
        entry = struct.pack('<BBBBHHII', bw, bh, 0, 0, 1, 32, len(png_bytes), offset)
        entries.append(entry)
        data_blobs.append(png_bytes)
        offset += len(png_bytes)

    return header + b''.join(entries) + b''.join(data_blobs)


def build_icns(tagged_images):
    """
    Creates a macOS .icns file containing PNG images.
    tagged_images: list of (4-byte tag, png_bytes)
    """
    entries = []
    for tag, png_bytes in tagged_images:
        entry_len = 8 + len(png_bytes)
        entries.append(tag + struct.pack('>I', entry_len) + png_bytes)
    body = b''.join(entries)
    total_len = 8 + len(body)
    return b'icns' + struct.pack('>I', total_len) + body


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    source_jpg = os.path.join(project_root, 'src-tauri', 'icons', 'source_app_icon.jpg')

    if not os.path.exists(source_jpg):
        print(f"❌ Error: Master icon not found at {source_jpg}")
        sys.exit(1)

    print("==================================================")
    print(" WealthNest — Automated Multi-Platform Icon Generator")
    print("==================================================")
    print(f"Master Source Image : {source_jpg}")

    # 1. Decode JPEG
    print("--- [1/5] Decoding Master JPEG (1024x1024) ---")
    w, h, rgb_data = decode_jpeg(source_jpg)
    print(f"✅ Decoded {w}x{h} master image successfully.")

    # 2. Extract Squircle Alpha & Feather Boundary
    print("--- [2/5] Extracting Outer Alpha Mask & Feathering Edges ---")
    master_rgba = create_rgba_with_feathered_corners(w, h, rgb_data)
    save_png(os.path.join(project_root, 'src-tauri', 'icons', 'master-1024.png'), 1024, 1024, master_rgba)

    # 3. Generate Desktop Tauri Icons
    print("--- [3/5] Generating Tauri Desktop Icons (Windows, macOS, Linux) ---")
    icons_dir = os.path.join(project_root, 'src-tauri', 'icons')

    sizes = {
        '32x32.png': (32, 32),
        '128x128.png': (128, 128),
        '128x128@2x.png': (256, 256),
        'icon.png': (512, 512),
    }

    png_cache = {}
    for filename, (sw, sh) in sizes.items():
        resized = downsample_rgba(master_rgba, 1024, 1024, sw, sh)
        p = os.path.join(icons_dir, filename)
        b = save_png(p, sw, sh, resized)
        png_cache[sw] = (resized, b)
        print(f"  ✓ Created {filename} ({sw}x{sh})")

    # Generate extra resolutions for ICO (16, 24, 32, 48, 64, 128, 256)
    ico_res_list = [16, 24, 32, 48, 64, 128, 256]
    ico_images = []
    for sz in ico_res_list:
        if sz in png_cache:
            ico_images.append((sz, sz, png_cache[sz][1]))
        else:
            resized = downsample_rgba(master_rgba, 1024, 1024, sz, sz)
            b = write_png_bytes(sz, sz, resized)
            ico_images.append((sz, sz, b))

    ico_path = os.path.join(icons_dir, 'icon.ico')
    with open(ico_path, 'wb') as f:
        f.write(build_ico(ico_images))
    print(f"  ✓ Created icon.ico (Multi-Resolution Windows Icon: 16 to 256px)")

    # Generate ICNS for macOS (16, 32, 64, 128, 256, 512, 1024)
    icns_map = [
        (b'icp4', 16),
        (b'icp5', 32),
        (b'icp6', 64),
        (b'ic07', 128),
        (b'ic08', 256),
        (b'ic09', 512),
        (b'ic10', 1024),
    ]
    icns_entries = []
    for tag, sz in icns_map:
        if sz == 1024:
            b = write_png_bytes(1024, 1024, master_rgba)
        elif sz in png_cache:
            b = png_cache[sz][1]
        else:
            resized = downsample_rgba(master_rgba, 1024, 1024, sz, sz)
            b = write_png_bytes(sz, sz, resized)
        icns_entries.append((tag, b))

    icns_path = os.path.join(icons_dir, 'icon.icns')
    with open(icns_path, 'wb') as f:
        f.write(build_icns(icns_entries))
    print(f"  ✓ Created icon.icns (Apple macOS Retina Icon)")

    # 4. Generate Android Mobile Icons
    print("--- [4/5] Generating Android Mobile Launcher Icons (Mipmap MDPI to XXXHDPI) ---")
    android_scales = {
        'mipmap-mdpi': (48, 108),
        'mipmap-hdpi': (72, 162),
        'mipmap-xhdpi': (96, 216),
        'mipmap-xxhdpi': (144, 324),
        'mipmap-xxxhdpi': (192, 432),
    }

    # Store in src-tauri/icons/android/ (git-tracked permanent storage)
    android_repo_dir = os.path.join(icons_dir, 'android')
    # Also if src-tauri/gen/android exists, sync there too
    android_live_res_dir = os.path.join(project_root, 'src-tauri', 'gen', 'android', 'app', 'src', 'main', 'res')

    target_res_dirs = [android_repo_dir]
    if os.path.exists(android_live_res_dir):
        target_res_dirs.append(android_live_res_dir)

    for folder, (launcher_sz, adaptive_sz) in android_scales.items():
        # Standard launcher icon (squircle)
        std_rgba = downsample_rgba(master_rgba, 1024, 1024, launcher_sz, launcher_sz)
        # Round launcher icon
        round_rgba = make_round_icon(std_rgba, launcher_sz)
        # Adaptive foreground icon
        fg_rgba = make_adaptive_foreground(master_rgba, 1024, adaptive_sz)

        for base_dir in target_res_dirs:
            folder_path = os.path.join(base_dir, folder)
            os.makedirs(folder_path, exist_ok=True)
            save_png(os.path.join(folder_path, 'ic_launcher.png'), launcher_sz, launcher_sz, std_rgba)
            save_png(os.path.join(folder_path, 'ic_launcher_round.png'), launcher_sz, launcher_sz, round_rgba)
            save_png(os.path.join(folder_path, 'ic_launcher_foreground.png'), adaptive_sz, adaptive_sz, fg_rgba)

        print(f"  ✓ Generated {folder}: ic_launcher.png ({launcher_sz}px), ic_launcher_round.png, ic_launcher_foreground.png ({adaptive_sz}px)")

    # 5. Generate Web & PWA Icons
    print("--- [5/5] Generating Web Frontend / PWA Icons (apps/web/public) ---")
    web_public = os.path.join(project_root, 'apps', 'web', 'public')
    os.makedirs(web_public, exist_ok=True)

    # Favicon.ico (16, 32, 48)
    web_ico_list = [img for img in ico_images if img[0] in (16, 32, 48)]
    with open(os.path.join(web_public, 'favicon.ico'), 'wb') as f:
        f.write(build_ico(web_ico_list))

    # Standard web icons
    save_png(os.path.join(web_public, 'favicon.png'), 32, 32, png_cache[32][0])
    save_png(os.path.join(web_public, 'icon.png'), 512, 512, png_cache[512][0])

    # Apple touch icon (180x180)
    touch_rgba = downsample_rgba(master_rgba, 1024, 1024, 180, 180)
    save_png(os.path.join(web_public, 'apple-touch-icon.png'), 180, 180, touch_rgba)

    # PWA standard 192x192 & 512x512
    pwa192_rgba = downsample_rgba(master_rgba, 1024, 1024, 192, 192)
    save_png(os.path.join(web_public, 'icon-192.png'), 192, 192, pwa192_rgba)
    save_png(os.path.join(web_public, 'icon-512.png'), 512, 512, png_cache[512][0])

    print("  ✓ Created favicon.ico, favicon.png, apple-touch-icon.png, icon.png, icon-192.png, icon-512.png in apps/web/public/")

    print("==================================================")
    print("✅ All WealthNest Platform Icons Generated Successfully!")
    print("==================================================")

if __name__ == '__main__':
    main()

