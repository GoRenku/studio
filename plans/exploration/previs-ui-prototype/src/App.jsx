import { useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Film, Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/ui/button';
import { Slider } from '@/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
import { VideoPlayer } from '@/ui/video-player';
import { ShotDescriptionViewer } from '@/features/movie-studio/shot-plans/shot-description-viewer';
import { description, revisions, subjects, timecode } from './harbor-revisions';
import { usePrevisPlayback } from './use-previs-playback';

export function App() {
  const [page, setPage] = useState('previs');
  const [revisionIndex, setRevisionIndex] = useState(2);
  const revision = revisions[revisionIndex];

  return (
    <main className='previs-app'>
      <header className='app-header'>
        <span className='renku-wordmark'>Renku</span>
        <nav aria-label='Breadcrumb' className='breadcrumbs'>
          <Button variant='ghost' onClick={() => setPage('plans')}>Shot Plans</Button>
          <ChevronRight size={14} />
          <span>{page === 'previs' ? 'The Harbor Argument' : '03 · The Harbor Argument'}</span>
        </nav>
        <div className='plan-heading'>
          <span>The Harbor Argument</span>
          <span className='beat-summary'>Beats 1–4</span>
        </div>
      </header>
      {page === 'plans' ? (
        <section className='plan-library'>
          <div className='library-heading'><h1>Shot Plans</h1></div>
          <MediaCardGrid minimumCardWidthPx={340} gap='roomy'>
            <MediaCard
              media={{ kind: 'video', src: revision.src, title: 'The Harbor Argument previs', posterSrc: '/media/previs-poster.png', playback: 'hover-muted-loop' }}
              frame={{ kind: 'ratio', aspectRatio: 16 / 9 }}
              presentation={{ kind: 'overlay', copy: { title: 'The Harbor Argument', description: 'Beats 1–4' } }}
              activation={{ kind: 'callback', label: 'Open Shot Plan The Harbor Argument', onActivate: () => setPage('previs') }}
              cornerAction={{ kind: 'inspect', label: 'Inspect Shot Plan The Harbor Argument', visibility: 'always', onAction: () => setPage('previs') }}
            />
          </MediaCardGrid>
        </section>
      ) : (
        <Tabs defaultValue='previs' className='plan-tabs'>
          <TabsList variant='line' className='plan-tab-bar'>
            <TabsTrigger value='previs'>Previs</TabsTrigger>
            <TabsTrigger value='assets' disabled>Assets</TabsTrigger>
            <TabsTrigger value='audio' disabled>Audio</TabsTrigger>
          </TabsList>
          <TabsContent value='previs' className='previs-tab-content'>
            <PrevisMonitor
              key={revision.number}
              revision={revision}
              revisionIndex={revisionIndex}
              onRevisionChange={setRevisionIndex}
            />
          </TabsContent>
        </Tabs>
      )}
    </main>
  );
}

function PrevisMonitor({ revision, revisionIndex, onRevisionChange }) {
  const playback = usePrevisPlayback();
  const paired = Boolean(revision.generation);

  return (
    <>
      <section className='monitor-panel paired' aria-label='Director’s monitor'>
        <div className='revision-bar'>
          <Button variant='outline' disabled={revisionIndex === 0} onClick={() => onRevisionChange(revisionIndex - 1)}>
            <ArrowLeft size={16} />Prev
          </Button>
          <span className='revision-label' aria-live='polite'>Revision {revision.number} <span>of {revisions.length}</span></span>
          <Button variant='outline' disabled={revisionIndex === revisions.length - 1} onClick={() => onRevisionChange(revisionIndex + 1)}>
            Next<ArrowRight size={16} />
          </Button>
        </div>
        <div className='monitor-screens'>
          <div className='screen-shell'>
            <div className='screen-heading'><h2>Previs</h2><span>{playback.duration > 0 ? `${playback.duration.toFixed(2)}s` : ''}</span></div>
            <div className='monitor-screen'>
              <VideoPlayer
                ref={playback.previs}
                src={revision.src}
                title='Previs visualization'
                controls='external'
                className='h-full w-full object-contain'
                onTimeChange={playback.updateTime}
                onDurationChange={playback.readyPrevis}
                onPlayingChange={(value) => playback.nativePlayingChange('previs', value)}
                onSeek={playback.seek}
              />
            </div>
          </div>
          {paired ? (
            <div className='screen-shell'>
              <div className='screen-heading'><h2>Generation</h2><span>{playback.generationDuration > 0 ? `${playback.generationDuration.toFixed(2)}s` : ''}</span></div>
              <div className='monitor-screen'>
                <VideoPlayer
                  ref={playback.generation}
                  src={revision.generation}
                  title='Generated take'
                  controls='external'
                  className='h-full w-full object-contain'
                  onDurationChange={playback.readyGeneration}
                  onPlayingChange={(value) => playback.nativePlayingChange('generation', value)}
                  onSeek={playback.seek}
                />
              </div>
            </div>
          ) : (
            <div className='screen-shell'>
              <div className='screen-heading'><h2>Generation</h2></div>
              <div className='monitor-screen generation-placeholder'>
                <Film size={28} strokeWidth={1} />
                <span>No generation for this revision</span>
              </div>
            </div>
          )}
        </div>
        <div className='shared-transport'>
          <Button variant='ghost' size='icon' aria-label={playback.playing ? 'Pause playback' : 'Play playback'} disabled={!playback.duration} onClick={playback.togglePlayback}>
            {playback.playing ? <Pause size={21} fill='currentColor' /> : <Play size={21} fill='currentColor' />}
          </Button>
          <output className='transport-time' aria-label='Playback position'>{timecode(playback.time)} <span>/ {timecode(playback.duration)}</span></output>
          <Slider className='monitor-timeline' sliderSize='sm' aria-label={paired ? 'Linked video timeline' : 'Previs timeline'} min={0} max={playback.duration || 1} step={0.01} value={[playback.time]} disabled={!playback.duration} onValueChange={([seconds]) => playback.seek(seconds)} />
          <Button variant='ghost' size='icon' aria-label={playback.muted ? 'Unmute audio' : 'Mute audio'} onClick={playback.toggleMuted}>
            {playback.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </Button>
        </div>
        {playback.error ? <p role='alert' className='playback-error'>{playback.error}</p> : null}
      </section>
      <ul className='subject-legend' aria-label='Visualization color legend'>
        {subjects.map((subject) => <li key={subject.key}><span className='subject-dot' style={{ backgroundColor: subject.color }} />{subject.label}</li>)}
      </ul>
      <div className='directing-panels'>
        <section className='cue-panel' aria-label='Previs cues'>
          <h2>Previs cues</h2>
          <CueTimeline revision={revision} playback={playback} />
          <div className='cue-list'>
            {revision.cues.map((cue) => {
              const subject = subjects.find((candidate) => candidate.key === cue.subject);
              const active = playback.time >= cue.start && playback.time < cue.end;
              return (
                <div
                  key={`${cue.subject}-${cue.start}`}
                  className={`cue-row ${active ? 'is-current' : ''}`}
                >
                  <Button variant='ghost' size='icon' className='cue-play' style={{ color: subject.color }}
                    aria-label={`${active && playback.playing ? 'Pause' : 'Play'} ${subject.label} cue`}
                    onClick={() => active && playback.playing ? playback.pause() : playback.playCue(cue)}>
                    {active && playback.playing ? <Pause size={13} fill='currentColor' /> : <Play size={13} fill='currentColor' />}
                  </Button>
                  <Button variant='ghost' className='cue-seek' aria-current={active ? 'true' : undefined}
                    aria-label={`Seek to ${subject.label} at ${timecode(cue.start)}`} onClick={() => playback.seek(cue.start)}>
                    <span className='subject-dot' style={{ backgroundColor: subject.color }} />
                    <span className='cue-time'>{timecode(cue.start)}{cue.subject === 'mara' ? `–${timecode(cue.end)}` : ''}</span>
                    <span className='cue-subject'>{subject.label}</span>
                    <span className='cue-copy'>{cue.text}</span>
                    {cue.audio ? <Volume2 size={14} /> : null}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
        <DescriptionPanel />
      </div>
    </>
  );
}

function CueTimeline({ revision, playback }) {
  const duration = playback.duration || 17;
  const ticks = [0, 5, 10, 15].filter((second) => second < duration - 1);
  return (
    <div className='cue-timeline' aria-label='Cue timeline'>
      <div className='cue-ruler'>
        {ticks.map((second) => <span key={second} style={{ left: `${second / duration * 100}%` }}>00:{String(second).padStart(2, '0')}</span>)}
        <span className='ruler-end'>00:{Math.round(duration)}</span>
      </div>
      <div className='cue-lanes'>
        {subjects.filter((subject) => revision.cues.some((cue) => cue.subject === subject.key)).map((subject) => (
          <div className='cue-lane' key={subject.key}>
            <span>{subject.label}</span>
            <div className='cue-lane-track'>
              {revision.cues.filter((cue) => cue.subject === subject.key).map((cue) => (
                <Button variant='ghost' key={cue.start} className={`cue-range ${cue.subject === 'mara' ? '' : 'cue-marker'}`}
                  style={{ left: `${cue.start / duration * 100}%`, width: cue.subject === 'mara' ? `${(cue.end - cue.start) / duration * 100}%` : 6, '--cue-color': subject.color }}
                  aria-label={`Seek to ${subject.label} at ${timecode(cue.start)} on timeline`}
                  title={`${subject.label} · ${timecode(cue.start)} · ${cue.text}`}
                  onClick={() => playback.seek(cue.start)} />
              ))}
            </div>
          </div>
        ))}
        <div className='cue-playhead-area' aria-hidden='true'><span style={{ left: `${playback.time / duration * 100}%` }} /></div>
      </div>
    </div>
  );
}

function DescriptionPanel() {
  return (
    <section className='description-panel' aria-label='Directing description'>
      <Dialog>
        <div className='description-heading'>
          <h2>Description</h2>
          <DialogTrigger asChild>
            <Button variant='ghost' size='icon' aria-label='Expand description' title='Expand description'><Maximize2 size={17} /></Button>
          </DialogTrigger>
        </div>
        <div className='description-scroll' role='region' aria-label='Description text'>
          <ShotDescriptionViewer value={description.join('\n\n')} />
        </div>
        <DialogContent className='description-dialog'>
          <DialogHeader>
            <DialogTitle>Description</DialogTitle>
            <DialogDescription>The Harbor Argument · Beats 1–4</DialogDescription>
          </DialogHeader>
          <div className='description-reading' role='region' aria-label='Expanded description text'>
            <ShotDescriptionViewer value={description.join('\n\n')} />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
