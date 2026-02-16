import { useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, ImageSourcePropType, StyleSheet, View } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchEnemies, setAttackRating } from '../../features/enemy/enemySlice';
import { HitEffect } from '../../components/HitEffect';

interface EnemyProps {
  index: number;
  jumpIntoView?: boolean;
}

export const Enemy: React.FC<EnemyProps> = ({ index, jumpIntoView = false }) => {
  const dispatch = useAppDispatch();
  const enemy = useAppSelector((state) => state.enemy.enemies[index]);
  const enemyAttackPulse = useAppSelector((state) => state.combat.enemyAttackPulse);
  const lastEnemyAttackId = useAppSelector((state) => state.combat.lastEnemyAttackId);
  const playerHitPulse = useAppSelector((state) => state.combat.playerHitPulse);
  const lastPlayerHitId = useAppSelector((state) => state.combat.lastPlayerHitId);
  const lastPlayerHitType = useAppSelector((state) => state.combat.lastPlayerHitType);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const attackAnim = useRef(new Animated.Value(0)).current;
  const ambushJumpAnim = useRef(new Animated.Value(0)).current;
  const [showHitEffect, setShowHitEffect] = useState(false);

  const resources = [
    require('../../resources/skeleton_01.png'),
    require('../../resources/demonrat_01.png'),
    require('../../resources/skeleton_01.png'),
  ];

  useEffect(() => {
    if (!enemy) return;
    dispatch(fetchEnemies());

    const baseAR = enemy.stats.atkSpeed;
    const dex = enemy.stats.dexterity;
    const atkRating = (baseAR + dex * 2) * 2;
    dispatch(setAttackRating({ id: index, rating: atkRating }));
  }, [dispatch, index, enemy?.id]);

  useEffect(() => {
    if (!enemy) return;

    if (enemy.health <= 0) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(1);
    }
  }, [enemy?.health]);

  useEffect(() => {
    if (lastEnemyAttackId !== index) return;

    attackAnim.setValue(0);
    Animated.sequence([
      Animated.timing(attackAnim, {
        toValue: -14,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(attackAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [enemyAttackPulse]);

  useEffect(() => {
    if (lastPlayerHitId !== index) return;

    setShowHitEffect(true);
    const timeout = setTimeout(() => setShowHitEffect(false), 320);
    return () => clearTimeout(timeout);
  }, [playerHitPulse]);

  useEffect(() => {
    if (!jumpIntoView) return;

    ambushJumpAnim.setValue(-30);
    Animated.spring(ambushJumpAnim, {
      toValue: 0,
      speed: 18,
      bounciness: 12,
      useNativeDriver: true,
    }).start();
  }, [jumpIntoView, index]);

  if (!enemy) return null;
  const enemySprite = resources[enemy.id] || resources[0];
  const isRat = enemy.id === 1;

  const maxHealth = Math.max(enemy.stats.health || 1, 1);
  const healthPct = Math.max(0, Math.min(1, enemy.health / maxHealth));
  const healthColor = healthPct > 0.6 ? '#22c55e' : healthPct > 0.3 ? '#f59e0b' : '#ef4444';

  return (
    <View style={[styles.enemyRoot, isRat && styles.enemyRootRat]}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: ambushJumpAnim }, { translateX: attackAnim }] }}>
        <View style={styles.enemyFrame}>
          <View style={[styles.healthBarWrap, isRat && styles.healthBarWrapRat]}>
            <View style={styles.healthBarTrack}>
              <View
                style={[
                  styles.healthBarFill,
                  {
                    width: `${healthPct * 100}%`,
                    backgroundColor: healthColor,
                  },
                ]}
              />
            </View>
          </View>
          <ImageBackground
            source={enemySprite as ImageSourcePropType}
            style={[styles.enemy, isRat && styles.enemyRat]}
            imageStyle={enemy.id === 2 ? styles.archerTint : undefined}
            resizeMode="contain"
          >
            {showHitEffect && (
              <View style={[styles.hitEffectWrap, isRat && styles.hitEffectWrapRat]}>
                <HitEffect variant={lastPlayerHitType} size={isRat ? 44 : 56} />
              </View>
            )}
          </ImageBackground>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  enemyRoot: {
    width: 150,
    height: 170,
    alignSelf: 'center',
    position: 'absolute',
    top: 54,
  },
  enemyRootRat: {
    width: 120,
    height: 142,
    top: 68,
  },
  enemyFrame: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  enemy: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    position: 'absolute',
    top: 20,
  },
  enemyRat: {
    width: 120,
    height: 120,
    top: 14,
  },
  healthBarWrap: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 7,
  },
  healthBarWrapRat: {
    left: 12,
    right: 12,
  },
  healthBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#334155',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0f172a',
  },
  healthBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  hitEffectWrap: {
    position: 'absolute',
    top: -24,
    left: 42,
    zIndex: 5,
  },
  hitEffectWrapRat: {
    top: -16,
    left: 30,
  },
  archerTint: {
    tintColor: '#8fc6ff',
    opacity: 0.94,
  },
});
