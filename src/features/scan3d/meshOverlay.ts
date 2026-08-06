/// 🕸 Live wireframe scan overlay — LiDAR scanner app တွေရဲ့ "mesh က
/// မျက်နှာပြင်ပေါ် တက်လာတဲ့" မြင်ကွင်းကို browser မှာ ပြန်ဖန်တီးတယ်။
///
/// ★ ဘယ်လို အလုပ်လုပ်လဲ — video frame ကို grid အသေး (36×~48) ချုံ့ပြီး
///   luminance edge (sobel အကြမ်း) တွက်တယ်။ Texture/edge ရှိတဲ့ cell
///   တွေမှာသာ triangle စ ဆွဲတယ် — မျက်နှာပြင် ချောချော (ကောင်းကင်၊
///   နံရံဗလာ) မှာ mesh မပေါ်ဘဲ ပစ္စည်း/ထောင့်တွေပေါ် mesh ဖုံးသလို မြင်ရ။
/// ★ Coverage tint — capture လုပ်ပြီးသား sector တွေကို အနီရိပ် ဖုံးတယ်
///   (reference app ရဲ့ "scan မိပြီးသား နေရာ" အနီပြမှု)။
/// ★ getImageData က grid resolution လောက်ပဲ — frame တိုင်း ~2K pixel,
///   ဖုန်းမှာလည်း မလေးဘူး။

const GRID_W = 36;
const EDGE_MIN = 14;

export type MeshOverlay = {
  /// Frame တစ်ချပ် ဆွဲ — coverage (0..1) က red tint ပြင်းအား
  draw(video: HTMLVideoElement, covered: boolean, t: number): void;
  dispose(): void;
};

export function createMeshOverlay(canvas: HTMLCanvasElement): MeshOverlay {
  const sample = document.createElement("canvas");
  const sctx = sample.getContext("2d", { willReadFrequently: true });

  function draw(video: HTMLVideoElement, covered: boolean, t: number) {
    const ctx = canvas.getContext("2d");
    if (!ctx || !sctx || video.videoWidth === 0) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const gw = GRID_W;
    const gh = Math.max(8, Math.round((gw * video.videoHeight) / video.videoWidth));
    if (sample.width !== gw || sample.height !== gh) {
      sample.width = gw;
      sample.height = gh;
    }
    sctx.drawImage(video, 0, 0, gw, gh);
    const px = sctx.getImageData(0, 0, gw, gh).data;
    const lum = (x: number, y: number) => {
      const i = (y * gw + x) * 4;
      return px[i]! * 0.299 + px[i + 1]! * 0.587 + px[i + 2]! * 0.114;
    };

    const cw = w / (gw - 1);
    const ch = h / (gh - 1);
    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y < gh - 1; y++) {
      for (let x = 0; x < gw - 1; x++) {
        // sobel အကြမ်း — အနီးနားနဲ့ ကွာဟချက်
        const gx = Math.abs(lum(x + 1, y) - lum(x, y));
        const gy = Math.abs(lum(x, y + 1) - lum(x, y));
        if (gx + gy < EDGE_MIN) continue;
        // scan "အသက်ဝင်" နေအောင် နည်းနည်း တုန်ခါ
        const j = Math.sin(t * 0.004 + x * 1.7 + y * 2.3) * 1.5;
        const x0 = x * cw + j;
        const y0 = y * ch - j;
        const x1 = (x + 1) * cw;
        const y1 = (y + 1) * ch;
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y0);
        ctx.lineTo(x0, y1);
        ctx.lineTo(x0, y0);
        if ((x + y) % 2 === 0) {
          ctx.moveTo(x1, y0);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x0, y1);
        }
      }
    }
    ctx.stroke();

    // capture မိထားပြီးသား direction — အနီရိပ် (reference UI)
    if (covered) {
      ctx.fillStyle = "rgba(220,38,38,0.16)";
      ctx.fillRect(0, 0, w, h);
    }
  }

  return {
    draw,
    dispose() {
      sample.width = 0;
    },
  };
}
