import React, { useState } from 'react';
import { Play, Pause, Volume2, ShieldCheck, Mic, User } from 'lucide-react';
import { playChimeSound } from '../utils/soundEffects';
import { speakText } from '../services/api';

export interface TranscriptTurn {
  id: string;
  speaker: 'ai' | 'patient' | 'AI_AGENT' | 'PATIENT';
  text: string;
  timestamp?: string;
  audio_offset_seconds?: number;
  startTime?: number;
  endTime?: number;
  has_symptom?: boolean;
  isEvidence?: boolean;
  symptom_category?: string;
  symptomLabel?: string;
}

interface TranscriptVerifierProps {
  callId?: string;
  patientName: string;
  callDate?: string;
  audioDuration?: string;
  turns?: TranscriptTurn[];
  segments?: TranscriptTurn[];
  onPlaySnippet?: (startSeconds: number) => void;
}

export const TranscriptVerifier: React.FC<TranscriptVerifierProps> = ({
  callId,
  patientName,
  callDate = 'Hôm nay',
  audioDuration = '00:24',
  turns,
  segments,
  onPlaySnippet
}) => {
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(null);
  const [isPlayingFull, setIsPlayingFull] = useState<boolean>(false);

  const items: TranscriptTurn[] = Array.isArray(turns) && turns.length > 0 ? turns : Array.isArray(segments) ? segments : [];

  const handleSnippetClick = (turn: TranscriptTurn) => {
    setActiveSnippetId(turn.id);
    playChimeSound();
    const offset = turn.audio_offset_seconds ?? turn.startTime ?? 0;
    if (onPlaySnippet) {
      onPlaySnippet(offset);
    } else if (turn.text) {
      speakText(turn.text).catch(() => {});
    }
    setTimeout(() => {
      setActiveSnippetId(null);
    }, 4500);
  };

  const handleToggleFullPlay = () => {
    playChimeSound();
    if (!isPlayingFull) {
      setIsPlayingFull(true);
      const fullText = items.map((t) => t.text).join('. ');
      if (fullText) {
        speakText(fullText)
          .catch(() => {})
          .finally(() => setIsPlayingFull(false));
      } else {
        setTimeout(() => setIsPlayingFull(false), 3000);
      }
    } else {
      setIsPlayingFull(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Header Player Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Ngày ghi nhận: <strong className="text-[#0B1F3A] dark:text-slate-200">{callDate}</strong></span>
            <span>•</span>
            <span className="font-mono">Thời lượng: {audioDuration}</span>
            {callId && (
              <>
                <span>•</span>
                <span className="font-mono text-[#0D9488]">#{callId}</span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleFullPlay}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 text-white shadow-xs transition-all self-start sm:self-auto cursor-pointer ${
            isPlayingFull ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#0D9488] hover:bg-[#0F766E]'
          }`}
        >
          {isPlayingFull ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isPlayingFull ? 'Đang phát đối chiếu...' : 'Nghe toàn bộ cuộc hội thoại'}</span>
        </button>
      </div>

      <div className="p-3.5 bg-[#F0FDFA] dark:bg-[#0D9488]/15 border border-[#99F6E4] dark:border-[#0D9488]/30 rounded-xl text-xs text-[#0B1F3A] dark:text-slate-200 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-[#0D9488] dark:text-[#2DD4BF] shrink-0 mt-0.5" />
        <span>
          <strong className="text-[#0F766E] dark:text-[#5EEAD4]">Kiểm chứng âm thanh gốc:</strong> Chạm vào câu trả lời của người bệnh để nghe lại chính xác đoạn ghi âm 5 giây phát hiện triệu chứng.
        </span>
      </div>

      {/* Transcript Turns List */}
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Chưa có bản ghi lời thoại chi tiết cho sự kiện này.
          </div>
        ) : (
          items.map((turn) => {
            const isAI = turn.speaker === 'ai' || turn.speaker === 'AI_AGENT';
            const isHighlighted = Boolean(turn.has_symptom || turn.isEvidence);
            const timeLabel =
              turn.timestamp ||
              (turn.startTime !== undefined ? `00:0${turn.startTime} - 00:${String(turn.endTime || 15).padStart(2, '0')}` : '00:05');

            return (
              <div
                key={turn.id}
                onClick={() => !isAI && handleSnippetClick(turn)}
                className={`p-4 rounded-xl border transition-all ${
                  isAI
                    ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800 mr-4'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 ml-4 cursor-pointer hover:border-[#0D9488]'
                } ${
                  activeSnippetId === turn.id
                    ? 'ring-2 ring-[#0D9488] bg-[#F0FDFA]/50 dark:bg-[#0D9488]/10'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                      isAI ? 'text-slate-600 dark:text-slate-400' : 'text-[#0B1F3A] dark:text-white'
                    }`}
                  >
                    {isAI ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-[#0D9488]" />
                        <span>Trợ lý giọng nói MediGuard AI</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3.5 h-3.5 text-[#0D9488]" />
                        <span>Người bệnh: {patientName}</span>
                      </>
                    )}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-mono tabular-nums">{timeLabel}</span>
                    {!isAI && (
                      <span className="text-[11px] px-2 py-0.5 bg-[#F0FDFA] dark:bg-[#0D9488]/20 text-[#0F766E] dark:text-[#5EEAD4] font-semibold rounded-md flex items-center gap-1 border border-[#99F6E4] dark:border-[#0D9488]/40">
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>{activeSnippetId === turn.id ? 'Đang phát...' : 'Nghe đoạn này'}</span>
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-[#0B1F3A] dark:text-slate-200 leading-relaxed font-medium">
                  {isHighlighted ? (
                    <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/70 font-semibold">
                      “{turn.text}”
                    </span>
                  ) : (
                    <span>“{turn.text}”</span>
                  )}
                </p>

                {(turn.symptomLabel || turn.symptom_category) && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 text-[11px] font-mono font-semibold">
                    <Mic className="w-3 h-3" />
                    <span>{turn.symptomLabel || turn.symptom_category}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TranscriptVerifier;
