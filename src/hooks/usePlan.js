import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTeam } from '../contexts/TeamContext';

const FREE_GAME_LIMIT = 2;
const FREE_ATBAT_LIMIT = 70;

export function usePlan() {
  const { userDoc, user } = useAuth();
  const { savedGames, atBats } = useTeam();

  const FOUNDER_EMAILS = ['jepabst@gmail.com'];
  const isPro = userDoc?.plan === 'pro' || FOUNDER_EMAILS.includes(user?.email);
  const gameCount = savedGames?.length || 0;
  const atBatCount = atBats?.length || 0;

  const gamesRemaining = Math.max(0, FREE_GAME_LIMIT - gameCount);
  const atBatsRemaining = Math.max(0, FREE_ATBAT_LIMIT - atBatCount);

  const canCommitGame = isPro || gameCount < FREE_GAME_LIMIT;
  const canLogAtBat = isPro || atBatCount < FREE_ATBAT_LIMIT;
  const isLocked = !isPro && (!canCommitGame || !canLogAtBat);

  const lockReason = useMemo(() => {
    if (isPro) return null;
    if (!canCommitGame && !canLogAtBat) return 'You\'ve reached both the free game and at-bat limits.';
    if (!canCommitGame) return `You've used your ${FREE_GAME_LIMIT} free committed games.`;
    if (!canLogAtBat) return `You've reached the ${FREE_ATBAT_LIMIT} free at-bat limit.`;
    return null;
  }, [isPro, canCommitGame, canLogAtBat]);

  return {
    isPro,
    canCommitGame,
    canLogAtBat,
    isLocked,
    lockReason,
    gameCount,
    atBatCount,
    gamesRemaining,
    atBatsRemaining,
    FREE_GAME_LIMIT,
    FREE_ATBAT_LIMIT,
  };
}
