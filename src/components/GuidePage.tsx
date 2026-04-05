interface GuidePageProps {
  onClose: () => void;
}

const FEATURES = [
  {
    icon: 'AI',
    title: 'AI骨格分析',
    description:
      'MediaPipe AIが動画から33の関節ポイントを自動検出。お手本とあなたの骨格を可視化して、動きの違いをリアルタイムで確認できます。',
    color: 'neon-green',
  },
  {
    icon: 'VS',
    title: 'ダンス比較・採点',
    description:
      '関節の角度（60%）とポジション（40%）を組み合わせた独自のスコアリング。0〜100点で総合評価し、体の部位ごとの得点も表示します。',
    color: 'neon-pink',
  },
  {
    icon: 'SYNC',
    title: '自動同期',
    description:
      'モーションエネルギーと関節角度のクロス相関で、2つの動画の開始タイミングを自動で合わせます。手動オフセット調整も可能です。',
    color: 'neon-blue',
  },
  {
    icon: 'LESSON',
    title: 'レッスンモード',
    description:
      'Starter → Rising → Master → Legend の4段階レベル別フィードバック。方向を意識したアドバイスで、具体的にどう改善すればいいかがわかります。',
    color: 'neon-purple',
  },
  {
    icon: 'UP',
    title: 'Skill Up メニュー',
    description:
      'スコア結果から弱点を分析し、あなた専用の練習メニューを自動生成。ウォームアップ→部位別ドリル→通し練習の3ステップで効率的にレベルアップ。',
    color: 'neon-purple',
  },
  {
    icon: 'PEN',
    title: 'ペン描画ツール',
    description:
      '動画上に直接書き込み。気になるフォームや改善ポイントをマーキングできます。6色・3段階の太さ、UNDO・CLEARに対応。',
    color: 'neon-orange',
  },
  {
    icon: '%',
    title: 'リアルタイム一致度',
    description:
      '再生中にフレームごとの一致度を%でリアルタイム表示。タイムラインにはプレイヘッドが連動し、区間ごとの平均スコアやスコア分布も確認できます。',
    color: 'neon-yellow',
  },
  {
    icon: 'LOG',
    title: '練習履歴 & 成長グラフ',
    description:
      '分析結果を自動保存し、スコアの推移をグラフで可視化。部位別の成長度合いも前回と比較して確認できます。メモ機能で練習の気づきを記録。',
    color: 'neon-blue',
  },
  {
    icon: 'VS',
    title: 'コミュニティ & チャレンジ',
    description:
      'オンラインチャレンジに参加してスコアを競おう。ランキングで他のダンサーと比較。自分でチャレンジを作成することも可能です（Firebase連携が必要）。',
    color: 'neon-pink',
  },
  {
    icon: 'OVL',
    title: 'オーバーレイ比較',
    description:
      'お手本とあなたの骨格を1つの画面に重ねて表示。体格差を自動補正するノーマライズ機能で、公平に比較できます。',
    color: 'neon-blue',
  },
  {
    icon: 'TEAM',
    title: 'チーム・スクール管理',
    description:
      '指導者がチームを作成し、生徒を招待コードで参加させます。メンバーのスコア・成長度・部位別の弱点を一覧で確認でき、効率的な指導が可能です。',
    color: 'neon-orange',
  },
];

const STEPS = [
  {
    step: 1,
    title: '動画をアップロード',
    description:
      'REFERENCEにお手本動画、YOUR DANCEにあなたの動画をドラッグ&ドロップ、またはカメラで撮影します。',
  },
  {
    step: 2,
    title: 'ANALYZEをクリック',
    description:
      'AIが自動で骨格検出・同期・比較を行います。処理には数十秒〜数分かかります。',
  },
  {
    step: 3,
    title: 'スコアを確認',
    description:
      '総合スコア、体の部位ごとの評価、タイムライン上のフレーム別スコアを確認できます。',
  },
  {
    step: 4,
    title: 'Skill Upメニューで練習',
    description:
      'スコアに基づいて自動生成された練習メニューを実践。弱点部位のドリルを優先的にこなしましょう。',
  },
  {
    step: 5,
    title: 'レッスンで改善',
    description:
      'レッスンモードで4段階のレベル別フィードバックを受けて、具体的な改善方法を学びましょう。',
  },
  {
    step: 6,
    title: '動画を見比べる',
    description:
      'サイドバイサイド再生やオーバーレイ表示で動きを確認。スロー再生（0.1x〜1.0x）でじっくり分析できます。',
  },
  {
    step: 7,
    title: 'ペンで書き込み',
    description:
      'PENボタンを押して描画モードをON。REF/YOUで対象を選び、気になる箇所にマーキングして分析に活用しましょう。',
  },
];

export default function GuidePage({ onClose }: GuidePageProps) {
  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <div className="text-center py-8">
        <h2 className="text-2xl sm:text-3xl font-bold mb-3">
          <span className="bg-gradient-to-r from-neon-green via-neon-blue to-neon-purple bg-clip-text text-transparent">
            DANCE SCORE
          </span>
          {' '}Guide
        </h2>
        <p className="text-dark-500 text-sm max-w-lg mx-auto">
          AIがあなたのダンスを分析し、お手本との違いをスコア化。
          具体的な改善ポイントを見つけて、レベルアップしましょう。
        </p>
      </div>

      {/* Features */}
      <section>
        <h3 className="text-xs font-bold tracking-[0.2em] text-dark-500 mb-4 text-center">
          FEATURES
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-dark-800 rounded-xl border border-dark-600 p-5 hover:border-dark-500 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`text-${f.color} text-sm font-bold tracking-wider bg-${f.color}/10 rounded-lg px-2.5 py-1`}
                >
                  {f.icon}
                </span>
                <h4 className="font-bold text-sm">{f.title}</h4>
              </div>
              <p className="text-dark-500 text-xs leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How to use */}
      <section>
        <h3 className="text-xs font-bold tracking-[0.2em] text-dark-500 mb-6 text-center">
          HOW TO USE
        </h3>
        <div className="max-w-2xl mx-auto flex flex-col gap-1">
          {STEPS.map((s, i) => (
            <div key={s.step} className="flex gap-4 items-start">
              {/* Step indicator + connector line */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-pink to-neon-purple flex items-center justify-center text-xs font-bold shrink-0">
                  {s.step}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-px h-12 bg-dark-600" />
                )}
              </div>
              {/* Content */}
              <div className="pb-6">
                <h4 className="font-bold text-sm mb-1">{s.title}</h4>
                <p className="text-dark-500 text-xs leading-relaxed">
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="bg-dark-800 rounded-xl border border-dark-600 p-6 max-w-2xl mx-auto w-full">
        <h3 className="text-xs font-bold tracking-[0.2em] text-neon-yellow mb-4">
          TIPS
        </h3>
        <ul className="flex flex-col gap-2.5 text-xs text-dark-500 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-neon-green shrink-0">-</span>
            撮影時はなるべく全身が映るようにしましょう
          </li>
          <li className="flex gap-2">
            <span className="text-neon-green shrink-0">-</span>
            お手本とアングル（正面・横など）を揃えると精度が上がります
          </li>
          <li className="flex gap-2">
            <span className="text-neon-green shrink-0">-</span>
            スロー再生（0.1x）で細かい動きの違いをチェック
          </li>
          <li className="flex gap-2">
            <span className="text-neon-green shrink-0">-</span>
            PENツールで気づいたポイントをメモして練習に活かしましょう
          </li>
          <li className="flex gap-2">
            <span className="text-neon-green shrink-0">-</span>
            GREEN = お手本、BLUE = あなた、PINK = ズレが大きい部分
          </li>
        </ul>
      </section>

      {/* Back button */}
      <div className="flex justify-center pb-8">
        <button
          onClick={onClose}
          className="px-8 py-3 rounded-xl font-bold text-sm tracking-wider bg-gradient-to-r from-neon-pink to-neon-purple text-white glow-pink hover:scale-105 active:scale-95 transition-all"
        >
          START DANCING
        </button>
      </div>
    </div>
  );
}
