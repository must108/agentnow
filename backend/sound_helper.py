import subprocess, numpy as np

def decode_webm_to_pcm16(path: str, target_sr: int = 16000) -> np.ndarray:
    cmd = [
        "ffmpeg", "-nostdin", "-v", "error",
        "-i", path,
        "-f", "s16le", "-acodec", "pcm_s16le",
        "-ac", "1", "-ar", str(target_sr),
        "pipe:1"
    ]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    pcm_bytes = p.stdout
    if not pcm_bytes:
        raise RuntimeError("FFmpeg produced no output.")
    audio_i16 = np.frombuffer(pcm_bytes, dtype=np.int16)
    audio_f32 = (audio_i16.astype(np.float32) / 32768.0).copy()
    return audio_f32
