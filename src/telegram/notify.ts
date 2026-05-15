import { isEnabled, sendMessage } from './client';
import { getCheckWinningLink } from '../utils/winning';
import { getNextLottoRound } from '../utils/rounds';

interface PurchaseMetadata {
  type: 'auto' | 'manual';
  numbers: number[][];
  timestamp: string;
}

// Escape characters that are special in Telegram legacy Markdown (parse_mode: 'Markdown').
// Without this, an error message containing _ * ` or [ makes Telegram reject the
// message with HTTP 400, so the failure notification would silently never arrive.
function escapeMarkdown(text: string): string {
  return text.replace(/[_*`[]/g, '\\$&');
}

// Send purchase notification to Telegram
export async function notifyPurchase(purchases: PurchaseMetadata[]): Promise<void> {
  if (!isEnabled()) return;

  const round = getNextLottoRound();
  const totalGames = purchases.reduce((sum, p) => sum + p.numbers.length, 0);

  const sections = purchases.map((purchase, index) => {
    const typeLabel = purchase.type === 'auto' ? '자동' : '수동';
    const link = getCheckWinningLink(purchase.numbers, round);
    const numbersText = purchase.numbers.map((nums, i) => `  ${i + 1}. \`${nums.join(', ')}\``).join('\n');

    return `*#${index + 1} (${typeLabel})*\n${numbersText}\n[당첨확인](${link})`;
  });

  const message = `🎰 *제${round}회 로또 구매 완료*\n` + `총 ${totalGames}게임\n\n` + sections.join('\n\n');

  console.log('[Telegram] Sending purchase notification');
  await sendMessage(message);
}

// Send winning notification to Telegram (only when there are winners)
export async function notifyWinning(issueNumber: number, round: number, ranks: number[]): Promise<void> {
  if (!isEnabled()) return;

  const winningGames = ranks.map((rank, index) => ({ rank, game: index + 1 })).filter(r => r.rank > 0);

  if (winningGames.length === 0) return;

  const rankEmojis = ['', '🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  const results = winningGames.map(g => `  ${rankEmojis[g.rank]} ${g.game}번 게임: ${g.rank}등 당첨!`).join('\n');

  const message = `🎉 *제${round}회 당첨!*\n\n` + `${results}\n\n` + `Issue #${issueNumber}`;

  console.log('[Telegram] Sending winning notification');
  await sendMessage(message);
}

// Send failure notification to Telegram (login / purchase / workflow error)
export async function notifyFailure(error: unknown): Promise<void> {
  if (!isEnabled()) return;

  const round = getNextLottoRound();
  const reason = error instanceof Error ? error.message : String(error);
  // Slice the raw reason first, then escape, so we never cut a backslash escape in half.
  const safeReason = escapeMarkdown(reason.slice(0, 1000));

  const message = `⚠️ *제${round}회 로또 구매 실패*\n\n` + `사유: ${safeReason}`;

  console.log('[Telegram] Sending failure notification');
  await sendMessage(message);
}
