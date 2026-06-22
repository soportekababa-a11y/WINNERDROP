import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import * as crypto from 'crypto';

const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

export interface HookItem { type: string; text: string; }
export interface AnalysisResult {
  adType: string;
  retentionLevel: string;
  marketingAngle: string;
  hooks: HookItem[];
}
export interface VideoResult {
  hookText: string;
  hookType: string;
  filename: string;
  url: string;
}

@Injectable()
export class HookInjectorService {
  private readonly logger = new Logger(HookInjectorService.name);
  private readonly anthropic: Anthropic;
  private readonly uploadsDir: string;

  constructor(private readonly config: ConfigService) {
    this.anthropic = new Anthropic({ apiKey: config.get('CLAUDE_API_KEY') });
    this.uploadsDir = path.join(process.cwd(), '..', 'uploads', 'hook-injector');
    fs.mkdirSync(this.uploadsDir, { recursive: true });
  }

  async analyzeVideo(buffer: Buffer, productName: string): Promise<AnalysisResult> {
    const tmpDir = path.join(os.tmpdir(), `hi_${crypto.randomUUID()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const videoPath = path.join(tmpDir, 'input.mp4');
    fs.writeFileSync(videoPath, buffer);
    try {
      const frames = await this.extractFrames(videoPath, tmpDir);
      return await this.callClaude(frames, productName);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  async generateVideos(
    buffer: Buffer,
    hooks: HookItem[],
    enableVoice: boolean,
  ): Promise<VideoResult[]> {
    const tmpDir = path.join(os.tmpdir(), `hi_${crypto.randomUUID()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const videoPath = path.join(tmpDir, 'input.mp4');
    fs.writeFileSync(videoPath, buffer);

    const { width: W, height: H } = await this.getVideoDimensions(videoPath);
    const hasAudio = await this.checkHasAudio(videoPath);
    const results: VideoResult[] = [];

    for (const hook of hooks.slice(0, 3)) {
      try {
        let voiceAudioPath: string | undefined;
        if (enableVoice) {
          voiceAudioPath = await this.generateVoice(hook.text, tmpDir).catch(e => {
            this.logger.warn(`Voice generation skipped: ${e.message}`);
            return undefined;
          });
        }
        const filename = `hook_${crypto.randomUUID()}.mp4`;
        const outPath = path.join(this.uploadsDir, filename);
        await this.buildVideo(videoPath, hook.text, outPath, W, H, hasAudio, voiceAudioPath);
        results.push({
          hookText: hook.text,
          hookType: hook.type,
          filename,
          url: `/hook-injector/download/${filename}`,
        });
      } catch (err: any) {
        this.logger.error(`Video gen failed for "${hook.text}": ${err.message}`);
      }
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
    return results;
  }

  getVideoPath(filename: string): string {
    return path.join(this.uploadsDir, path.basename(filename));
  }

  // ─── private helpers ────────────────────────────────────────────────────────

  private async extractFrames(videoPath: string, outDir: string): Promise<string[]> {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-i', videoPath,
        '-vf', 'fps=1,scale=640:-1',
        '-t', '5',
        '-f', 'image2',
        path.join(outDir, 'frame_%03d.jpg'),
      ]);
      proc.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg frames exit ${code}`)));
      proc.on('error', reject);
    });
    return fs.readdirSync(outDir)
      .filter(f => f.startsWith('frame_') && f.endsWith('.jpg'))
      .sort()
      .slice(0, 5)
      .map(f => path.join(outDir, f));
  }

  private async callClaude(framePaths: string[], productName: string): Promise<AnalysisResult> {
    const imageContent = framePaths.map(fp => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: fs.readFileSync(fp).toString('base64'),
      },
    }));

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: [
          ...imageContent,
          {
            type: 'text',
            text: `Eres un experto en marketing viral para TikTok y Reels. Analiza estas capturas del anuncio del producto "${productName}".

Responde SOLO con JSON válido sin markdown:
{
  "adType": "uno de: Problema→Solución|Curiosidad|Demostración|Transformación|Prueba Social|Oferta Directa",
  "retentionLevel": "Alto|Medio|Bajo",
  "marketingAngle": "descripción del ángulo actual en 1 oración concisa",
  "hooks": [
    {"type":"Curiosidad","text":"hook máx 14 palabras en español latino natural"},
    {"type":"Problema","text":"hook máx 14 palabras en español latino natural"},
    {"type":"Shock","text":"hook máx 14 palabras en español latino natural"},
    {"type":"Beneficio","text":"hook máx 14 palabras en español latino natural"},
    {"type":"UGC Viral","text":"hook máx 14 palabras en español latino natural"}
  ]
}

Reglas para los hooks:
- Máximo 14 palabras
- Natural, no suena a anuncio
- Para retención en primeros 3 segundos
- Español latino cotidiano`,
          },
        ],
      }],
    });

    const text = (response.content[0] as any).text;
    // Strip markdown code blocks if present
    const clean = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    return JSON.parse(clean);
  }

  private async getVideoDimensions(videoPath: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const proc = spawn('ffprobe', [
        '-v', 'quiet', '-print_format', 'json', '-show_streams', videoPath,
      ]);
      let out = '';
      proc.stdout.on('data', d => out += d.toString());
      proc.on('close', () => {
        try {
          const info = JSON.parse(out);
          const stream = info.streams?.find((s: any) => s.codec_type === 'video');
          resolve({ width: stream?.width ?? 1080, height: stream?.height ?? 1920 });
        } catch {
          resolve({ width: 1080, height: 1920 });
        }
      });
    });
  }

  private async checkHasAudio(videoPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('ffprobe', [
        '-v', 'quiet', '-print_format', 'json', '-show_streams', videoPath,
      ]);
      let out = '';
      proc.stdout.on('data', d => out += d.toString());
      proc.on('close', () => {
        try {
          const info = JSON.parse(out);
          resolve(info.streams?.some((s: any) => s.codec_type === 'audio') ?? false);
        } catch {
          resolve(false);
        }
      });
    });
  }

  private async generateVoice(text: string, tmpDir: string): Promise<string | undefined> {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) return undefined;
    const voiceId = this.config.get<string>('ELEVENLABS_VOICE_ID') ?? 'pNInz6obpgDQGcFmaJgB';
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const audioPath = path.join(tmpDir, `voice_${crypto.randomUUID()}.mp3`);
    fs.writeFileSync(audioPath, buf);
    return audioPath;
  }

  private wrapText(text: string): string {
    const words = text.split(' ');
    if (words.length <= 6) return text;
    const split = Math.ceil(words.length / 2);
    return words.slice(0, split).join(' ') + '__NL__' + words.slice(split).join(' ');
  }

  private escapeDrawtext(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/:/g, '\\:')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/__NL__/g, '\\n');
  }

  private async buildVideo(
    inputPath: string,
    hookText: string,
    outPath: string,
    W: number,
    H: number,
    hasAudio: boolean,
    voiceAudioPath?: string,
  ): Promise<void> {
    const fontSize = Math.max(48, Math.min(82, Math.round(W * 0.065)));
    const safeText = this.escapeDrawtext(this.wrapText(hookText));

    const useAudio = hasAudio || !!voiceAudioPath;
    const args: string[] = ['-y'];

    // [0] black intro background (4s)
    args.push('-f', 'lavfi', '-i', `color=black:s=${W}x${H}:r=30:d=4`);

    let introAudioIdx = -1;
    let origIdx: number;

    if (voiceAudioPath) {
      args.push('-i', voiceAudioPath);
      introAudioIdx = 1;
      args.push('-i', inputPath);
      origIdx = 2;
    } else if (hasAudio) {
      args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');
      introAudioIdx = 1;
      args.push('-i', inputPath);
      origIdx = 2;
    } else {
      args.push('-i', inputPath);
      origIdx = 1;
    }

    // Build drawtext with shadow for readability
    const dt = [
      `drawtext=fontfile=${FONT}`,
      `text='${safeText}'`,
      `fontcolor=white`,
      `fontsize=${fontSize}`,
      `x=(w-text_w)/2`,
      `y=(h-text_h)/2`,
      `alpha='if(lt(t,0.5),t/0.5,1)'`,
      `box=1`,
      `boxcolor=black@0.55`,
      `boxborderw=25`,
      `line_spacing=12`,
      `expansion=none`,
    ].join(':');

    const scale = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;

    let filterComplex: string;
    if (useAudio) {
      filterComplex = [
        `[0:v]${dt},setsar=1[vi]`,
        `[${origIdx}:v]${scale}[vo]`,
        introAudioIdx >= 0 ? `[${introAudioIdx}:a]atrim=0:4,aresample=44100[ai]` : null,
        `[${origIdx}:a]aresample=44100[ao]`,
        `[vi][vo]concat=n=2:v=1:a=0[outv]`,
        `[ai][ao]concat=n=2:v=0:a=1[outa]`,
      ].filter(Boolean).join(';');
      args.push('-filter_complex', filterComplex);
      args.push('-map', '[outv]', '-map', '[outa]');
      args.push('-c:v', 'libx264', '-c:a', 'aac', '-b:a', '128k');
    } else {
      filterComplex = [
        `[0:v]${dt},setsar=1[vi]`,
        `[${origIdx}:v]${scale}[vo]`,
        `[vi][vo]concat=n=2:v=1:a=0[outv]`,
      ].join(';');
      args.push('-filter_complex', filterComplex);
      args.push('-map', '[outv]');
      args.push('-c:v', 'libx264');
    }

    args.push('-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', outPath);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', args);
      let errOut = '';
      proc.stderr.on('data', d => errOut += d.toString());
      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exit ${code}: ${errOut.slice(-1000)}`));
      });
      proc.on('error', reject);
    });
  }
}
