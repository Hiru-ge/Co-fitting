import { Icon } from "~/components/Icon";

const SAMPLE_VISIT_TRIGGER_EVENT = "sample-visit-triggered";

function dispatchSampleVisitTriggered() {
  window.dispatchEvent(new CustomEvent(SAMPLE_VISIT_TRIGGER_EVENT));
}

export default function SampleVisitModal() {
  return (
    <div className="fixed inset-0 z-39 flex flex-col pointer-events-none">
      {/* AppHeader と同じ高さのスペーサー */}
      <div className="shrink-0 px-6 pt-6 pb-2">
        <div className="h-10" />
      </div>

      {/* home.tsx の main と同じレイアウトでカードを配置 */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 pb-20 pt-4 overflow-hidden">
        <div className="flex-1 min-h-0 relative w-full pointer-events-auto">
          {/* DiscoveryCard を踏襲したカードUI */}
          <div
            data-tour="sample-visit-card"
            className="absolute inset-0 rounded-3xl overflow-hidden bg-linear-to-br from-amber-600 to-orange-800 shadow-xl"
          >
            {/* カテゴリアイコン（透過） */}
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <Icon
                name="local_cafe"
                className="text-white"
                style={{ fontSize: "12rem" }}
              />
            </div>

            {/* 上部グラデーション */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-black/80 via-black/50 to-transparent pointer-events-none" />

            {/* バッジ */}
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="bg-white/30 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full">
                NEW SPOT
              </span>
              <span className="bg-orange-500/90 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full">
                カフェ
              </span>
            </div>

            {/* 施設情報 */}
            <div className="absolute bottom-0 left-0 right-0 px-6 pt-32 pb-20 bg-linear-to-t from-black/80 via-black/50 to-transparent">
              <h2
                className="text-2xl font-extrabold text-white leading-tight mb-2"
                style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
              >
                Cafe Roamble
              </h2>
              <div
                className="flex items-center gap-3 text-white text-sm"
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
              >
                <span className="flex items-center gap-1">
                  <Icon name="local_cafe" className="text-base" />
                  カフェ
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="distance" className="text-base" />
                  すぐそこ
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="star" className="text-base text-yellow-400" />
                  4.5
                </span>
              </div>
            </div>
          </div>

          {/* モックアクションボタン */}
          <div
            data-tour="sample-action-buttons"
            className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-2"
          >
            <div className="flex items-center gap-3 w-full">
              <div className="flex flex-col items-center gap-0.5 pt-4.5">
                <div className="size-12 flex items-center justify-center rounded-full bg-white/50 backdrop-blur-sm shadow-md opacity-40">
                  <Icon name="refresh" className="text-xl text-gray-10" />
                </div>
                <span className="text-xs text-white">あと3回</span>
              </div>
              <button
                type="button"
                onClick={dispatchSampleVisitTriggered}
                className="flex-1 h-12 rounded-full bg-primary text-white font-bold text-base shadow-lg flex items-center justify-center gap-2"
              >
                <Icon name="explore" className="text-xl" />
                <span className="text-sm">行ってきた！</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
