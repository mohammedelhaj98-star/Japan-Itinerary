# What's in a photo: the faces (where, and a face print each) and the people (where, and what they're wearing).
# Runs in the faces container (workers/faces), so no phone downloads a model.
# - Faces: InsightFace's buffalo_l pack (SCRFD finds them, ArcFace w600k_r50 turns each into 512 numbers). Two photos of
#   the same person give prints that point the same way (cosine ~0.5 and up), two people apart (~0.1). Non-commercial use.
# - People: YOLOX-s (Apache 2.0), COCO's "person".
# Answers in the shape js/faces.js reads: { f: [{ x, y, w, h, q, s }], b: [{ x, y, w, h, s, o, fi }] }, boxes as shares.
import base64, io, os
import numpy as np, cv2, onnxruntime as ort
from PIL import Image, ImageOps

M = os.environ.get('MODELS', '/models/')
opt = ort.SessionOptions(); opt.intra_op_num_threads = 2; opt.inter_op_num_threads = 1
P = ['CPUExecutionProvider']
det = ort.InferenceSession(M + 'det_10g.onnx', opt, providers=P)
rec = ort.InferenceSession(M + 'w600k_r50.onnx', opt, providers=P)
yol = ort.InferenceSession(M + 'yolox_s.onnx', opt, providers=P)
K = 400  # prints kept as whole numbers: value × K, in -127…127 (the values stay within ±0.3)
r3 = lambda v: round(float(v), 3)


def picture(data, rot=0):
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB')
    if rot: im = im.rotate(-rot, expand=True)  # (turned clockwise, like the page shows it)
    k = min(1, 800 / max(im.size))
    if k < 1: im = im.resize((round(im.width * k), round(im.height * k)), Image.BILINEAR)
    return np.asarray(im)  # RGB, h × w × 3


def nms(boxes, scores, th):
    order, keep = scores.argsort()[::-1], []
    while order.size:
        i = order[0]; keep.append(i)
        xx1 = np.maximum(boxes[i, 0], boxes[order[1:], 0]); yy1 = np.maximum(boxes[i, 1], boxes[order[1:], 1])
        xx2 = np.minimum(boxes[i, 2], boxes[order[1:], 2]); yy2 = np.minimum(boxes[i, 3], boxes[order[1:], 3])
        inter = np.maximum(0, xx2 - xx1) * np.maximum(0, yy2 - yy1)
        area = lambda b: (b[..., 2] - b[..., 0]) * (b[..., 3] - b[..., 1])
        order = order[1:][inter / (area(boxes[i]) + area(boxes[order[1:]]) - inter + 1e-9) <= th]
    return keep


def faces(img, th=0.5):
    """SCRFD at 640: boxes (x0, y0, x1, y1) in pixels, scores, 5 landmarks each."""
    h, w = img.shape[:2]; S = 640; k = S / max(h, w); nh, nw = round(h * k), round(w * k)
    pad = np.zeros((S, S, 3), np.float32); pad[:nh, :nw] = cv2.resize(img, (nw, nh))
    x = ((pad - 127.5) / 128).transpose(2, 0, 1)[None].astype(np.float32)
    out = det.run(None, {det.get_inputs()[0].name: x})
    B, Sc, Kp = [], [], []
    for j, st in enumerate((8, 16, 32)):
        sc, bb, kp = out[j][:, 0], out[j + 3] * st, out[j + 6] * st
        g = S // st; cy, cx = np.mgrid[:g, :g]; c = np.stack([cx, cy], -1).reshape(-1, 2) * st; c = np.repeat(c, 2, 0)
        m = sc >= th
        if not m.any(): continue
        c, bb, kp = c[m], bb[m], kp[m]
        B.append(np.concatenate([c - bb[:, :2], c + bb[:, 2:]], 1)); Sc.append(sc[m])
        Kp.append(np.stack([c[:, 0:1] + kp[:, 0::2], c[:, 1:2] + kp[:, 1::2]], -1))
    if not B: return []
    B, Sc, Kp = np.concatenate(B) / k, np.concatenate(Sc), np.concatenate(Kp) / k
    return [(B[i], Sc[i], Kp[i]) for i in nms(B, Sc, 0.4)]


ARC = np.array([[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]], np.float32)


def prints(img, kps):
    if not kps: return []
    crops = []
    for kp in kps:
        T, _ = cv2.estimateAffinePartial2D(kp.astype(np.float32), ARC, method=cv2.LMEDS)
        crops.append(cv2.warpAffine(img, T, (112, 112), borderValue=0))
    x = ((np.stack(crops).astype(np.float32) - 127.5) / 127.5).transpose(0, 3, 1, 2)
    v = rec.run(None, {rec.get_inputs()[0].name: x})[0]
    return v / np.linalg.norm(v, axis=1, keepdims=True)


def pack(v):
    return base64.b64encode((np.clip(np.round(v * K), -127, 127).astype(np.int8)).tobytes()).decode()


def people(img, th=0.5):
    """YOLOX-s at 640 (raw pixels, BGR, grey padding): boxes of people as shares, with their scores."""
    h, w = img.shape[:2]; S = 640; k = min(S / h, S / w); nh, nw = int(h * k), int(w * k)
    pad = np.full((S, S, 3), 114, np.float32); pad[:nh, :nw] = cv2.resize(img[:, :, ::-1], (nw, nh))
    o = yol.run(None, {'images': pad.transpose(2, 0, 1)[None]})[0][0]
    G, St = [], []
    for st in (8, 16, 32):
        g = S // st; yy, xx = np.mgrid[:g, :g]; G.append(np.stack([xx, yy], -1).reshape(-1, 2)); St.append(np.full((g * g, 1), st))
    G, St = np.concatenate(G), np.concatenate(St)
    xy, wh = (o[:, :2] + G) * St, np.exp(o[:, 2:4]) * St; sc = o[:, 4] * o[:, 5]  # (class 0: person)
    m = sc >= th
    if not m.any(): return []
    b = np.concatenate([xy[m] - wh[m] / 2, xy[m] + wh[m] / 2], 1) / k; sc = sc[m]
    out = []
    for i in nms(b, sc, 0.5)[:12]:
        x0, y0, x1, y1 = max(0, b[i, 0] / w), max(0, b[i, 1] / h), min(1, b[i, 2] / w), min(1, b[i, 3] / h)
        out.append({'x': r3(x0), 'y': r3(y0), 'w': r3(x1 - x0), 'h': r3(y1 - y0), 's': r3(sc[i])})
    return out


BINS = 28


def outfit(img, p, face):
    """What someone's wearing: the colours of their top half, below the face (or the head), as 28 shares (as before)."""
    h, w = img.shape[:2]
    top = min(p['y'] + p['h'], face['y'] + face['h'] * 1.3) if face else p['y'] + p['h'] * 0.22
    bot = min(p['y'] + p['h'], top + p['h'] * 0.35); x0, x1 = p['x'] + p['w'] * 0.2, p['x'] + p['w'] * 0.8
    if bot - top < 0.02 or x1 - x0 < 0.02: return None
    a = img[round(top * h):max(round(top * h) + 1, round(bot * h)), round(x0 * w):max(round(x0 * w) + 1, round(x1 * w))].reshape(-1, 3)
    a = a[::max(1, len(a) // 2500)].astype(np.float32) / 255
    mx, mn = a.max(1), a.min(1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-9), 0)
    hist = np.zeros(BINS)
    grey = (sat < 0.22) | (mx < 0.18)
    np.add.at(hist, 24 + np.minimum(3, (mx[grey] * 4).astype(int)), 1)
    c = a[~grey]; cx, cn, cs = mx[~grey], mn[~grey], sat[~grey]; d = cx - cn
    r, g, b = c[:, 0], c[:, 1], c[:, 2]
    hue = np.where(cx == r, (g - b) / d, np.where(cx == g, 2 + (b - r) / d, 4 + (r - g) / d))
    hue = (hue * 60 + 360) % 360
    np.add.at(hist, (hue // 30).astype(int) * 2 + (cs > 0.55), 1)
    hist = np.round(hist / (hist.sum() or 1) * 255).astype(np.uint8)
    return base64.b64encode(hist.tobytes()).decode()


def look(data, rot=0):
    img = picture(data, rot); h, w = img.shape[:2]
    found = faces(img); vs = prints(img, [kp for _, _, kp in found])
    f = [{'x': r3(b[0] / w), 'y': r3(b[1] / h), 'w': r3((b[2] - b[0]) / w), 'h': r3((b[3] - b[1]) / h), 'q': pack(v), 's': r3(s)}
         for (b, s, _), v in zip(found, vs)]
    bs = []
    for p in people(img):
        # their face: one whose middle is in the top part of them (the first such, as before)
        fi = next((i for i, x in enumerate(f) if p['x'] < x['x'] + x['w'] / 2 < p['x'] + p['w'] and p['y'] < x['y'] + x['h'] / 2 < p['y'] + p['h'] * 0.45), -1)
        bs.append({**p, 'o': outfit(img, p, f[fi] if fi >= 0 else None), 'fi': fi})
    return {'f': f, 'b': bs}
