"""CPU vocal separation and CTC refinement, launched by the desktop process."""
import json
import bisect
import pathlib
import re
import runpy
import sys

sys.path.insert(0, sys.argv[1])
request_path, output_path = sys.argv[2:4]
import torch
import torchaudio
import soundfile as sf

torch.set_num_threads(2)


def load_audio(path):
    samples, rate = sf.read(path, dtype='float32', always_2d=True)
    audio = torch.from_numpy(samples.T.copy())
    if audio.shape[-1] / rate > 900:
        raise ValueError('Поддерживаются песни до 15 минут')
    return audio, rate


def separate(request):
    load_audio(request['audioPath'])
    destination = pathlib.Path(request['directory']) / 'demucs'
    sys.argv = ['demucs', '-n', 'htdemucs', '--two-stems', 'vocals', '-d', 'cpu', '--shifts', '0', '--float32', '-o', str(destination), request['audioPath']]
    runpy.run_module('demucs', run_name='__main__')
    stem = destination / 'htdemucs' / pathlib.Path(request['audioPath']).stem / 'vocals.wav'
    audio, rate = load_audio(stem)
    audio = torchaudio.functional.resample(audio.mean(0, keepdim=True), rate, 16000)
    if not torch.isfinite(audio).all():
        raise ValueError('Demucs вернул некорректный вокал')
    sf.write(request['output'], audio[0].numpy(), 16000, subtype='PCM_16')
    return {'path': request['output']}


def score_spans(spans):
    count = sum(span.end - span.start for word in spans for span in word)
    if not count:
        return 0.0
    return sum(float(span.score) * (span.end - span.start) for word in spans for span in word) / count


def refine(request):
    import uroman
    romanizer = uroman.Uroman()
    bundle = torchaudio.pipelines.MMS_FA
    model = bundle.get_model().cpu().eval()
    tokenizer, aligner = bundle.get_tokenizer(), bundle.get_aligner()
    audio, rate = load_audio(request['audioPath'])
    audio = torchaudio.functional.resample(audio.mean(0, keepdim=True), rate, bundle.sample_rate)
    duration = audio.shape[-1] / bundle.sample_rate
    emissions, frame_times = [], []
    offset = 0
    with torch.inference_mode():
        for chunk in audio.split(bundle.sample_rate * 30, dim=-1):
            chunk_duration = chunk.shape[-1] / bundle.sample_rate
            if chunk.shape[-1] < bundle.sample_rate / 10:
                chunk = torch.nn.functional.pad(chunk, (0, bundle.sample_rate // 10 - chunk.shape[-1]))
            emission, _ = model(chunk)
            emissions.append(emission[0])
            frame_times.extend(offset + i * chunk_duration / emission.shape[1] for i in range(emission.shape[1]))
            offset += chunk_duration
    emission = torch.cat(emissions)
    frame_times.append(duration)
    result = []
    lines = request['lines']
    for index, line in enumerate(lines):
        original = dict(line)
        try:
            end = min(duration, lines[index + 1]['t'] if index + 1 < len(lines) else duration)
            start = line['t']
            words = line['text'].strip().split()
            normalized = [re.sub('[^a-z]', '', romanizer.romanize_string(word).lower()) for word in words]
            if not words or not all(normalized) or not 0 <= start < end:
                result.append(original)
                continue
            tokens = tokenizer(normalized)
            a = max(0, bisect.bisect_left(frame_times, start - 0.8))
            b = min(len(emission), bisect.bisect_left(frame_times, end + 0.8))
            baseline_a, baseline_b = bisect.bisect_left(frame_times, start), min(len(emission), bisect.bisect_left(frame_times, end))
            try:
                baseline = score_spans(aligner(emission[baseline_a:baseline_b], tokens))
            except RuntimeError:
                baseline = 0.0
            if line.get('confMethod') == 'mms-fa-v1':
                baseline = max(baseline, line.get('conf', 0))
            spans = aligner(emission[a:b], tokens)
            confidence = score_spans(spans)
            if confidence <= baseline + 0.005 or confidence < 0.5:
                result.append(original)
                continue
            timed = [{'text': word, 't': frame_times[a + pieces[0].start], 'b': frame_times[a + pieces[-1].end]} for word, pieces in zip(words, spans)]
            if len(timed) != len(words) or timed[-1]['b'] > duration:
                result.append(original)
                continue
            result.append({**line, 't': timed[0]['t'], 'words': timed, 'conf': confidence, 'previousConf': baseline, 'confMethod': 'mms-fa-v1'})
        except (ValueError, RuntimeError, KeyError, IndexError):
            result.append(original)
    return {'lines': result}


if __name__ == '__main__':
    request = json.loads(pathlib.Path(request_path).read_text(encoding='utf-8'))
    if request['task'] == 'check':
        import demucs.separate
        import uroman
        emission = torch.tensor([[[0., 5., 0.], [5., 0., 0.], [0., 0., 5.]]]).log_softmax(-1)
        aligned, _ = torchaudio.functional.forced_align(emission, torch.tensor([[1, 2]], dtype=torch.int32))
        assert aligned.tolist() == [[1, 0, 2]]
        result = {'ready': True}
    else:
        result = separate(request) if request['task'] == 'separate' else refine(request)
    pathlib.Path(output_path).write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
