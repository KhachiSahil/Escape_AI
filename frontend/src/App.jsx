import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import VoiceSphere from './components/VoiceSphere';
import { AudioProcessor } from './utils/audioProcessor';
import { setIsRecording, setVolume, addLog } from './store';

function App() {
  const dispatch = useDispatch();
  const isRecording = useSelector((state) => state.audio.isRecording);
  const volume = useSelector((state) => state.audio.volume);
  
  const audioProcessorRef = useRef(null);

  useEffect(() => {
    audioProcessorRef.current = new AudioProcessor({
      onChunkSent: (log) => {
        dispatch(addLog(log));
        console.log(`[Redux Store Updated Log] ${log.timestamp} - ${log.size} bytes - ${log.status}`);
      },
      onVolumeChange: (vol) => {
        dispatch(setVolume(vol));
      },
      onStateChange: (state) => {
        dispatch(setIsRecording(state));
      }
    });

    return () => {
      if (audioProcessorRef.current) {
        audioProcessorRef.current.stop();
      }
    };
  }, [dispatch]);

  const handleVoiceToggle = async () => {
    if (!audioProcessorRef.current) return;

    if (isRecording) {
      audioProcessorRef.current.stop();
    } else {
      try {
        await audioProcessorRef.current.start();
      } catch (err) {
        alert('Could not access microphone. Please allow permissions and try again.');
      }
    }
  };

  return (
    <div className="relative flex flex-col justify-between w-screen h-screen min-h-0 p-5 md:p-8 bg-[#04060a] text-gray-100 font-sans overflow-hidden select-none before:content-[''] before:absolute before:inset-0 before:bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] before:bg-[size:32px_32px] before:bg-center before:[mask-image:radial-gradient(circle_at_center,black_30%,transparent_75%)] before:pointer-events-none before:z-0">
      
      {/* Top minimal header */}
      <header className="relative z-10 flex justify-between items-center border-b border-white/10 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3 group">
          <span className="text-base md:text-lg text-indigo-400 animate-pulse font-bold">▲</span>
          <span className="font-heading text-lg md:text-xl lg:text-2xl font-extrabold tracking-[0.3em] bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-100 to-indigo-200 drop-shadow-md">
            ESCAPE AI
          </span>
        </div>
        <span className="flex items-center gap-2 text-[0.65rem] md:text-xs font-semibold tracking-wider text-gray-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
          <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            isRecording ? 'bg-indigo-400 shadow-[0_0_12px_#818cf8]' : 'bg-gray-600'
          }`} />
          {isRecording ? 'STREAMING ACTIVE' : 'SECURE LINE'}
        </span>
      </header>

      {/* Main Focus Visualizer Zone */}
      <main className="relative z-10 flex flex-col items-center justify-center flex-grow min-h-0 gap-6 my-4">
        <VoiceSphere 
          isRecording={isRecording}
          volume={volume}
          onClick={handleVoiceToggle}
        />
        
        <div className="text-center max-w-[320px] sm:max-w-[420px] px-4 flex-shrink-0">
          <h1 className="font-heading text-xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-white mb-2">
            {isRecording ? 'Listening' : 'Ready'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed font-medium">
            {isRecording 
              ? 'Voice data is packaged into 10s chunks silently using Axios & Redux' 
              : 'Tap the sphere to initiate real-time conversational streaming'}
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
